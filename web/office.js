// O escritório inteiro: planta (salas, corredor, portas), móveis, quem é quem
// e pra onde cada um anda. Andar é por busca em largura na grade de tiles,
// então ninguém atravessa parede nem móvel.
import { TILE, PAL, rect, drawDesk, drawChairBack, drawPlant, drawShelf, drawTable, drawFridge,
         drawCounter, drawBoard, drawUserDesk, drawPerson, looks } from "./sprites.js";
import { toolInfo } from "./tools.js";

const RH = 8;                                  // altura interna de cada sala (2 de parede + 6 de piso)
const W_DEPT = 9, W_DIR = 14, W_ME = 12, W_COPA = 16;
const SPEED = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1000 : 3.2; // tiles/s
const FOOD = ["🥪", "☕", "🍎", "🍪", "🍕", "🧃"];
const MAIN_SHIRT = "#e0694a", CAP = "#ffd166";

// ---------- planta ----------

function buildLayout(departments) {
  const depts = departments.map((d) => ({ kind: "dept", type: d.type, nome: d.nome, cor: d.cor || "#7a8699", w: W_DEPT }));
  const rowW = (r) => r.reduce((a, x) => a + x.w + 1, 1);
  let split = 0, diff = Infinity;
  for (let a = 0; a <= depts.length; a++) {
    const r1 = rowW([{ w: W_DIR }, { w: W_ME }, ...depts.slice(0, a)]);
    const r2 = rowW([...depts.slice(a), { w: W_COPA }]);
    if (Math.abs(r1 - r2) < diff) { diff = Math.abs(r1 - r2); split = a; }
  }
  const row1 = [{ kind: "dir", nome: "Diretoria", cor: CAP, w: W_DIR }, { kind: "me", nome: "Sua sala", cor: "#7fb3ff", w: W_ME }, ...depts.slice(0, split)];
  const row2 = [...depts.slice(split), { kind: "copa", nome: "Copa", cor: "#f2a65a", w: W_COPA }];
  const W = Math.max(rowW(row1), rowW(row2));
  for (const r of [row1, row2]) r[r.length - 1].w += W - rowW(r);
  const hallY = 1 + RH + 1, H = hallY + 3 + 1 + RH + 1;

  const grid = new Uint8Array(W * H);          // 0 parede, 1 piso livre, 2 móvel
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) grid[y * W + x] = v; };
  const rooms = [];
  const place = (row, y, top) => {
    let x = 1;
    for (const r of row) {
      Object.assign(r, { x, y, h: RH, top, doorX: x + Math.floor(r.w / 2) - 1, seats: [], helpers: [], spots: [] });
      rooms.push(r);
      x += r.w + 1;
    }
  };
  place(row1, 1, true);
  place(row2, hallY + 4, false);
  for (const r of rooms) for (let y = r.y + 2; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, 1);
  for (let y = hallY; y < hallY + 3; y++) for (let x = 1; x < W - 1; x++) set(x, y, 1);
  for (const r of rooms) {
    const dy = r.top ? [r.y + r.h] : [r.y - 1, r.y, r.y + 1];   // porta embaixo (fileira de cima) ou em cima
    for (const y of dy) { set(r.doorX, y, 1); set(r.doorX + 1, y, 1); }
  }
  const entrance = { x: 0, y: hallY + 1, kind: "door" };
  set(0, hallY + 1, 1);

  const furniture = [];
  const block = (x, y, w, h = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, 2); };
  const spot = (r, list, rx, ry, pose, extra = {}) => { const p = { x: r.x + rx, y: r.y + ry, pose, room: r, ...extra }; list.push(p); return p; };

  for (const r of rooms) {
    if (r.kind === "dept" || r.kind === "dir") {
      const n = r.kind === "dir" ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const dx = r.x + 1 + i * 4, dy = r.y + 3;
        block(dx, dy, 3);
        const seat = spot(r, r.seats, 2 + i * 4, 4, "desk", { desk: furniture.length });
        furniture.push({ z: (dy + 1) * TILE, kind: "desk", x: dx, y: dy, seat });
        spot(r, r.helpers, 3 + i * 4, 6, "stand");
      }
      const px = r.x + r.w - 1;
      if (grid[(r.y + 3) * W + px] === 1) { block(px, r.y + 3); furniture.push({ z: (r.y + 4) * TILE, kind: "plant", x: px, y: r.y + 3 }); }
    } else if (r.kind === "me") {
      block(r.x + 4, r.y + 4, 4);
      furniture.push({ z: (r.y + 5) * TILE, kind: "userdesk", x: r.x + 4, y: r.y + 4 });
      r.user = { x: r.x + 5.5, y: r.y + 3 };
      block(r.x + 1, r.y + 3, 2);
      furniture.push({ z: (r.y + 4) * TILE, kind: "shelf", x: r.x + 1, y: r.y + 3, w: 2 });
      block(r.x + r.w - 1, r.y + 3);
      furniture.push({ z: (r.y + 4) * TILE, kind: "plant", x: r.x + r.w - 1, y: r.y + 3 });
      for (const rx of [5, 7, 3, 9]) spot(r, r.spots, rx, 6, "back");
    } else if (r.kind === "copa") {
      const tw = r.w - 7;
      block(r.x + 2, r.y + 4, tw, 2);
      furniture.push({ z: (r.y + 6) * TILE - 1, kind: "table", x: r.x + 2, y: r.y + 4, w: tw, h: 2 });
      for (let rx = 2; rx < 2 + tw; rx += 2) { spot(r, r.seats, rx, 3, "sit", { eat: true }); spot(r, r.seats, rx + 1, 6, "back", { eat: true }); }
      block(r.x + r.w - 4, r.y + 3, 3);
      furniture.push({ z: (r.y + 4) * TILE, kind: "counter", x: r.x + r.w - 4, y: r.y + 3, w: 3 });
      block(r.x + r.w - 1, r.y + 3);
      furniture.push({ z: (r.y + 4) * TILE, kind: "fridge", x: r.x + r.w - 1, y: r.y + 3 });
      spot(r, r.seats, r.w - 3, 5, "stand", { cup: true });
      spot(r, r.seats, r.w - 1, 5, "stand", { cup: true });
    }
  }
  // quadro de avisos na parede do corredor, num trecho sem porta
  const me = rooms.find((r) => r.kind === "me");
  const board = { x: me.x + 1, y: hallY - 1, w: 4 };
  const hallSpots = [];
  for (let x = 3; x < W - 3; x += 5) hallSpots.push({ x, y: hallY + 2, pose: "stand" });
  return { W, H, grid, rooms, entrance, furniture, board, hallY, hallSpots };
}

