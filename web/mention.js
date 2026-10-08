// @nome na conversa: lista de agentes ao digitar "@", escolha com setas,
// Enter/Tab ou clique; ao enviar, devolve os tipos dos agentes citados.
const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export class Mentions {
  constructor(input, getAgents) {
    this.input = input;
    this.getAgents = getAgents;          // () => [{type, funcionario, nome, cor, descricao}]
    this.box = document.createElement("ul");
    this.box.className = "mentions";
    this.box.setAttribute("role", "listbox");
    this.box.hidden = true;
    input.parentElement.append(this.box);
    this.items = []; this.active = 0; this.range = null;
    input.addEventListener("input", () => this.update());
    input.addEventListener("keydown", (e) => this.key(e), true);   // antes do Enter que envia
    input.addEventListener("blur", () => setTimeout(() => this.close(), 150));
    this.box.addEventListener("mousedown", (e) => {
      const li = e.target.closest("[data-i]");
      if (li) { e.preventDefault(); this.pick(+li.dataset.i); }
    });
  }

  update() {
    const pos = this.input.selectionStart, before = this.input.value.slice(0, pos);
    const m = before.match(/(^|\s)@([\p{L}\d-]*)$/u);
    if (!m) return this.close();
    const q = norm(m[2]);
    this.range = [pos - m[2].length - 1, pos];
    this.items = this.getAgents().filter((a) => !q || [a.funcionario, a.type, a.nome].some((x) => norm(x).includes(q)))
      .sort((a, b) => norm(a.funcionario).startsWith(q) ? -1 : norm(b.funcionario).startsWith(q) ? 1 : 0).slice(0, 8);
    if (!this.items.length) return this.close();
    this.active = Math.min(this.active, this.items.length - 1);
    this.render();
  }

  render() {
    this.box.hidden = false;
    this.box.innerHTML = this.items.map((a, i) => `<li role="option" data-i="${i}" aria-selected="${i === this.active}">
      <i style="background:${esc(a.cor || "#7a8699")}"></i><b>@${esc(a.funcionario)}</b><span>${esc(a.nome)}</span></li>`).join("");
  }

  key(e) {
    if (this.box.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      this.active = (this.active + (e.key === "ArrowDown" ? 1 : -1) + this.items.length) % this.items.length;
      this.render();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault(); e.stopImmediatePropagation();
      this.pick(this.active);
    } else if (e.key === "Escape") { e.preventDefault(); this.close(); }
  }

  pick(i) {
    const a = this.items[i];
    if (!a || !this.range) return;
    const v = this.input.value, tag = "@" + a.funcionario.replace(/\s+/g, "") + " ";
    this.input.value = v.slice(0, this.range[0]) + tag + v.slice(this.range[1]);
    const caret = this.range[0] + tag.length;
    this.input.setSelectionRange(caret, caret);
    this.input.dispatchEvent(new Event("input", { bubbles: true }));   // reajusta a altura da caixa
    this.input.focus();
    this.close();
  }

  close() { this.box.hidden = true; this.range = null; this.active = 0; }

  // Tipos dos agentes citados no texto (por nome do funcionário ou pelo tipo).
  found(text) {
    const t = norm(text), out = [];
    const agents = [...this.getAgents()].sort((a, b) => b.funcionario.length - a.funcionario.length);
    for (const a of agents)
      for (const name of [a.funcionario.replace(/\s+/g, ""), a.type])
        if (new RegExp(`(^|\\s)@${norm(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d-])`, "u").test(t)) { out.push(a.type); break; }
    return [...new Set(out)];
  }
}
