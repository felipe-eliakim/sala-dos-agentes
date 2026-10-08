"""Projeção dos eventos dos hooks em sessões e subagentes.

Funções puras sobre dicionários, sem ler disco, para dar pra testar.

Estados do agente principal:
  working    trabalhando (depois de um pedido, usando ferramentas)
  waiting    parado esperando o próximo pedido
  attention  pediu algo a você (permissão ou pergunta)
  ended      sessão encerrada
Subagentes: working ou done.
"""

ATTENTION_TOOLS = {"AskUserQuestion", "ExitPlanMode"}
FEED_MAX = 60


def new_session(sid, t):
    return {"id": sid, "cwd": "", "name": "", "state": "waiting", "tool": None,
            "since": t, "last": t, "started": t, "pedido": "", "subagents": {}, "fila": []}


def apply(sessions, ev, feed=None):
    """Aplica um evento (já normalizado pelo hook) no dicionário de sessões.

    feed (lista, opcional) recebe as tarefas concluídas, para o quadro de avisos.
    """
    sid, name, t = ev.get("session_id"), ev.get("hook_event_name"), ev.get("t")
    if not sid or not name or not isinstance(t, (int, float)):
        return
    s = sessions.get(sid)
    if s is None:
        s = sessions[sid] = new_session(sid, t)
    if t < s["last"] - 1:
        # Evento atrasado (arquivo de outro dia lido fora de ordem): só
        # aproveita o cwd, não volta o estado pra trás.
        s["cwd"] = s["cwd"] or ev.get("cwd", "")
        return
    if ev.get("cwd"):
        s["cwd"] = ev["cwd"]
    s["last"] = t
    agent = ev.get("agent_id")

    def set_state(state, tool=None):
        if s["state"] != state:
            s["since"] = t
        s["state"], s["tool"] = state, tool

    def done(kind, who, tarefa):
        if feed is not None and tarefa:
            feed.append({"t": t, "kind": kind, "quem": who, "tarefa": tarefa, "cwd": s["cwd"], "session": sid})
            del feed[:-FEED_MAX]

    if name == "SessionStart":
        if s["state"] == "ended":
            s["subagents"], s["fila"] = {}, []
        set_state("waiting")
    elif name == "UserPromptSubmit":
        if ev.get("pedido"):
            s["pedido"] = ev["pedido"]
        set_state("working")
    elif name == "PreToolUse":
        tool = ev.get("tool_name")
        sub = s["subagents"].get(agent) if agent else None
        if sub is not None:
            sub["tool"], sub["last"] = tool, t
        elif tool in ATTENTION_TOOLS:
            set_state("attention", tool)
        else:
            if tool in ("Agent", "Task") and ev.get("tarefa"):
                # A tarefa chega aqui; o id do subagente só no SubagentStart.
                s["fila"].append({"tipo": ev.get("tipo") or "", "tarefa": ev["tarefa"]})
                del s["fila"][:-10]
            set_state("working", tool)
    elif name == "PostToolUse":
        if not agent and s["state"] == "attention":
            set_state("working", None)
    elif name == "Notification":
        kind = ev.get("notification_type", "")
        if "idle" in kind:
            set_state("waiting")
        elif not agent:
            set_state("attention", s["tool"])
    elif name == "SubagentStart":
        if agent:
            kind = ev.get("agent_type") or "general-purpose"
            fila = s["fila"]
            pick = next((i for i, x in enumerate(fila) if x["tipo"] == kind), 0 if fila else None)
            tarefa = fila.pop(pick)["tarefa"] if pick is not None else ""
            s["subagents"][agent] = {"id": agent, "type": kind, "tarefa": tarefa,
                                     "state": "working", "tool": None, "started": t,
                                     "last": t, "ended": None}
        if s["state"] != "attention":
            set_state("working", "Agent")
    elif name == "SubagentStop":
        # Subagente que nunca avisou que começou (agente interno do Claude
        # Code) é ignorado, senão aparecia um "agente" fantasma na sala.
        sub = s["subagents"].get(agent) if agent else None
        if sub is not None and sub["state"] == "working":
            sub.update(state="done", tool=None, ended=t, last=t)
            done("sub", sub["type"], sub["tarefa"])
    elif name == "Stop":
        if s["state"] in ("working", "attention"):
            done("sessao", s["name"] or "Claude", s["pedido"])
        set_state("waiting")
    elif name == "SessionEnd":
        set_state("ended")
        for sub in s["subagents"].values():
            if sub["state"] == "working":
                sub.update(state="done", tool=None, ended=t)


def reconcile(sessions, registry, alive, now, silent_minutes, linger):
    """Junta o registro de sessões do Claude Code e decide quem continua no escritório.

    registry: {session_id: dados de ~/.claude/sessions/<pid>.json}
    alive:    {session_id: bool} se o processo daquela sessão ainda existe
    Devolve a lista de sessões visíveis.
    """
    for sid, reg in registry.items():
        if sid not in sessions and alive.get(sid):
            started = (reg.get("startedAt") or now * 1000) / 1000
            sessions[sid] = new_session(sid, started)
            sessions[sid]["cwd"] = reg.get("cwd", "")
    visible = []
    for sid, s in sessions.items():
        reg = registry.get(sid)
        if reg:
            s["name"] = reg.get("name") or s["name"]
            s["pid"] = reg.get("pid")
            s["cwd"] = s["cwd"] or reg.get("cwd", "")
            if alive.get(sid) is False and s["state"] != "ended":
                s["state"], s["since"], s["tool"] = "ended", now, None
            # O registro diz ocupado/parado e às vezes é mais novo que o
            # último hook (ex.: sessão aberta antes de instalar os hooks).
            updated = (reg.get("statusUpdatedAt") or 0) / 1000
            if updated > s["last"] + 2 and s["state"] != "ended":
                status = reg.get("status")
                if status == "idle" and s["state"] == "working":
                    s["state"], s["since"], s["tool"] = "waiting", updated, None
                elif status == "busy" and s["state"] == "waiting":
                    s["state"], s["since"] = "working", updated
                s["last"] = max(s["last"], updated)
        elif s["state"] != "ended" and now - s["last"] > silent_minutes * 60:
            s["state"], s["since"], s["tool"] = "ended", now, None
        if s["state"] == "ended":
            continue
        subs = [dict(x) for x in s["subagents"].values()
                if x["state"] == "working" or now - (x.get("ended") or now) < linger]
        out = {k: v for k, v in s.items() if k not in ("subagents", "fila")}
        out["subagents"] = sorted(subs, key=lambda x: x["started"])
        visible.append(out)
    return sorted(visible, key=lambda s: s["started"])


def project_of(cwd, hub_dir):
    """Pasta do projeto do hub a que um cwd pertence ('' = raiz do hub)."""
    if not cwd:
        return "?"
    if not hub_dir:
        return cwd.rstrip("/").rsplit("/", 1)[-1] or cwd
    hub = str(hub_dir).rstrip("/")
    if cwd == hub:
        return ""
    if cwd.startswith(hub + "/"):
        return cwd[len(hub) + 1:].split("/", 1)[0]
    return cwd.rstrip("/").rsplit("/", 1)[-1] or cwd


def project_label(cwd, hub_dir, labels):
    key = project_of(cwd, hub_dir)
    return labels.get(key) or key