function bfs(L, from, to) {
  const { W, H, grid } = L;
  const key = (x, y) => y * W + x;
  const sx = Math.round(from.x), sy = Math.round(from.y), tx = Math.round(to.x), ty = Math.round(to.y);
  const prev = new Int32Array(W * H).fill(-1);
  const q = [key(sx, sy)];
  prev[q[0]] = q[0];
  const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (grid[key(x, y)] === 1 || (x === tx && y === ty));
  for (let i = 0; i < q.length; i++) {
    const k = q[i], x = k % W, y = (k / W) | 0;
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (ok(nx, ny) && prev[nk] < 0) { prev[nk] = k; q.push(nk); }
    }
  }
  const end = key(tx, ty);
  if (prev[end] < 0) return [{ x: to.x, y: to.y }];       // sem caminho: anda direto (não deve acontecer)
  const path = [];
  for (let k = end; k !== key(sx, sy); k = prev[k]) path.push({ x: k % W, y: (k / W) | 0 });
  path.reverse();
  if (path.length) path[path.length - 1] = { x: to.x, y: to.y };
  else path.push({ x: to.x, y: to.y });
  return path;
}

// ---------- escritório ----------

export class Office {
  constructor(canvas, handlers = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.handlers = handlers;
    this.chars = new Map();
    this.layoutKey = "";
    this.selected = null;
    this.boardCount = 0;           // itens urgentes (badge vermelho)
    this.boardPapers = 0;          // tudo que está pregado no quadro
    this.userTalking = 0;
    canvas.addEventListener("click", (e) => this.click(e));
    canvas.addEventListener("mousemove", (e) => { canvas.style.cursor = this.hit(e) ? "pointer" : "default"; });
  }

