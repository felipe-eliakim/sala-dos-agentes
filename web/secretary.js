// Lia, a secretária: observa o escritório e vem até a sua sala avisar, sem
// você pedir. Regras fixas (sem IA): pedidos urgentes, tarefas concluídas,
// sessão esperando há muito tempo, resumo do dia e lembretes periódicos.
import { toolInfo } from "./tools.js";

const KEY = "sala-secretaria";
const DEFAULTS = { lembretesMin: 60, som: true, notificar: false };
const DAY = 86400;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export class Secretary {
  constructor() {
    const saved = load();
    this.settings = { ...DEFAULTS, ...saved.settings };
    this.shown = saved.shown || {};          // chave -> quando foi mostrado (s)
    this.queue = [];
    this.current = null;
    this.first = true;
    this.lastReminder = saved.lastReminder || 0;
  }

  save() {
    const now = Date.now() / 1000;
    for (const [k, t] of Object.entries(this.shown)) if (now - t > 7 * DAY) delete this.shown[k];
    try { localStorage.setItem(KEY, JSON.stringify({ settings: this.settings, shown: this.shown, lastReminder: this.lastReminder })); } catch { /* sem armazenamento */ }
  }

  push(key, msg, silentOnFirst = false) {
    if (this.shown[key] || this.queue.some((m) => m.key === key) || this.current?.key === key) return;
    if (this.first && silentOnFirst) { this.shown[key] = Date.now() / 1000; return; }   // o que já tinha acontecido antes de abrir
    this.queue.push({ key, ...msg });
    this.queue.sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0));
  }

  // Chamado a cada atualização do estado. projects pode estar vazio.
  observe(data, projects) {
    const now = data.now;
    const proj = (s) => s.projeto || "Hub";
    for (const s of data.sessions) {
      if (s.state === "attention")
        this.push(`att:${s.id}:${Math.floor(s.since)}`, { urgente: true, texto: `A equipe **${proj(s)}** precisa de você: ${toolInfo(s.tool).verb}. Responda no terminal${s.canal ? " ou aqui pela sua sala" : ""}.`,
          acao: { rotulo: s.canal ? "Abrir conversa" : "Ver equipe", tipo: "chat", sid: s.id } });
      if (s.state === "waiting" && s.pedido && now - s.since > 30 * 60)
        this.push(`wait:${s.id}:${Math.floor(s.since)}`, { texto: `A equipe **${proj(s)}** terminou e está esperando você há ${Math.round((now - s.since) / 60)} min. O último pedido foi: “${s.pedido}”.` }, true);
    }
    for (const p of data.board.permissoes)
      this.push(`perm:${p.request_id}`, { urgente: true, texto: `Pedido de permissão: **${p.tool_name}**. ${p.description || ""}`, acao: { rotulo: "Responder", tipo: "chat", sid: p.sid } });
    for (const f of data.board.concluidas)
      this.push(`done:${Math.floor(f.t)}:${f.quem}`, { texto: f.kind === "sub"
        ? `O **${f.quem}** terminou uma tarefa em ${f.projeto || "Hub"}: ${f.tarefa}.`
        : `A equipe **${f.projeto || "Hub"}** terminou: “${f.tarefa}”.`,
        acao: data.sessions.some((s) => s.id === f.session && s.canal) ? { rotulo: "Abrir equipe", tipo: "chat", sid: f.session } : null }, true);

    // resumo do dia, na primeira vez que a sala é aberta no dia
    const today = new Date().toISOString().slice(0, 10);
    if (this.first) {
      const hora = new Date().getHours();
      const oi = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
      const sujos = projects.filter((p) => p.pendentes).length;
      const partes = [`${data.sessions.length} ${data.sessions.length === 1 ? "sessão aberta" : "sessões abertas"}`];
      if (data.board.hub.length) partes.push(`${data.board.hub.length} pendências esperando você nos projetos`);
      if (sujos) partes.push(`${sujos} ${sujos === 1 ? "projeto" : "projetos"} com mudanças sem commit`);
      if (data.board.recados.length) partes.push(`${data.board.recados.length} recado(s) no quadro`);
      this.push(`brief:${today}`, { texto: `${oi}! Resumo de hoje: ${partes.join(", ")}.`, acao: { rotulo: "Ver projetos", tipo: "projetos" } });
    }

    // lembretes periódicos: um por vez, sem repetir o mesmo em 24 h
    const freq = this.settings.lembretesMin * 60;
    if (freq > 0 && !this.first && now - this.lastReminder > freq && !this.queue.length && !this.current) {
      const cands = [
        ...data.board.hub.map((h) => ({ key: `lemb:hub:${h.projeto}`, texto: `Lembrete de **${h.projeto}**: ${h.texto}`, acao: { rotulo: "Ver projeto", tipo: "projetos" } })),
        ...projects.filter((p) => p.pendentes && p.commit_t && now - p.commit_t > DAY).map((p) => ({ key: `lemb:sujo:${p.dir}`,
          texto: `**${p.nome}** tem ${p.pendentes} mudança(s) sem commit, e o último commit foi há ${Math.round((now - p.commit_t) / DAY)} dia(s). Quer pedir pro Claude salvar?`, acao: { rotulo: "Ver projeto", tipo: "projetos" } })),
        ...projects.filter((p) => p.commit_t && !p.remoto).map((p) => ({ key: `lemb:remoto:${p.dir}`,
          texto: `**${p.nome}** ainda não tem cópia no GitHub: se o notebook der problema, o código se perde.`, acao: { rotulo: "Ver projeto", tipo: "projetos" } })),
        ...data.board.recados.filter((n) => now - n.t > DAY).map((n) => ({ key: `lemb:recado:${n.id}`, texto: `Tem um recado no quadro desde ${new Date(n.t * 1000).toLocaleDateString("pt-BR")}: “${n.texto}”`, acao: { rotulo: "Abrir quadro", tipo: "quadro" } })),
      ].filter((c) => !this.shown[c.key] || now - this.shown[c.key] > DAY);
      if (cands.length) {
        const c = cands[Math.floor(Math.random() * cands.length)];
        delete this.shown[c.key];
        this.push(c.key, c);
      }
      this.lastReminder = now;
    }
    this.first = false;
    this.save();
  }

  // Recado da própria sala (ex.: "abri o terminal da nova equipe"): vai na frente da fila.
  say(texto, acao = null, urgente = false) {
    this.queue.unshift({ key: `info:${Date.now()}:${Math.random()}`, texto, acao, urgente, info: true });
  }

  // Próximo aviso a entregar (a Lia anda até você com ele).
  take() {
    if (this.current || !this.queue.length) return null;
    this.current = this.queue.shift();
    return this.current;
  }

  done(later = false) {
    if (!this.current) return;
    const m = this.current;
    this.current = null;
    if (later) {
      // volta daqui a 30 min
      setTimeout(() => { delete this.shown[m.key]; this.push(m.key, m); }, 30 * 60 * 1000);
    }
    this.shown[m.key] = Date.now() / 1000;
    this.save();
  }
}
