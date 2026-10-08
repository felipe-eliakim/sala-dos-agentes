// O que cada ferramenta do Claude Code vira na sala: ícone do balão e verbo.
const TOOL_GROUPS = [
  { match: /^(Read|Glob|Grep|LS|NotebookRead)$/, icon: "📖", verb: "lendo" },
  { match: /^(Edit|MultiEdit|Write|NotebookEdit)$/, icon: "✏️", verb: "escrevendo" },
  { match: /^Bash|^Monitor$/, icon: "⌨️", verb: "no terminal" },
  { match: /^(WebFetch|WebSearch)$/, icon: "🌐", verb: "pesquisando" },
  { match: /^(Agent|Task|SendMessage)$/, icon: "📋", verb: "delegando" },
  { match: /^(TodoWrite|TaskCreate|TaskUpdate|EnterPlanMode)$/, icon: "🗒️", verb: "planejando" },
  { match: /^(AskUserQuestion|ExitPlanMode)$/, icon: "❓", verb: "perguntou algo" },
  { match: /^mcp__claude-in-chrome|Browser/, icon: "🧭", verb: "no navegador" },
  { match: /^Artifact/, icon: "📤", verb: "publicando" },
  { match: /^Skill$/, icon: "🎓", verb: "lendo um skill" },
  { match: /^mcp__/, icon: "🔌", verb: "usando um conector" },
];

export function toolInfo(tool) {
  if (!tool) return { icon: "💭", verb: "pensando" };
  return TOOL_GROUPS.find((g) => g.match.test(tool)) || { icon: "🔧", verb: "usando " + tool };
}

export const STATE_TEXT = {
  working: "trabalhando",
  waiting: "esperando você",
  attention: "precisa de você",
  done: "terminou",
};