  resize() {
    if (!this.L) return;
    const VW = this.L.W * TILE, VH = this.L.H * TILE;
    const css = this.canvas.clientWidth || VW * 2;
    this.scale = Math.max(1, Math.round((css * devicePixelRatio) / VW));
    this.canvas.width = VW * this.scale;
    this.canvas.height = VH * this.scale;
  }

  layout(departments) {
    const key = departments.map((d) => d.type + d.nome).join("|");
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.L = buildLayout(departments);
    this.depts = new Map(this.L.rooms.filter((r) => r.kind === "dept").map((r) => [r.type, r]));
    this.resize();
    for (const c of this.chars.values()) { c.spot = null; c.path = []; c.x = this.L.entrance.x; c.y = this.L.entrance.y; }
  }

  room(kind) { return this.L.rooms.find((r) => r.kind === kind); }

  // Recebe o estado da API e decide o papel de cada um.
  sync(data, chatActivity) {
    this.layout(data.departments);
    const wanted = new Map();
    const deptRoom = (type) => this.depts.get(type) || this.depts.get("general-purpose") || this.room("dir");
    for (const d of data.departments)
      wanted.set("res:" + d.type, { label: d.funcionario, sub: d.nome, home: deptRoom(d.type), shirt: d.cor, mode: "idle", type: d.type, resident: true });
    if (!data.sessions.length)
      wanted.set("res:claude", { label: "Claude", sub: "sem sessão aberta", home: this.room("dir"), shirt: MAIN_SHIRT, cap: CAP, mode: "idle", main: true });
    for (const s of data.sessions) {
      const talking = chatActivity[s.id] && Date.now() / 1000 - chatActivity[s.id] < 12;
      const mode = s.state === "attention" ? "attention" : talking ? "chat" : s.state === "working" ? "work" : "idle";
      wanted.set(s.id, { label: s.projeto || "Claude", sub: s.name, home: this.room("dir"), shirt: MAIN_SHIRT, cap: CAP,
                         mode, tool: s.tool, tarefa: s.pedido, main: true, canal: s.canal });
      for (const sub of s.subagents) {
        if (sub.state !== "working") continue;
        const res = wanted.get("res:" + sub.type);
        const info = { mode: "work", tool: sub.tool, tarefa: sub.tarefa, boss: s.projeto };
        if (res && !res.claimed) { Object.assign(res, info, { claimed: true }); continue; }
        wanted.set(sub.id, { label: sub.type, sub: "reforço", home: deptRoom(sub.type), shirt: res?.shirt, ...info, temp: true });
      }
    }
    for (const [id, info] of wanted) {
      let c = this.chars.get(id);
      if (!c) {
        const start = info.resident || info.main && !info.temp ? this.randomCopaSeat() || this.L.entrance : this.L.entrance;
        c = { id, x: start.x, y: start.y, path: [], spot: null, seed: Math.random() * 6, nextMove: 0,
              look: looks(id, info.shirt, { cap: info.cap }) };
        this.chars.set(id, c);
      }
      c.leaving = false;
      Object.assign(c, { tool: null, tarefa: "", boss: "" }, info);
    }
    for (const c of this.chars.values()) if (!wanted.has(c.id)) { c.mode = "leave"; c.leaving = true; }
    this.plan();
  }

  randomCopaSeat() {
    const free = this.room("copa").seats.filter((p) => !this.takenBy(p));
    return free[Math.floor(Math.random() * free.length)];
  }

  takenBy(p, except) {
    for (const c of this.chars.values()) if (c !== except && c.spot === p) return c;
    return null;
  }

