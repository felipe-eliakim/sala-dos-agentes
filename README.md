# Sala dos Agentes

Um escritório em pixel art com toda a equipe de agentes do [Claude Code](https://claude.com/claude-code) trabalhando em tempo real, e uma sala sua de onde você conversa com as sessões sem ficar no terminal.

Roda local, em `http://127.0.0.1:8777`. Linux com systemd de usuário, Python 3.10+ e Claude Code. Nenhuma dependência para instalar: Python padrão no servidor, JavaScript puro e canvas na página.

## O que tem no escritório

- **Diretoria:** cada sessão do Claude Code aberta é um bonequinho de boné amarelo, com o nome do projeto. Trabalhando = senta na mesa e digita, com um balão da ferramenta em uso (📖 lendo, ✏️ escrevendo, ⌨️ terminal, 🌐 pesquisando, 📋 delegando). Esperando você = vai lanchar na copa. Pedindo permissão ou fazendo uma pergunta = vai até a sua sala com ❗.
- **Departamentos, um por tipo de agente** (Pesquisa = Explore, Planejamento = Plan, Operações = general-purpose, Plantão, Suporte Claude Code, Configuração). O funcionário de cada um está **sempre** no escritório: quando uma sessão chama aquele agente, ele sai da copa e senta na mesa do departamento; se chamarem dois ao mesmo tempo, entra um "reforço" pela porta. Agentes que você criar em `~/.claude/agents/` ganham departamento sozinhos.
- **Copa:** quem está livre fica lá comendo e tomando café, e troca de lugar de vez em quando.
- **Quadro de avisos** (no corredor, ou o botão 📌): abre grande, com pedidos pra você, recados que o Claude fixa, tarefas concluídas e, opcionalmente, pendências de um painel de projetos.
- **Equipe** (aba lateral): o que cada um está fazendo agora: o pedido de cada sessão, a tarefa de cada subagente, a ferramenta e há quanto tempo. Clicando num personagem (no escritório ou na lista) abre a **ficha** dele: retrato, o que faz, quando entra em cena e o que está fazendo. Os textos dos agentes embutidos estão em `departamentos.json`; os dos agentes que você criou vêm do `description` do próprio arquivo em `~/.claude/agents/`.
- **Projetos** (aba lateral): cada subpasta da `pasta_projetos`, com último commit, mudanças sem commit, aviso de "sem cópia no GitHub" e qual sessão está trabalhando nele agora (com atalho pra ver no escritório). Se houver um `painel.html` (ver Configurar), entram também status, área, próximo passo, o que depende de você, links e histórico. Filtros: agora, com você e por status.
- **RH (Rita):** clique nela, na sala do RH ou no botão 🤝 Contratar. A ficha de contratação pede nome, departamento, o que o agente faz (é por essa descrição que o Claude decide quando chamá-lo), instruções, permissões em linguagem simples (ler, pesquisar na web, editar arquivos, usar o terminal, tudo), modelo e cor; há modelos prontos (revisor de código, testador, redator de documentação, pesquisador web). Contratar grava `~/.claude/agents/<id>.md` no formato oficial do Claude Code (vale para as sessões abertas depois) e o novo funcionário ganha departamento e mesa. Editar mantém campos do cabeçalho que a ficha não conhece; demitir move o arquivo para `~/.claude/agents/.demitidos/` (dá pra recontratar movendo de volta). A demonstração usa os mesmos agentes reais: contratar por ela também cria o arquivo de verdade.
- **Secretária (Lia):** tem mesa na sua sala, colada na sua, e um painel fixo no topo da lateral (resumo das equipes e atalhos: nova equipe, quadro, contratar). Quando tem algo pra dizer, levanta e vem até o seu lado, e o painel mostra o aviso com o botão certo (ex.: abrir a conversa daquela equipe). Avisa sozinha: quando uma sessão precisa de você ou há pedido de permissão (urgente, com som opcional e notificação do sistema se a aba estiver em segundo plano), quando um agente ou uma sessão termina uma tarefa, quando uma sessão espera você há mais de 30 min, com um resumo na primeira abertura do dia e com lembretes periódicos (pendências do painel, projeto com mudança sem commit há mais de um dia, projeto sem cópia no GitHub, recado antigo no quadro). Regras fixas, sem IA. Ajustes (⚙️ no cartão dela): frequência dos lembretes, som e notificação; ficam no navegador.
- **Navegação:** arraste pra mover, roda do mouse ou pinça pra zoom, setas/WASD e `+` `−` `0` pelo teclado; botões de zoom, atalhos pra ir direto a cada sala (com quantos estão trabalhando), minimapa quando o zoom está perto e 🎯 pra seguir o agente selecionado. A câmera lembra onde você parou.
- **Visual:** personagens com o dobro de detalhe (contorno, penteados, vistos de frente, costas e perfil ao andar), acessórios por departamento (boné e gravata dourados do Claude, óculos na Pesquisa, prancheta no Planejamento, fone no Suporte), cadeiras, relógio com a hora real, vapor da cafeteira e luz de noite (telas e luminária acesas depois das 18h).
- **Equipes:** cada sessão do Claude é uma equipe, com aba e conversa próprias na sua sala (bolinha: amarela ocupada, verde livre, vermelha precisando de você; "nova" quando chegou resposta que você não viu). Dá pra falar com uma enquanto a outra trabalha. **+ Nova equipe** abre um terminal novo na pasta do projeto escolhido, já com `claude-sala`; você aperta Enter uma vez no aviso dos canais e ela aparece como aba nova, recebendo o primeiro pedido, se você deixou um. O terminal continua aberto pra usar quando quiser.
- **Sua sala:** conversa com qualquer sessão aberta com `claude-sala`. O que você digita chega na sessão; a resposta aparece na sala; pedidos de permissão viram cartões com Permitir/Negar.

## Instalar

```bash
git clone https://github.com/felipe-eliakim/sala-dos-agentes.git
cd sala-dos-agentes
python3 ops/install.py
```

O instalador:
1. registra hooks em `~/.claude/settings.json` (faz cópia antes em `~/.claude/backups/` e só mexe nas entradas dele);
2. gera `channel/mcp.json` e cria o atalho `~/.local/bin/claude-sala`;
3. liga o serviço systemd de usuário `sala-dos-agentes` (sobe sozinho no login);
4. copia `exemplos/` para `~/.config/sala-dos-agentes/` se ainda não existir.

Desinstalar: `python3 ops/install.py --remove` (mantém seus dados e sua configuração).

Os hooks apontam para esta pasta: se mover a pasta, rode `--remove` antes e `install.py` de novo depois.

## Configurar (opcional)

Tudo pessoal fica em `~/.config/sala-dos-agentes/`, nunca no repositório:

| Arquivo | Para quê |
|---|---|
| `config.json` | `usuario` (seu nome, que o Claude usa ao falar com você pela sala) e `pasta_projetos` (pasta onde ficam seus projetos: a sessão é identificada pela subpasta em que está; sem ela, vale o nome da pasta atual) |
| `projetos.json` | Nome bonito de cada subpasta de projeto (`"meu-app": "Meu App"`) |
| `departamentos.json` | Nome, cor e nome do funcionário dos seus agentes personalizados |

Se a `pasta_projetos` tiver um `painel.html` com uma lista de projetos no formato `{ n: 1, name: "...", you: "..." }`, o campo `you` (o que depende de você) aparece no quadro de avisos.

## Conversar pela sala

```bash
cd ~/projetos/meu-app
claude-sala            # = claude + o canal da sala; aceita os mesmos argumentos do claude
```

Na abertura o Claude Code mostra o aviso **"Loading development channels"**: escolha *I am using this for local development*. Depois disso a sessão aparece com ● em "Falar com", na sua sala. O terminal continua funcionando normalmente.

Por baixo: o Claude Code tem "canais" (o mesmo recurso usado por integrações de chat). `channel/sala_channel.py` é um servidor MCP que a sessão carrega; ele busca no servidor da sala as suas mensagens, entrega à sessão, dá a ela as ferramentas `reply` (responder na sala) e `recado` (fixar no quadro) e repassa os pedidos de permissão. Canal próprio exige a opção `--dangerously-load-development-channels`, daí o aviso. Canais são um recurso experimental do Claude Code; em contas de organização podem depender de `channelsEnabled` nas configurações gerenciadas.

## Como funciona

```text
Claude Code ──hooks──> ~/.local/share/sala-dos-agentes/events-AAAA-MM-DD.jsonl ─┐
~/.claude/sessions/<pid>.json (sessões abertas, ocupada/parada) ─────────────────┼─> server/ (127.0.0.1:8777) ─> web/ (canvas)
sessão aberta com claude-sala <──canal MCP (channel/)──> server/chat.py ─────────┘
```

- **Hook** (`hook/capture.py`): uma linha por evento, com metadados (evento, sessão, pasta, id e tipo do subagente, nome da ferramenta, tipo de notificação), as primeiras 100 letras de cada pedido e a descrição curta que a sessão passa a cada subagente. Nada de resposta nem de entrada/saída das outras ferramentas. Um arquivo por dia, apagado depois de 7 dias. Engole qualquer erro para nunca atrapalhar o Claude Code.
- **Registro de sessões:** o próprio Claude Code mantém `~/.claude/sessions/`, que diz quais sessões estão abertas e se estão ocupadas ou paradas. Com ele o escritório funciona até antes dos hooks.
- **Servidor** (`server/`): `state.py` transforma eventos em estados (funções puras, com testes), `store.py` lê os arquivos aos poucos e junta com o registro, `roster.py` monta a equipe fixa, `board.py` cuida do quadro, `chat.py` da conversa e `sala.py` serve tudo.
- **Página** (`web/`): `camera.js` cuida de zoom/arrastar/seguir; o mundo é desenhado numa imagem à parte em escala 4 e a câmera mostra um pedaço dela, com nomes e balões por cima em tamanho fixo; `people.js` desenha os personagens; `office.js` monta a planta a partir da lista de departamentos e acha caminho por busca em largura na grade (ninguém atravessa parede nem móvel); `sprites.js` desenha móveis e bonequinhos por código, sem imagem; `app.js` cuida da conversa, da equipe e do quadro.

### Estados

| Evento | Sessão principal | Subagente |
|---|---|---|
| `SessionStart` | esperando | |
| `UserPromptSubmit` | trabalhando (guarda o começo do pedido) | |
| `PreToolUse` | trabalhando + ferramenta; `AskUserQuestion`/`ExitPlanMode` = precisa de você | ferramenta (o evento traz `agent_id`) |
| `PostToolUse` | sai do "precisa de você" | |
| `Notification` | permissão = precisa de você; ociosa = esperando | |
| `SubagentStart` / `SubagentStop` | trabalhando (delegando) | entra com a tarefa / termina e sai |
| `Stop` | esperando (vai para "concluídas") | |
| `SessionEnd` ou processo morto | sai | sai |

## Segurança e privacidade

- Tudo fica na sua máquina; nada é enviado para fora. O servidor só escuta em `127.0.0.1` e não tem login: **não exponha a porta** (túnel, proxy reverso etc.), porque quem alcança a sala conversa com as suas sessões.
- As rotas usadas pela página exigem `Origin` e `Host` da própria sala e um cabeçalho próprio, então outro site aberto no seu navegador não consegue mandar comandos (inclusive por DNS rebinding). As rotas do canal exigem um token guardado em `~/.local/share/sala-dos-agentes/token` (permissão 600).
- Os arquivos de evento e de conversa ficam em `~/.local/share/sala-dos-agentes/` com permissão 600.

## Desenvolvimento

```bash
python3 -m unittest discover tests      # lógica de estados
python3 ops/demo.py                     # escritório com agentes fictícios em :8778, sem tocar nos dados reais
systemctl --user restart sala-dos-agentes   # depois de mudar o servidor (a página não precisa)
```

## Créditos

Inspirado na [AI Operations Room](https://github.com/mewsdev/AiOperationsRoom) (MIT), de Maria Eduarda Watanabe Silva, que por sua vez se inspirou no [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents). Nenhum código ou arte foi copiado: a AI Operations Room é para Windows e usa FastAPI + SQLite; esta foi escrita do zero para Linux, sem dependências, e acrescenta o escritório com equipe fixa e a conversa pela sala.

Licença [MIT](LICENSE).
