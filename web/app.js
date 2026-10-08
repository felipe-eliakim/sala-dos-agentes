// Busca o estado a cada segundo, anima o escritório e cuida da conversa,
// da lista da equipe e do quadro de avisos.
import { Office } from "./office.js";
import { toolInfo, STATE_TEXT } from "./tools.js";
import { drawPerson, looks } from "./people.js";

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
  onSelect: (id) => { selected = id; showTab("team"); renderTeam(); renderFicha(); },
  onMe: () => { showTab("chat"); $("#chat-input").focus(); },
  onLayout: renderRoomsNav,
});

// ---------- navegação ----------

function renderRoomsNav(rooms) {
  $("#rooms-nav").innerHTML = `<button type="button" data-room="tudo">🏢 Tudo</button>` +
    rooms.map((r) => `<button type="button" data-room="${esc(r.id)}"><i style="background:${esc(r.cor)}"></i>${esc(r.nome)}<span class="busy" data-busy="${esc(r.id)}"></span></button>`).join("");
}
function updateRoomsBusy() {
  const count = {};
  for (const c of office.chars.values()) if (c.mode === "work" && !c.leaving && c.home) {
    const id = c.home.kind === "dept" ? c.home.type : c.home.kind;
    count[id] = (count[id] || 0) + 1;
  }
  for (const el of document.querySelectorAll("[data-busy]")) el.textContent = count[el.dataset.busy] ? `● ${count[el.dataset.busy]}` : "";
}
$("#rooms-nav").addEventListener("click", (e) => {
  const b = e.target.closest("[data-room]");
  if (b) { office.goToRoom(b.dataset.room); setFollow(false); }
});
function setFollow(on) {
  if (on && !office.followSelected()) on = false;
  if (!on) office.camera.follow = null;
  $("#follow").setAttribute("aria-pressed", on);
}
$("#zoom-in").addEventListener("click", () => office.camera.zoomBy(1.4));
$("#zoom-out").addEventListener("click", () => office.camera.zoomBy(1 / 1.4));
$("#zoom-fit").addEventListener("click", () => { setFollow(false); office.camera.fit(); });
$("#follow").addEventListener("click", () => {
  const on = $("#follow").getAttribute("aria-pressed") !== "true";
  if (on && !office.selected) { showTab("team"); $("#team").animate?.([{ outline: "2px solid #ffd166" }, { outline: "none" }], 900); return; }
  setFollow(on);
});