  // Escolhe o destino de cada um conforme o papel.
  plan() {
    const now = performance.now() / 1000;
    for (const c of this.chars.values()) {
      let want = c.spot;
      const room = c.spot?.room;
      if (c.mode === "leave") want = this.L.entrance;
      else if (c.mode === "work") {
        if (!(room === c.home && (c.spot.pose === "desk" || c.home.helpers.includes(c.spot))))
          want = c.home.seats.find((p) => !this.takenBy(p, c)) || c.home.helpers.find((p) => !this.takenBy(p, c)) || this.freeHall(c);
      } else if (c.mode === "attention" || c.mode === "chat") {
        if (room?.kind !== "me") want = this.room("me").spots.find((p) => !this.takenBy(p, c)) || this.freeHall(c);
      } else {                                   // idle: copa, trocando de lugar de vez em quando
        if (room?.kind !== "copa" || now > c.nextMove) {
          want = this.randomCopaSeat() || c.spot || this.freeHall(c);
          c.nextMove = now + 25 + Math.random() * 40;
        }
      }
      if (want && want !== c.spot) { c.spot = want; c.path = bfs(this.L, c, want); }
    }
  }

  freeHall(c) { return this.L.hallSpots.find((p) => !this.takenBy(p, c)) || this.L.hallSpots[0]; }

  update(dt, now) {
    if (!this.L) return;
    let replan = false;
    for (const c of [...this.chars.values()]) {
      let budget = SPEED * dt;
      while (budget > 0 && c.path.length) {
        const p = c.path[0], dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
        if (d <= budget) { c.x = p.x; c.y = p.y; c.path.shift(); budget -= d; }
        else { c.x += (dx / d) * budget; c.y += (dy / d) * budget; budget = 0; }
      }
      if (c.leaving && !c.path.length) { this.chars.delete(c.id); continue; }
      if (c.mode === "idle" && now > c.nextMove) replan = true;
    }
    if (replan) this.plan();
  }

  pose(c) {
    if (c.path.length) return "walk";
    const p = c.spot?.pose || "stand";
    if (p === "desk") return c.mode === "work" ? "desk" : "back";
    return p;
  }

  // ---------- desenho ----------

  draw(t) {
    if (!this.L) return;
    const { ctx, scale: s, L } = this;
    const T = TILE;
    rect(ctx, s, 0, 0, L.W * T, L.H * T, PAL.wall);
    // pisos
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      if (L.grid[y * L.W + x] === 0) continue;
      const r = this.roomAt(x, y);
      const odd = (x + y) % 2;
      const c = !r ? (odd ? PAL.hallA : PAL.hallB) : r.kind === "copa" ? (odd ? PAL.copaA : PAL.copaB)
        : r.kind === "me" ? (odd ? PAL.meA : PAL.meB) : (odd ? PAL.floorA : PAL.floorB);
      rect(ctx, s, x * T, y * T, T, T, c);
    }
    // paredes de fundo de cada sala, com janela, placa e porta
    for (const r of L.rooms) {
      rect(ctx, s, r.x * T, r.y * T, r.w * T, 2 * T, PAL.face);
      rect(ctx, s, r.x * T, r.y * T, r.w * T, 2, PAL.wallTop);
      rect(ctx, s, r.x * T, (r.y + 2) * T - 3, r.w * T, 3, r.cor);
      if (!r.top) rect(ctx, s, r.doorX * T, r.y * T, 2 * T, 2 * T, "#1a1626");
      if (r.kind === "dir" || r.kind === "me" || r.kind === "copa") {
        const wx = r.kind === "me" ? r.x + r.w - 4 : r.x + r.w - 5;
        if (r.top || wx > r.doorX + 2 || wx + 3 < r.doorX) {
          const night = new Date().getHours() >= 18 || new Date().getHours() < 6;
          rect(ctx, s, wx * T, r.y * T + 3, 3 * T, 9, PAL.frame);
          rect(ctx, s, wx * T + 1, r.y * T + 4, 3 * T - 2, 7, night ? "#1d2a55" : PAL.window);
        }
      }
    }
    drawBoard(ctx, s, L.board.x, L.board.y, L.board.w, this.boardPapers, this.boardCount, t);

