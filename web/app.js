// Busca o estado a cada segundo, anima o escritório e cuida da conversa,
// da lista da equipe e do quadro de avisos.
import { Office } from "./office.js";
import { toolInfo, STATE_TEXT } from "./tools.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const POST = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Sala": "1" }, body: JSON.stringify(body) });

let data = null;
let chatSid = null;
let chatMsgs = [];
const chatActivity = {};        // sid -> última mensagem (qualquer lado), pro Claude ir até a sua sala
let selected = null;

const office = new Office($("#office"), {
  onBoard: openBoard,
  onSelect: (id) => { selected = id; showTab("team"); renderTeam(); document.getElementById("ag-" + CSS.escape(id))?.scrollIntoView({ block: "nearest" }); },
  onMe: () => { showTab("chat"); $("#chat-input").focus(); },
});

function ago(sec) {
  if (sec < 60) return "agora";
  const m = Math.floor(sec / 60);
  return m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h ${m % 60} min`;
}

// ---------- resumo e aviso ----------

function renderSummary() {
  let working = 0, attention = 0, waiting = 0, subs = 0;
  for (const s of data.sessions) {
    if (s.state === "working") working++; else if (s.state === "attention") attention++; else waiting++;
    subs += s.subagents.filter((x) => x.state === "working").length;
  }
  const parts = [];
  if (attention) parts.push(`<span class="pill attention">${attention} precisa${attention > 1 ? "m" : ""} de você</span>`);
  parts.push(`<span class="pill working">${working} trabalhando</span>`, `<span class="pill waiting">${waiting} esperando</span>`);
  if (subs) parts.push(`<span class="pill sub">${subs} subagente${subs > 1 ? "s" : ""}</span>`);
  $("#summary").innerHTML = parts.join("");
  const perms = data.board.permissoes.length;
  document.title = (attention + perms ? `(${attention + perms}❗) ` : "") + "Sala dos Agentes";
  setNotice(data.hooks ? "" : "Hooks ainda não instalados: rode <code>python3 ops/hooks.py install</code>.");
}

function setNotice(html) { $("#notice").innerHTML = html; $("#notice").hidden = !html; }

// ---------- equipe: o que cada um está fazendo ----------

function teamEntries() {
  const out = [];
  const subsByType = {};
  for (const s of data.sessions) for (const sub of s.subagents) if (sub.state === "working") (subsByType[sub.type] ||= []).push({ ...sub, boss: s.projeto });
  out.push({ dept: "Diretoria", cor: "#ffd166", items: data.sessions.length ? data.sessions.map((s) => ({
    id: s.id, nome: s.projeto || "Claude", extra: s.name + (s.canal ? " · ligado à sala" : ""), state: s.state, tool: s.tool,
    task: s.pedido ? `Pedido: “${s.pedido}”` : "", since: s.since })) : [{ id: "res:claude", nome: "Claude", extra: "nenhuma sessão aberta", state: "idle" }] });
  for (const d of data.departments) {
    const subs = subsByType[d.type] || [];
    const items = subs.length ? subs.map((sub, i) => ({
      id: i === 0 ? "res:" + d.type : sub.id, nome: i === 0 ? d.funcionario : `${d.funcionario} (reforço)`,
      extra: `pra ${sub.boss}`, state: "working", tool: sub.tool, task: sub.tarefa ? `Tarefa: ${sub.tarefa}` : "", since: sub.started,
    })) : [{ id: "res:" + d.type, nome: d.funcionario, extra: d.type, state: "idle" }];
    out.push({ dept: d.nome, cor: d.cor, items });
  }
  return out;
}

function renderTeam() {
  if (!data) return;
  const now = data.now;
  $("#team").innerHTML = teamEntries().map((g) => `<li><h3><i style="background:${esc(g.cor)}"></i>${esc(g.dept)}</h3>` +
    g.items.map((a) => {
      const st = a.state === "idle" ? "na copa" : a.state === "working" ? `${toolInfo(a.tool).verb}` : STATE_TEXT[a.state] || a.state;
      return `<div class="agent${selected === a.id ? " sel" : ""}" id="ag-${esc(a.id)}" data-id="${esc(a.id)}" tabindex="0">
        <div class="row"><b>${esc(a.nome)}</b><span class="st ${esc(a.state)}">${esc(st)}${a.since && a.state !== "idle" ? " · " + ago(now - a.since) : ""}</span></div>
        <span class="task">${esc(a.task || "")}</span><small>${esc(a.extra || "")}</small></div>`;
    }).join("") + "</li>").join("");
}

$("#team").addEventListener("click", (e) => {
  const a = e.target.closest("[data-id]");
  if (!a) return;
  selected = office.selected = a.dataset.id;
  renderTeam();
});

// ---------- quadro de avisos ----------

function boardCount() {
  const b = data.board;
  return b.permissoes.length + data.sessions.filter((s) => s.state === "attention").length + b.recados.length;
}

function renderBoard() {
  const b = data.board, now = data.now;
  const askers = data.sessions.filter((s) => s.state === "attention");
  const col = (title, html) => `<div class="col"><h3>${title}</h3>${html || '<p class="empty-col">Nada por aqui.</p>'}</div>`;
  const tilt = (i) => `style="--r:${((i * 37) % 5) - 2}deg"`;
  $("#board-body").innerHTML = [
    col("Pedidos pra você",
      b.permissoes.map((p, i) => `<div class="note red" ${tilt(i)}><b>Permissão: ${esc(p.tool_name)}</b><br>${esc(p.description)}<small>${ago(now - p.t)} · responda na sua sala</small></div>`).join("") +
      askers.map((s, i) => `<div class="note red" ${tilt(i + 3)}><b>${esc(s.projeto || "Claude")}</b> está esperando sua resposta no terminal<small>${esc(s.name)} · ${ago(now - s.since)}</small></div>`).join("")),
    col("Recados do Claude", b.recados.map((n, i) => `<div class="note" ${tilt(i)}>${esc(n.texto)}<small>${esc(n.quem)} · ${ago(now - n.t)}</small><button type="button" data-del="${esc(n.id)}">Tirar do quadro</button></div>`).join("")),
    col("Concluídas", b.concluidas.slice(0, 15).map((f, i) => `<div class="note green" ${tilt(i)}>${esc(f.tarefa)}<small>${esc(f.kind === "sub" ? f.quem : "Claude")} · ${esc(f.projeto || "hub")} · ${ago(now - f.t)}</small></div>`).join("")),
    col("Depende de você (hub)", b.hub.map((h, i) => `<div class="note blue" ${tilt(i)}><b>${esc(h.projeto)}.</b> ${esc(h.texto)}</div>`).join("")),
  ].join("");
}

function openBoard() { renderBoard(); $("#board").showModal(); }
$("#open-board").addEventListener("click", openBoard);
$("#close-board").addEventListener("click", () => $("#board").close());
$("#board").addEventListener("click", async (e) => {
  if (e.target === $("#board")) return $("#board").close();
  const del = e.target.closest("[data-del]");
  if (del) { await POST("/api/recado/apagar", { id: del.dataset.del }); await poll(true); renderBoard(); }
});

// ---------- conversa ----------

function md(text) {
  // markdown mínimo: blocos de código, `código`, **negrito**, links e parágrafos
  const blocks = String(text).split(/```/);
  return blocks.map((b, i) => {
    if (i % 2) return `<pre>${esc(b.replace(/^\w*\n/, ""))}</pre>`;
    return esc(b).split(/\n{2,}/).filter((p) => p.trim()).map((p) => "<p>" + p
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, "<br>") + "</p>").join("");
  }).join("");
}

