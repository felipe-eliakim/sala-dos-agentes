// RH: ficha de contratação, lista dos contratados, editar e demitir.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const POST = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Sala": "1" }, body: JSON.stringify(body) });
const COR = { red: "#d65a5a", blue: "#3b82f6", green: "#3fae6a", yellow: "#e2b84a", purple: "#8a5cd6", orange: "#e07b39", pink: "#d6609a", cyan: "#2fb3c6" };

const TEMPLATES = [
  { rotulo: "🔍 Revisor de código", nome: "Rex", departamento: "Revisão de código", id: "revisor-de-codigo", cor: "red", modelo: "inherit", perms: ["ler", "terminal"],
    descricao: "Revisa mudanças de código procurando bugs de correção, segurança e casos esquecidos. Use depois de terminar uma funcionalidade e antes do commit.",
    instrucoes: "Você revisa código. Comece por `git diff` (ou pelos arquivos indicados).\n\n- Procure bugs reais: lógica errada, caso de borda esquecido, erro não tratado, problema de segurança.\n- Para cada achado: arquivo:linha, o que dá errado (um cenário concreto) e a correção sugerida.\n- Não reescreva o código e não comente estilo.\n- Termine com um veredito curto: pode commitar ou não." },
  { rotulo: "🧪 Testador", nome: "Tina", departamento: "Testes", id: "testador", cor: "green", modelo: "inherit", perms: ["ler", "editar", "terminal"],
    descricao: "Escreve e roda testes automatizados para o código indicado e informa o que falhou. Use quando uma funcionalidade nova precisa de testes ou quando algo quebrou.",
    instrucoes: "Você escreve testes.\n\n- Descubra o framework de testes que o projeto já usa e siga o padrão dele.\n- Cubra o caminho principal e os casos de borda mais prováveis.\n- Rode os testes e relate o resultado com a saída real.\n- Não altere o código de produção: se achar um bug, só descreva." },
  { rotulo: "📝 Redator de documentação", nome: "Duda", departamento: "Documentação", id: "redator-docs", cor: "yellow", modelo: "sonnet", perms: ["ler", "editar"],
    descricao: "Atualiza README, CLAUDE.md e documentação depois de mudanças no projeto, em português simples. Use ao terminar uma funcionalidade.",
    instrucoes: "Você mantém a documentação viva.\n\n- Leia o que mudou (git diff/log) e atualize README e CLAUDE.md na mesma linguagem e formato já usados.\n- Registre decisões e o porquê, não só o quê.\n- Frases curtas, sem jargão desnecessário.\n- Não invente funcionalidade que não existe." },
  { rotulo: "🌐 Pesquisador web", nome: "Wes", departamento: "Pesquisa externa", id: "pesquisador-web", cor: "cyan", modelo: "sonnet", perms: ["ler", "web"],
    descricao: "Pesquisa na internet (documentação, preços, bibliotecas, comparações) e volta com um resumo com fontes. Use quando a resposta não está no código.",
    instrucoes: "Você pesquisa na web.\n\n- Prefira fontes oficiais e recentes; anote a data quando importar.\n- Compare opções em tabela curta quando houver mais de uma.\n- Sempre liste as fontes (links) no fim.\n- Diga claramente o que não conseguiu confirmar." },
];

let editing = null, idTouched = false, list = [];

export async function openHire(onChange) {
  $("#hire").showModal();
  $("#templates").innerHTML = TEMPLATES.map((t, i) => `<button type="button" data-tpl="${i}">${esc(t.rotulo)}</button>`).join("");
  await refresh();
  resetForm();
  openHire.onChange = onChange;
}

async function refresh() {
  try { list = await (await fetch("/api/agentes", { cache: "no-store" })).json(); } catch { list = []; }
  $("#hired").innerHTML = list.map((a) => `<li style="--hc:${COR[a.cor] || "#7a8699"}">
      <b>${esc(a.nome)} <small>· ${esc(a.departamento)} · ${esc(a.id)}</small></b>
      <span>${esc(a.descricao.length > 140 ? a.descricao.slice(0, 139) + "…" : a.descricao)}</span>
      <div class="acts"><button type="button" data-edit="${esc(a.id)}">Editar ficha</button><button type="button" class="fire" data-fire="${esc(a.id)}">Demitir</button></div>
    </li>`).join("") || "<li>Ninguém contratado ainda.</li>";
}

function fill(v) {
  const f = $("#hire-form");
  for (const k of ["nome", "departamento", "id", "descricao", "instrucoes", "modelo", "cor"]) f.elements[k].value = v[k] ?? f.elements[k].value;
  const perms = new Set(v.perms || ["ler"]);
  for (const cb of f.querySelectorAll('[name="perm"]')) cb.checked = cb.value === "ler" || perms.has(cb.value);
}

function resetForm() {
  editing = null; idTouched = false;
  $("#hire-form").reset();
  $("#hire-form").elements.id.readOnly = false;
  $("#hire-title").textContent = "Nova contratação";
  $("#hire-form button[type=submit]").textContent = "Contratar";
  msg("");
}

function msg(text, kind = "") { const m = $("#hire-msg"); m.textContent = text; m.className = "hire-msg " + kind; }

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 41);

$("#hire-form").elements.nome.addEventListener("input", (e) => { if (!idTouched && !editing) $("#hire-form").elements.id.value = slug(e.target.value); });
$("#hire-form").elements.id.addEventListener("input", () => { idTouched = true; });
$("#hire-new").addEventListener("click", resetForm);
$("#close-hire").addEventListener("click", () => $("#hire").close());
$("#hire").addEventListener("click", (e) => { if (e.target === $("#hire")) $("#hire").close(); });

$("#templates").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tpl]"); if (!b) return;
  resetForm(); fill(TEMPLATES[+b.dataset.tpl]); idTouched = true;
  msg("Modelo carregado: ajuste o que quiser e clique em Contratar.");
});

$("#hired").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-edit]"), fi = e.target.closest("[data-fire]");
  if (ed) {
    const a = list.find((x) => x.id === ed.dataset.edit);
    resetForm(); editing = a.id; fill(a);
    $("#hire-form").elements.id.readOnly = true;
    $("#hire-title").textContent = `Editando ${a.nome}`;
    $("#hire-form button[type=submit]").textContent = "Salvar ficha";
  }
  if (fi) {
    if (fi.dataset.confirm !== "1") { fi.dataset.confirm = "1"; fi.textContent = "Confirmar demissão?"; return; }
    const r = await (await POST("/api/demitir", { id: fi.dataset.fire })).json();
    msg(r.msg, r.ok ? "ok" : "err");
    await refresh(); openHire.onChange?.();
  }
});

$("#hire-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const perms = [...f.querySelectorAll('[name="perm"]:checked')].map((c) => c.value);
  const body = { novo: !editing, perms };
  for (const k of ["nome", "departamento", "id", "descricao", "instrucoes", "modelo", "cor"]) body[k] = f.elements[k].value;
  const r = await (await POST("/api/contratar", body)).json();
  msg(r.msg, r.ok ? "ok" : "err");
  if (r.ok) { const keep = r.msg; await refresh(); resetForm(); msg(keep, "ok"); openHire.onChange?.(); }
});
