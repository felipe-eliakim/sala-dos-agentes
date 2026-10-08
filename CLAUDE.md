# Sala dos Agentes

Escritório local em pixel art com a equipe de agentes do Claude Code e uma sala do usuário pra conversar com as sessões (canal MCP em `channel/`). Ver README.md para arquitetura, estados e roadmap.

- Sem dependências: Python stdlib no servidor/hook, JS puro (módulos ES) e canvas na página. Manter assim.
- O hook (`hook/capture.py`) roda a cada ferramenta de TODAS as sessões do usuário: tem que ser rápido e nunca falhar. Conteúdo: só o começo do pedido (100 letras) e a `description` do Agent, por decisão do usuário; nada de resposta nem entrada/saída de outras ferramentas.
- Canal (`channel/sala_channel.py`): MCP stdio escrito à mão (JSON-RPC por linha). Testar sem abrir o Claude: rodar o canal como processo filho e simular o host. Rotas `/api/canal/*` exigem o token; rotas da página exigem Origin/Host/X-Sala: não afrouxar.
- Lógica de estado fica em `server/state.py` (funções puras) com teste em `tests/test_state.py`: `python3 -m unittest discover tests`.
- Depois de mudar o servidor: `systemctl --user restart sala-dos-agentes`. A página não precisa de restart (sem cache).
- Testar visual com a demonstração (`ops/demo.py`, porta 8778). Na aba da extensão Claude em Chrome a animação é lenta; adiantar pelo console chamando `window.salaOffice.update(0.1, t)` em laço.
- Teste com Claude real num pseudo-terminal: limpar do ambiente as variáveis `CLAUDE*` herdadas desta sessão, senão a sessão filha não se registra em `~/.claude/sessions`.
- Cuidado com `pkill -f`/`pgrep -f` + `kill`: se o padrão aparece em qualquer parte do comando (inclusive num heredoc), mata o shell da sessão. Matar por PID obtido de `ss -ltnp` ou de `systemctl`.
- Repositório público: nada pessoal no git. Nome, pasta de projetos, nomes de projetos e departamentos extras ficam em `~/.config/sala-dos-agentes/` (modelo em `exemplos/`); `channel/mcp.json` e o `.service` são gerados por `ops/install.py`. Antes de commitar, procurar nomes, caminhos `/home/...` e e-mails no diff.
- Commits com o e-mail noreply do GitHub (configurado só neste repositório).