function renderChatSessions() {
  const sel = $("#chat-session");
  const sessions = data.sessions;
  if (!chatSid || !sessions.some((s) => s.id === chatSid)) chatSid = (sessions.find((s) => s.canal) || sessions[0])?.id || null;
  const html = sessions.map((s) => `<option value="${esc(s.id)}"${s.id === chatSid ? " selected" : ""}>${s.canal ? "● " : "○ "}${esc(s.projeto || "Claude")} · ${esc(s.name)}</option>`).join("");
  if (sel.dataset.html !== html) { sel.innerHTML = html || "<option>nenhuma sessão aberta</option>"; sel.dataset.html = html; }
  const cur = sessions.find((s) => s.id === chatSid);
  const on = !!cur?.canal;
  $("#chat-off").hidden = on;
  $("#chat-off").innerHTML = cur
    ? "Esta sessão não está ligada à sala. Pra conversar por aqui, abra o Claude no terminal com <code>claude-sala</code> (na pasta do projeto) e ela aparece com ● nesta lista."
    : "Nenhuma sessão do Claude aberta. Abra uma com <code>claude-sala</code> no terminal.";
  $("#chat-input").disabled = $("#chat-form button").disabled = !on;
}

$("#chat-session").addEventListener("change", (e) => { chatSid = e.target.value; chatMsgs = []; renderChatSessions(); loadChat(); });