    const items = L.furniture.map((f) => ({ z: f.z, f }));
    for (const c of this.chars.values()) items.push({ z: c.y * T + T - 1, c });
    const me = this.room("me");
    items.push({ z: me.user.y * T + T - 1, user: true });
    items.sort((a, b) => a.z - b.z);
    const seated = new Set();
    for (const c of this.chars.values()) if (!c.path.length && c.spot?.pose === "desk" && c.mode === "work") seated.add(c.spot.desk);
    for (const it of items) {
      if (it.f) this.drawFurniture(it.f, t, seated);
      else if (it.user) drawPerson(ctx, s, me.user.x * T + T / 2, me.user.y * T + T - 1, this.userLook ||= looks("voce", "#2f9e8f"), "stand", t, { seed: 1 });
      else {
        const c = it.c, [px, py] = [c.x * T + T / 2, c.y * T + T - 1], pose = this.pose(c);
        drawPerson(ctx, s, px, py, c.look, pose, t, {
          seed: c.seed, raise: c.mode === "attention" && !c.path.length,
          cup: c.spot?.cup && !c.path.length, eating: c.spot?.eat && !c.path.length,
        });
        if (pose === "desk" || (pose === "back" && c.spot?.pose === "desk")) drawChairBack(ctx, s, px, py);
      }
    }
    for (const r of L.rooms) this.drawPlate(r);
    for (const c of this.chars.values()) this.drawTag(c, t);
    this.drawUserTag(t);
  }

  roomAt(x, y) {
    return this.L.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y - (r.top ? 0 : 1) && y <= r.y + r.h - (r.top ? 0 : 1));
  }

  drawFurniture(f, t, seated) {
    const { ctx, scale: s } = this;
    if (f.kind === "desk") drawDesk(ctx, s, f.x, f.y, seated.has(this.L.furniture.indexOf(f)), t);
    else if (f.kind === "plant") drawPlant(ctx, s, f.x, f.y);
    else if (f.kind === "shelf") drawShelf(ctx, s, f.x, f.y, f.w);
    else if (f.kind === "table") drawTable(ctx, s, f.x, f.y, f.w, f.h);
    else if (f.kind === "counter") drawCounter(ctx, s, f.x, f.y, f.w, t);
    else if (f.kind === "fridge") drawFridge(ctx, s, f.x, f.y);
    else if (f.kind === "userdesk") drawUserDesk(ctx, s, f.x, f.y);
  }

  font(px, weight = 600) { this.ctx.font = `${weight} ${px}px ui-monospace, monospace`; }

  drawPlate(r) {
    const { ctx, scale: s } = this;
    const size = Math.max(9, Math.round(s * 3.6));
    const x = (r.x + 0.4) * TILE * s, y = (r.y + 1.15) * TILE * s;
    this.font(size, 700);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f4f1ea";
    ctx.fillText(r.nome, x, y);
    if (r.kind === "dept") {
      const busy = [...this.chars.values()].filter((c) => c.home === r && c.mode === "work").length;
      const w = ctx.measureText(r.nome).width;
      this.font(Math.round(size * 0.8), 600);
      ctx.fillStyle = busy ? "#7ee2a8" : "#a9a3c4";
      ctx.fillText(busy ? `● ${busy} trabalhando` : "○ livre", x + w + size * 0.6, y);
    }
  }

  drawTag(c, t) {
    const { ctx, scale: s } = this;
    const size = Math.max(8, Math.round(s * 2.9));
    // Na mesa o nome vai pra baixo da cadeira e o balão pro lado, pra não tapar o monitor.
    const atDesk = !c.path.length && c.spot?.pose === "desk";
    const px = (c.x * TILE + TILE / 2) * s;
    const top = atDesk ? (c.y * TILE + TILE + 2) * s + size * 1.2 : (c.y * TILE - 8) * s;
    this.font(size);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const name = c.label.length > 12 ? c.label.slice(0, 11) + "…" : c.label;
    const w = ctx.measureText(name).width + size * 0.6;
    const sel = this.selected === c.id;
    ctx.fillStyle = sel ? "rgba(255,209,102,.95)" : "rgba(15,12,30,.72)";
    ctx.fillRect(px - w / 2, top - size * 1.2, w, size * 1.15);
    ctx.fillStyle = sel ? "#1d1a2b" : c.main ? CAP : "#e8e6f5";
    ctx.fillText(name, px, top - size * 0.12);
    let b = null;
    if (c.leaving) b = "👋";
    else if (c.path.length) b = null;
    else if (c.mode === "attention") b = Math.floor(t * 2) % 2 ? "❗" : "❓";
    else if (c.mode === "chat") b = "💬";
    else if (c.mode === "work") b = toolInfo(c.tool).icon;
    else if (c.spot?.eat || c.spot?.cup) b = FOOD[Math.floor(c.seed + t / 9) % FOOD.length];
    if (!b) return;
    if (atDesk) this.bubble(px + 7 * s + size, (c.y * TILE - 2) * s, b, false, c.seed, t, size);
    else this.bubble(px, top - size * 1.3, b, c.mode === "attention", c.seed, t, size);
  }

  drawUserTag(t) {
    const { ctx, scale: s } = this;
    const me = this.room("me");
    const px = (me.user.x * TILE + TILE / 2) * s, top = (me.user.y * TILE - 8) * s;
    const size = Math.max(8, Math.round(s * 2.9));
    this.font(size);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const w = ctx.measureText("Você").width + size * 0.6;
    ctx.fillStyle = "rgba(47,158,143,.9)";
    ctx.fillRect(px - w / 2, top - size * 1.2, w, size * 1.15);
    ctx.fillStyle = "#fff";
    ctx.fillText("Você", px, top - size * 0.12);
    if (Date.now() / 1000 - this.userTalking < 8) this.bubble(px, top - size * 1.3, "💬", false, 0, t, size);
  }

  bubble(x, by, icon, alert, seed, t, size) {
    const { ctx, scale: s } = this;
    const r = size * 1.05, bounce = Math.sin(t * 4 + seed) * s * 0.5;
    ctx.fillStyle = alert ? "#ff5d73" : "#fffaf0";
    ctx.beginPath(); ctx.arc(x, by - r + bounce, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, by - r * 0.2 + bounce); ctx.lineTo(x, by + r * 0.35 + bounce); ctx.lineTo(x + r * 0.3, by - r * 0.2 + bounce);
    ctx.fill();
    ctx.font = `${Math.round(r * 1.1)}px system-ui, "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, x, by - r + bounce + r * 0.08);
  }

  // ---------- cliques ----------

  hit(e) {
    if (!this.L) return null;
    const box = this.canvas.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * this.L.W * TILE;
    const vy = ((e.clientY - box.top) / box.height) * this.L.H * TILE;
    const b = this.L.board;
    if (vx >= b.x * TILE - 2 && vx <= (b.x + b.w) * TILE + 2 && vy >= b.y * TILE - 4 && vy <= b.y * TILE + 14) return { board: true };
    let best = null, bestD = 10;
    for (const c of this.chars.values()) {
      const px = c.x * TILE + TILE / 2, py = c.y * TILE;
      const d = Math.hypot(vx - px, (vy - py) * 0.7);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) return { char: best.id };
    const r = this.roomAt(Math.floor(vx / TILE), Math.floor(vy / TILE));
    if (r?.kind === "me") return { me: true };
    return null;
  }

  click(e) {
    const h = this.hit(e);
    if (!h) return;
    if (h.board) this.handlers.onBoard?.();
    else if (h.char) { this.selected = h.char; this.handlers.onSelect?.(h.char); }
    else if (h.me) this.handlers.onMe?.();
  }
}
