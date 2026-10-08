"""Testes da projeção de eventos.  python3 -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))
import state  # noqa: E402

HUB = "/home/u/projetos"


def ev(name, t, **kw):
    return {"hook_event_name": name, "session_id": "s1", "t": t, "cwd": HUB + "/meu-app", **kw}


def run(*events):
    sessions = {}
    for e in events:
        state.apply(sessions, e)
    return sessions


class Apply(unittest.TestCase):
    def test_ciclo_basico(self):
        s = run(ev("SessionStart", 1), ev("UserPromptSubmit", 2), ev("PreToolUse", 3, tool_name="Edit"))["s1"]
        self.assertEqual((s["state"], s["tool"]), ("working", "Edit"))
        state.apply({"s1": s}, ev("Stop", 4))
        self.assertEqual((s["state"], s["tool"]), ("waiting", None))

    def test_pergunta_pede_atencao_e_resposta_volta_a_trabalhar(self):
        ss = run(ev("UserPromptSubmit", 1), ev("PreToolUse", 2, tool_name="AskUserQuestion"))
        self.assertEqual(ss["s1"]["state"], "attention")
        state.apply(ss, ev("PostToolUse", 9, tool_name="AskUserQuestion"))
        self.assertEqual(ss["s1"]["state"], "working")

    def test_notificacao_de_permissao_e_de_ocioso(self):
        ss = run(ev("UserPromptSubmit", 1), ev("Notification", 2, notification_type="permission_prompt"))
        self.assertEqual(ss["s1"]["state"], "attention")
        state.apply(ss, ev("Notification", 3, notification_type="idle_prompt"))
        self.assertEqual(ss["s1"]["state"], "waiting")

    def test_subagente_usa_ferramenta_sem_mexer_no_principal(self):
        ss = run(ev("UserPromptSubmit", 1), ev("SubagentStart", 2, agent_id="a1", agent_type="Explore"),
                 ev("PreToolUse", 3, agent_id="a1", tool_name="Grep"))
        s = ss["s1"]
        self.assertEqual(s["subagents"]["a1"]["tool"], "Grep")
        self.assertEqual(s["tool"], "Agent")
        state.apply(ss, ev("SubagentStop", 4, agent_id="a1", agent_type="Explore"))
        self.assertEqual(s["subagents"]["a1"]["state"], "done")

    def test_fim_de_subagente_desconhecido_e_ignorado(self):
        ss = run(ev("UserPromptSubmit", 1), ev("SubagentStop", 2, agent_id="x9", agent_type=""))
        self.assertEqual(ss["s1"]["subagents"], {})

    def test_tarefa_do_subagente_e_pedido(self):
        feed = []
        ss = {}
        for e in (ev("UserPromptSubmit", 1, pedido="revisa o hub"),
                  ev("PreToolUse", 2, tool_name="Agent", tarefa="Survey hub", tipo="Explore"),
                  ev("SubagentStart", 3, agent_id="a1", agent_type="Explore"),
                  ev("SubagentStop", 4, agent_id="a1", agent_type="Explore"),
                  ev("Stop", 5)):
            state.apply(ss, e, feed)
        self.assertEqual(ss["s1"]["pedido"], "revisa o hub")
        self.assertEqual(ss["s1"]["subagents"]["a1"]["tarefa"], "Survey hub")
        self.assertEqual([(f["kind"], f["tarefa"]) for f in feed], [("sub", "Survey hub"), ("sessao", "revisa o hub")])

    def test_evento_atrasado_nao_volta_estado(self):
        ss = run(ev("Stop", 10), ev("UserPromptSubmit", 2))
        self.assertEqual(ss["s1"]["state"], "waiting")

    def test_fim_de_sessao_encerra_subagentes(self):
        ss = run(ev("SubagentStart", 1, agent_id="a1"), ev("SessionEnd", 2))
        self.assertEqual(ss["s1"]["state"], "ended")
        self.assertEqual(ss["s1"]["subagents"]["a1"]["state"], "done")


class Reconcile(unittest.TestCase):
    def test_sessao_so_no_registro_aparece(self):
        reg = {"s9": {"cwd": HUB, "name": "claude-x", "startedAt": 1000, "status": "busy", "statusUpdatedAt": 5000}}
        vis = state.reconcile({}, reg, {"s9": True}, now=10, silent_minutes=10, linger=20)
        self.assertEqual([(v["name"], v["state"]) for v in vis], [("claude-x", "working")])

    def test_processo_morto_sai_da_sala(self):
        ss = run(ev("UserPromptSubmit", 1))
        vis = state.reconcile(ss, {"s1": {"cwd": HUB}}, {"s1": False}, now=5, silent_minutes=10, linger=20)
        self.assertEqual(vis, [])

    def test_silencio_longo_sem_registro_sai(self):
        ss = run(ev("UserPromptSubmit", 1))
        self.assertEqual(state.reconcile(ss, {}, {}, now=1 + 601, silent_minutes=10, linger=20), [])

    def test_subagente_concluido_fica_um_pouco(self):
        ss = run(ev("UserPromptSubmit", 1), ev("SubagentStart", 2, agent_id="a1"), ev("SubagentStop", 3, agent_id="a1"))
        reg = {"s1": {"cwd": HUB}}
        self.assertEqual(len(state.reconcile(ss, reg, {"s1": True}, 10, 10, 20)[0]["subagents"]), 1)
        self.assertEqual(len(state.reconcile(ss, reg, {"s1": True}, 30, 10, 20)[0]["subagents"]), 0)


class Rooms(unittest.TestCase):
    def test_projeto_pelo_cwd(self):
        self.assertEqual(state.project_of(HUB, HUB), "")
        self.assertEqual(state.project_of(HUB + "/meu-app/web", HUB), "meu-app")
        self.assertEqual(state.project_of("/tmp/outro", HUB), "outro")

    def test_nome_do_projeto(self):
        self.assertEqual(state.project_label(HUB + "/meu-app/x", HUB, {"meu-app": "Meu App"}), "Meu App")


if __name__ == "__main__":
    unittest.main()