async function loadChat() {
  if (!chatSid) { $("#chat-log").innerHTML = ""; return; }
  try {
    const msgs = await (await fetch(`/api/chat?sid=${encodeURIComponent(chatSid)}`, { cache: "no-store" })).json();
    const changed = JSON.stringify(msgs) !== JSON.stringify(chatMsgs);
    for (const m of msgs) if (m.de === "claude" && !chatMsgs.some((x) => x.id === m.id) && chatMsgs.length) chatActivity[chatSid] = m.t;
    chatMsgs = msgs;
    if (changed) renderChat();
  } catch { /* servidor fora: o aviso geral já mostra */ }
}

function renderChat() {
  const log = $("#chat-log");
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  const pending = new Set(data?.board.permissoes.map((p) => p.request_id));
  log.innerHTML = chatMsgs.map((m) => {
    const hora = new Date(m.t * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (m.perm) {
      const open = pending.has(m.perm) && !m.resposta;
      return `<li class="perm"><b>🔐 ${esc(m.texto)}</b><div>${esc(m.detalhe || "")}</div>${m.previa ? `<pre>${esc(m.previa)}</pre>` : ""}
        ${open ? `<div class="actions"><button class="allow" data-perm="${esc(m.perm)}" data-b="allow">Permitir</button><button class="deny" data-perm="${esc(m.perm)}" data-b="deny">Negar</button></div>`
               : `<small>${esc(m.resposta || "respondido no terminal")}</small>`}</li>`;
    }
    const tick = m.de === "voce" ? (m.entregue ? " · ✓ entregue" : " · enviando…") : "";
    return `<li class="msg ${esc(m.de)}">${m.de === "sistema" ? esc(m.texto) : md(m.texto)}<span class="meta">${hora}${tick}</span></li>`;
  }).join("");
  if (atBottom) log.scrollTop = log.scrollHeight;
}

$("#chat-log").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-perm]");
  if (!b) return;
  b.parentElement.innerHTML = "<small>enviando…</small>";
  await POST("/api/permissao", { request_id: b.dataset.perm, behavior: b.dataset.b });
  await poll(true);
  loadChat();
});

$("#chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#chat-input").value.trim();
  if (!text || !chatSid) return;
  $("#chat-input").value = "";
  const res = await POST("/api/chat", { sid: chatSid, text });
  if (res.ok) { office.userTalking = Date.now() / 1000; chatActivity[chatSid] = Date.now() / 1000; }
  loadChat();
  const log = $("#chat-log"); log.scrollTop = log.scrollHeight;
});
$("#chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chat-form").requestSubmit(); }
});

// ---------- abas ----------

function showTab(name) {
  for (const t of ["chat", "team"]) {
    $(`#tab-${t}`).setAttribute("aria-selected", t === name);
    $(`#panel-${t}`).hidden = t !== name;
  }
  if (name === "team") renderTeam();
}
$("#tab-chat").addEventListener("click", () => showTab("chat"));
$("#tab-team").addEventListener("click", () => showTab("team"));

// ---------- laço ----------

let failures = 0, timer = null;
async function poll(once) {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
    failures = 0;
    renderSummary();
    office.boardCount = boardCount();
    office.boardPapers = office.boardCount + data.board.hub.length + data.board.concluidas.length;
    $("#board-count").textContent = office.boardCount;
    $("#board-count").hidden = !office.boardCount;
    office.sync(data, chatActivity);
    renderChatSessions();
    if (!$("#panel-team").hidden) renderTeam();
    if ($("#board").open) renderBoard();
    await loadChat();
  } catch (err) {
    console.error(err);
    if (++failures >= 2) setNotice("Servidor da sala parado. Rode <code>systemctl --user start sala-dos-agentes</code>.");
  }
  if (!once) { clearTimeout(timer); timer = setTimeout(poll, 1000); }
}

let last = performance.now();
function frame(ms) {
  const dt = Math.min(0.5, (ms - last) / 1000); // aba lenta não congela o escritório
  last = ms;
  office.update(dt, ms / 1000);
  office.draw(ms / 1000);
  requestAnimationFrame(frame);
}

window.salaOffice = office; // facilita inspecionar pelo console
addEventListener("resize", () => office.resize());
poll();
requestAnimationFrame(frame);