function ago(sec) {
  if (sec < 60) return "agora";
  const m = Math.floor(sec / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h ${m % 60} min`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : d < 30 ? `há ${d} dias` : `há ${Math.round(d / 30)} ${Math.round(d / 30) > 1 ? "meses" : "mês"}`;
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
    out.push({ dept: d.nome, cor: d.cor, items, desc: d.descricao });
  }
  return out;
}

function renderTeam() {
  if (!data) return;
  const now = data.now;
  $("#team").innerHTML = teamEntries().map((g) => `<li><h3><i style="background:${esc(g.cor)}"></i>${esc(g.dept)}</h3>` +
    (g.desc ? `<div class="desc">${esc(g.desc.split(". ")[0].replace(/\.$/, ""))}.</div>` : "") +
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
  renderFicha();
  setFollow(true);          // escolheu na lista: a câmera vai até ele
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

// ---------- ficha do personagem ----------

function profileOf(id) {
  if (!data) return null;
  const s = data.sessions.find((x) => x.id === id);
  if (s || id === "res:claude") return {
    nome: s ? s.projeto || "Claude" : "Claude", dept: "Diretoria", cor: "#ffd166",
    descricao: "Sessão principal do Claude Code: é quem conversa com você, lê e escreve o código e chama os outros agentes quando precisa.",
    quando: s ? `Aberta em ${s.projeto || "?"} (${s.name}). ${s.canal ? "Ligada à sala: dá pra conversar pela aba Sua sala." : "Não está ligada à sala (abra com claude-sala pra conversar por aqui)."}` : "Nenhuma sessão aberta agora.",
    agora: s ? (s.state === "working" ? `Trabalhando · ${toolInfo(s.tool).verb}` : STATE_TEXT[s.state] || s.state) + (s.pedido ? ` — “${s.pedido}”` : "") : "",
  };
  const type = id.startsWith("res:") ? id.slice(4) : office.chars.get(id)?.type;
  const d = data.departments.find((x) => x.type === type);
  if (!d) return null;
  const c = office.chars.get(id);
  return { nome: d.funcionario + (id.startsWith("res:") ? "" : " (reforço)"), dept: `${d.nome} · ${d.type}${d.proprio ? " · criado por você" : ""}`, cor: d.cor,
    descricao: d.descricao, quando: d.quando,
    agora: c?.mode === "work" ? `Trabalhando pra ${c.boss || "?"} · ${toolInfo(c.tool).verb}${c.tarefa ? ` — ${c.tarefa}` : ""}` : "Livre, lanchando na copa." };
}

function renderFicha() {
  const box = $("#ficha");
  const p = selected && profileOf(selected);
  box.hidden = !p;
  if (!p) return;
  box.style.setProperty("--fc", p.cor);
  box.innerHTML = `<canvas width="64" height="112" aria-hidden="true"></canvas>
    <div><h3>${esc(p.nome)}</h3><span class="dept">${esc(p.dept)}</span></div>
    <p><span class="lbl">O que faz</span>${esc(p.descricao)}</p>
    ${p.quando ? `<p><span class="lbl">Quando entra em cena</span>${esc(p.quando)}</p>` : ""}
    ${p.agora ? `<p class="now">${esc(p.agora)}</p>` : ""}
    <button class="close" type="button" aria-label="Fechar ficha">✕</button>`;
  drawPortrait(box.querySelector("canvas"));
}

function drawPortrait(cv) {
  const c = office.chars.get(selected);
  const lk = c?.look || looks(selected, "#7a8699");
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawPerson(ctx, 7, 4.6, 15.2, lk, "front", "stand", performance.now() / 1000, { seed: 1 });
}
setInterval(() => { const cv = $("#ficha canvas"); if (cv && !$("#panel-team").hidden) drawPortrait(cv); }, 250);

$("#ficha").addEventListener("click", (e) => {
  if (e.target.closest(".close")) { selected = office.selected = null; setFollow(false); renderFicha(); renderTeam(); }
});

// ---------- projetos ----------

const STATUS = { live: ["No ar", "#2f9e5b"], build: ["Em construção", "#c08a1a"], plan: ["Planejamento", "#8f4fb3"], idea: ["Ideia", "#7c8597"], "": ["Sem status", "#7c8597"] };
let projectsData = [], projFilter = "todos", projTimer = null, lastLiveKey = "";

async function loadProjects() {
  clearTimeout(projTimer);
  try { projectsData = await (await fetch("/api/projetos", { cache: "no-store" })).json(); } catch { /* aviso geral cobre */ }
  renderProjects();
  if (!$("#panel-proj").hidden) projTimer = setTimeout(loadProjects, 30000);
}

function activeIn(dir) { return (data?.sessions || []).filter((s) => s.dir === dir); }

function renderProjects() {
  const counts = { todos: projectsData.length, ativos: projectsData.filter((p) => activeIn(p.dir).length).length,
    voce: projectsData.filter((p) => p.voce).length };
  for (const k of ["live", "build", "plan", "idea"]) counts[k] = projectsData.filter((p) => p.status === k).length;
  const chips = [["todos", "Todos"], ["ativos", "● Agora"], ["voce", "Com você"], ["live", "No ar"], ["build", "Em construção"], ["plan", "Planejamento"], ["idea", "Ideia"]];
  $("#proj-filters").innerHTML = chips.filter(([k]) => counts[k] || k === "todos").map(([k, t]) =>
    `<button type="button" data-f="${k}" aria-pressed="${projFilter === k}">${t} ${counts[k]}</button>`).join("");
  const list = projectsData.filter((p) => projFilter === "todos" ? true : projFilter === "ativos" ? activeIn(p.dir).length
    : projFilter === "voce" ? p.voce : p.status === projFilter);
  const now = Date.now() / 1000;
  $("#projects").innerHTML = list.map((p) => {
    const [st, cor] = STATUS[p.status] || STATUS[""];
    const live = activeIn(p.dir);
    const git = p.semgit ? `<span class="warn">sem git</span>` : p.commit_t
      ? `último commit ${ago(now - p.commit_t)} · ${esc(p.commit)}` : "sem commits";
    const warns = [p.pendentes ? `${p.pendentes} mudança${p.pendentes > 1 ? "s" : ""} sem commit` : "", !p.semgit && p.commit_t && !p.remoto ? "sem cópia no GitHub" : ""].filter(Boolean);
    return `<li class="proj" style="--pc:${cor}">
      <div class="top"><h4>${p.n && p.n < 999 ? `<span class="area">#${String(p.n).padStart(2, "0")}</span> ` : ""}${esc(p.nome)}</h4><span class="st">${st}</span></div>
      ${p.area ? `<span class="area">${esc(p.area)} · ~/${esc(p.dir)}</span>` : `<span class="area">~/${esc(p.dir)}</span>`}
      ${live.map((s) => `<button class="live" type="button" data-follow="${esc(s.id)}">● ${esc(s.name)} ${s.state === "working" ? "trabalhando aqui agora" : s.state === "attention" ? "precisa de você" : "aberto aqui"} — ver no escritório</button>`).join("")}
      ${p.proximo ? `<div><b>Próximo:</b> ${esc(p.proximo)}</div>` : ""}
      ${p.voce ? `<div class="you"><b>Com você:</b> ${esc(p.voce)}</div>` : ""}
      <div class="git">${git}${warns.length ? ` · <span class="warn">${warns.join(" · ")}</span>` : ""}</div>
      ${p.links.length ? `<div class="links">${p.links.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join("")}</div>` : ""}
      ${p.desc || p.historico.length ? `<details><summary>Detalhes</summary>${p.desc ? `<p>${esc(p.desc)}</p>` : ""}${p.stack ? `<p><b>Stack:</b> ${esc(p.stack)}</p>` : ""}
        ${p.historico.length ? `<ul>${p.historico.map(([d, t]) => `<li>${esc(d.split("-").reverse().join("/"))} — ${esc(t)}</li>`).join("")}</ul>` : ""}</details>` : ""}
    </li>`;
  }).join("") || `<li class="empty-col">Nenhum projeto ${projectsData.length ? "com esse filtro" : "encontrado (defina pasta_projetos em ~/.config/sala-dos-agentes/config.json)"}.</li>`;
}

$("#proj-filters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]"); if (!b) return;
  projFilter = b.dataset.f; renderProjects();
});
$("#projects").addEventListener("click", (e) => {
  const b = e.target.closest("[data-follow]"); if (!b) return;
  selected = office.selected = b.dataset.follow;
  setFollow(true);
});

// ---------- abas ----------

function showTab(name) {
  for (const t of ["chat", "team", "proj"]) {
    $(`#tab-${t}`).setAttribute("aria-selected", t === name);
    $(`#panel-${t}`).hidden = t !== name;
  }
  if (name === "team") { renderTeam(); renderFicha(); }
  if (name === "proj") loadProjects();
}
$("#tab-chat").addEventListener("click", () => showTab("chat"));
$("#tab-team").addEventListener("click", () => showTab("team"));
$("#tab-proj").addEventListener("click", () => showTab("proj"));

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
    updateRoomsBusy();
    if ($("#follow").getAttribute("aria-pressed") === "true" && !office.camera.follow) setFollow(false);
    renderChatSessions();
    if (!$("#panel-team").hidden) { renderTeam(); renderFicha(); }
    // só redesenha os projetos quando muda quem está trabalhando onde (senão fecha os "Detalhes" abertos)
    const liveKey = JSON.stringify(data.sessions.map((x) => [x.id, x.dir, x.state]));
    if (!$("#panel-proj").hidden && projectsData.length && liveKey !== lastLiveKey) renderProjects();
    lastLiveKey = liveKey;
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
