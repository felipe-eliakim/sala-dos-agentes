// O escritório inteiro: planta (salas, corredor, portas), móveis, quem é quem,
// pra onde cada um anda e como aparece na tela. O mundo é desenhado numa
// imagem à parte em escala 4 (pixel art nítida); a câmera mostra um pedaço
// dela com zoom, e nomes/balões são desenhados por cima em tamanho fixo.
import { TILE, PAL, drawStool, drawFloor, drawWallFace, drawWindow, drawClock, drawPoster, drawDoorway, drawDesk, drawChair,
         drawPlant, drawShelf, drawTable, drawFridge, drawCounter, drawBoard, drawUserDesk, drawSofa, drawRug, drawCooler, rect } from "./sprites.js";
import { drawPerson, looks } from "./people.js";
import { toolInfo } from "./tools.js";
import { Camera } from "./camera.js";

const R = 4;                                   // pixels de imagem por pixel do mundo
const RH = 8;                                  // altura interna de cada sala (2 de parede + 6 de piso)
const W_DEPT = 9, W_DIR = 14, W_ME = 12, W_COPA = 16;
const SPEED = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1000 : 3.2; // tiles/s
const FOOD = ["🥪", "☕", "🍎", "🍪", "🍕", "🧃"];
const MAIN_SHIRT = "#e0694a", CAP = "#ffd166";
const ACC = { Explore: "oculos", Plan: "prancheta", "claude-code-guide": "fone", "statusline-setup": "chave" };

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
      Object.assign(r, { x, y, h: RH, top, doorX: x + Math.floor(r.w / 2) - 1, seats: [], helpers: [], spots: [], decor: [] });
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
  const free = (x, y) => grid[y * W + x] === 1;

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
      if (free(px, r.y + 3)) { block(px, r.y + 3); furniture.push({ z: (r.y + 4) * TILE, kind: "plant", x: px, y: r.y + 3 }); }
      if (r.kind === "dir") {
        r.decor.push({ kind: "window", x: r.x + 1, w: 3 }, { kind: "clock", x: r.x + 6 }, { kind: "window", x: r.x + 9, w: 3 });
        r.decor.push({ kind: "rug", x: r.x + 3, y: r.y + 6, w: r.w - 6, h: 2, c: "#7a3b3b" });
      } else {
        r.decor.push({ kind: "poster", x: r.x + r.w - 2 }, { kind: "window", x: r.x + 1, w: 2 });
      }
    } else if (r.kind === "me") {
      block(r.x + 4, r.y + 4, 4);
      furniture.push({ z: (r.y + 5) * TILE, kind: "userdesk", x: r.x + 4, y: r.y + 4 });
      r.user = { x: r.x + 5.5, y: r.y + 3 };
      block(r.x + 1, r.y + 3, 2);
      furniture.push({ z: (r.y + 4) * TILE, kind: "shelf", x: r.x + 1, y: r.y + 3, w: 2 });
      block(r.x + r.w - 1, r.y + 3);
      furniture.push({ z: (r.y + 4) * TILE, kind: "plant", x: r.x + r.w - 1, y: r.y + 3 });
      block(r.x + r.w - 4, r.y + 7, 3);
      furniture.push({ z: (r.y + 8) * TILE, kind: "sofa", x: r.x + r.w - 4, y: r.y + 7, w: 3 });
      for (const rx of [5, 7, 3, 9]) spot(r, r.spots, rx, 6, "visit");
      r.decor.push({ kind: "window", x: r.x + r.w - 5, w: 3 }, { kind: "poster", x: r.x + 4 });
      r.decor.push({ kind: "rug", x: r.x + 3, y: r.y + 5, w: 6, h: 2, c: "#3f5677" });
    } else if (r.kind === "copa") {
      const tw = r.w - 7;
      block(r.x + 2, r.y + 4, tw, 2);
      furniture.push({ z: (r.y + 6) * TILE - 1, kind: "table", x: r.x + 2, y: r.y + 4, w: tw, h: 2 });
      for (let rx = 2; rx < 2 + tw; rx += 2) { spot(r, r.seats, rx, 3, "sit", { eat: true }); spot(r, r.seats, rx + 1, 6, "backsit", { eat: true }); }
      block(r.x + r.w - 4, r.y + 3, 3);
      furniture.push({ z: (r.y + 4) * TILE, kind: "counter", x: r.x + r.w - 4, y: r.y + 3, w: 3 });
      block(r.x + r.w - 1, r.y + 3);
      furniture.push({ z: (r.y + 4) * TILE, kind: "fridge", x: r.x + r.w - 1, y: r.y + 3 });
      block(r.x, r.y + 3);
      furniture.push({ z: (r.y + 4) * TILE, kind: "cooler", x: r.x, y: r.y + 3 });
      spot(r, r.seats, r.w - 3, 5, "stand", { cup: true });
      spot(r, r.seats, r.w - 1, 5, "stand", { cup: true });
      r.decor.push({ kind: "window", x: r.x + 2, w: 3 }, { kind: "clock", x: r.x + 6 }, { kind: "window", x: r.x + 8, w: 2 });
    }
  }
  // corredor: plantas nas pontas e quadro de avisos na parede, num trecho sem porta
  for (const x of [1, W - 2]) { block(x, hallY); furniture.push({ z: (hallY + 1) * TILE, kind: "plant", x, y: hallY }); }
  const me = rooms.find((r) => r.kind === "me");
  const board = { x: me.x + 1, y: hallY - 1, w: 4 };
  const hallSpots = [];
  for (let x = 4; x < W - 4; x += 5) hallSpots.push({ x, y: hallY + 2, pose: "stand" });
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
  if (prev[end] < 0) return [{ x: to.x, y: to.y }];
  const path = [];
  for (let k = end; k !== key(sx, sy); k = prev[k]) path.push({ x: k % W, y: (k / W) | 0 });
  path.reverse();
  if (path.length) path[path.length - 1] = { x: to.x, y: to.y };
  else path.push({ x: to.x, y: to.y });
  return path;
}

const isNight = () => { const h = new Date().getHours(); return h >= 18 || h < 6; };

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
    this.wc = document.createElement("canvas");
    this.wctx = this.wc.getContext("2d");
    this.camera = new Camera(canvas);
    this.camera.onClick = (p) => this.click(p);
    canvas.addEventListener("pointermove", (e) => {
      if (e.buttons) return;
      const b = canvas.getBoundingClientRect();
      canvas.style.cursor = this.hit({ x: e.clientX - b.left, y: e.clientY - b.top }) ? "pointer" : "grab";
    });
  }

  resize() {
    const dpr = devicePixelRatio || 1;
    this.canvas.width = Math.round(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * dpr);
    if (this.L) this.camera.clamp();
  }

  layout(departments) {
    const key = departments.map((d) => d.type + d.nome).join("|");
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.L = buildLayout(departments);
    this.depts = new Map(this.L.rooms.filter((r) => r.kind === "dept").map((r) => [r.type, r]));
    this.wc.width = this.L.W * TILE * R;
    this.wc.height = this.L.H * TILE * R;
    this.resize();
    this.camera.setWorld(this.L.W * TILE, this.L.H * TILE);
    for (const c of this.chars.values()) { c.spot = null; c.path = []; c.x = this.L.entrance.x; c.y = this.L.entrance.y; }
    this.handlers.onLayout?.(this.roomList());
  }

  room(kind) { return this.L.rooms.find((r) => r.kind === kind); }

  roomList() {
    return this.L.rooms.map((r) => ({ id: r.kind === "dept" ? r.type : r.kind, nome: r.nome, cor: r.cor,
      rect: { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE } }));
  }

  goToRoom(id) {
    if (id === "tudo") return this.camera.fit();
    const r = this.roomList().find((x) => x.id === id);
    if (r) this.camera.goTo(r.rect);
  }

  followSelected() {
    const c = this.chars.get(this.selected);
    if (!c) return false;
    this.camera.anim = null;
    this.camera.z = Math.max(this.camera.z, 4);
    this.camera.follow = () => { const k = this.chars.get(c.id); return k && { x: k.x * TILE + TILE / 2, y: k.y * TILE }; };
    return true;
  }

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
        wanted.set(sub.id, { label: sub.type, sub: "reforço", home: deptRoom(sub.type), shirt: res?.shirt, type: sub.type, ...info, temp: true });
      }
    }
    for (const [id, info] of wanted) {
      let c = this.chars.get(id);
      if (!c) {
        const start = info.resident || (info.main && !info.temp) ? this.randomCopaSeat() || this.L.entrance : this.L.entrance;
        c = { id, x: start.x, y: start.y, path: [], spot: null, seed: Math.random() * 6, nextMove: 0, facing: "front",
              look: looks(id, info.shirt, { cap: info.cap, acc: ACC[info.type] }) };
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
      } else if (room?.kind !== "copa" || now > c.nextMove) {   // livre: copa, trocando de lugar de vez em quando
        want = this.randomCopaSeat() || c.spot || this.freeHall(c);
        c.nextMove = now + 25 + Math.random() * 40;
      }
      if (want && want !== c.spot) { c.spot = want; c.path = bfs(this.L, c, want); }
    }
  }

  freeHall(c) { return this.L.hallSpots.find((p) => !this.takenBy(p, c)) || this.L.hallSpots[0]; }

  update(dt, now) {
    if (!this.L) return;
    this.camera.update(dt);
    let replan = false;
    for (const c of [...this.chars.values()]) {
      let budget = SPEED * dt;
      while (budget > 0 && c.path.length) {
        const p = c.path[0], dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
        if (d > 0.001) c.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "front" : "back");
        if (d <= budget) { c.x = p.x; c.y = p.y; c.path.shift(); budget -= d; }
        else { c.x += (dx / d) * budget; c.y += (dy / d) * budget; budget = 0; }
      }
      if (c.leaving && !c.path.length) { this.chars.delete(c.id); continue; }
      if (c.mode === "idle" && now > c.nextMove) replan = true;
    }
    if (replan) this.plan();
  }

  // pose e para onde olha, conforme o lugar
  stance(c) {
    if (c.path.length) return ["walk", c.facing];
    const p = c.spot?.pose || "stand";
    if (p === "desk") return [c.mode === "work" ? "type" : "backsit", "back"];
    if (p === "backsit") return ["backsit", "back"];
    if (p === "sit") return ["sit", "front"];
    if (p === "visit") return ["stand", "back"];
    return ["stand", "front"];
  }

  // ---------- desenho ----------

  drawWorld(t) {
    const { wctx: ctx, L } = this, s = R, T = TILE, night = isNight();
    rect(ctx, s, 0, 0, L.W * T, L.H * T, PAL.wall);
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      if (L.grid[y * L.W + x] === 0) continue;
      const r = this.roomAt(x, y);
      drawFloor(ctx, s, x, y, !r ? "hall" : r.kind === "copa" ? "copa" : r.kind === "me" ? "me" : r.kind === "dir" ? "dir" : "wood");
    }
    for (const r of L.rooms) {
      for (const d of r.decor) if (d.kind === "rug") drawRug(ctx, s, d.x, d.y, d.w, d.h, d.c);
      drawWallFace(ctx, s, r, t);
      if (!r.top) drawDoorway(ctx, s, r.doorX, r.y);
      for (const d of r.decor) {
        if (!r.top && d.x + (d.w || 1) > r.doorX - 0.5 && d.x < r.doorX + 2.5) continue;   // não cobre a porta
        if (d.kind === "window") drawWindow(ctx, s, d.x, r.y, d.w, night, t);
        else if (d.kind === "clock") drawClock(ctx, s, d.x, r.y);
        else if (d.kind === "poster") drawPoster(ctx, s, d.x, r.y, r.cor);
      }
    }
    drawBoard(ctx, s, L.board.x, L.board.y, L.board.w, this.boardPapers, this.boardCount, t);

    // móveis, cadeiras vazias e pessoas, do fundo pra frente
    const items = L.furniture.map((f) => ({ z: f.z, f }));
    const seated = new Set();
    for (const c of this.chars.values()) if (!c.path.length && c.spot?.pose === "desk") seated.add(c.spot.desk);
    for (const r of L.rooms) for (const p of r.seats) {
      if (p.pose === "desk" && !seated.has(p.desk)) items.push({ z: p.y * T + T - 1.5, chair: p });
      if (p.pose === "sit") items.push({ z: p.y * T + T - 1.6, stool: p, behind: true });
      if (p.pose === "backsit") items.push({ z: p.y * T + T - 0.5, stool: p, behind: false });
    }
    for (const c of this.chars.values()) items.push({ z: c.y * T + T - 1, c });
    const me = this.room("me");
    items.push({ z: me.user.y * T + T - 1, user: true });
    items.sort((a, b) => a.z - b.z);
    const working = new Set([...this.chars.values()].filter((c) => !c.path.length && c.spot?.pose === "desk" && c.mode === "work").map((c) => c.spot.desk));
    for (const it of items) {
      if (it.f) this.drawFurniture(it.f, t, working);
      else if (it.chair) drawChair(ctx, s, it.chair.x * T + T / 2, it.chair.y * T + T - 1, true);
      else if (it.stool) drawStool(ctx, s, it.stool.x * T + T / 2, it.stool.y * T + T - 1, it.behind);
      else if (it.user) drawPerson(ctx, s, me.user.x * T + T / 2, me.user.y * T + T - 1, this.userLook ||= looks("voce", "#2f9e8f", { style: "curto" }), "front", "stand", t, { seed: 1 });
      else {
        const c = it.c, px = c.x * T + T / 2, py = c.y * T + T - 1, [pose, facing] = this.stance(c);
        drawPerson(ctx, s, px, py, c.look, facing, pose, t, {
          seed: c.seed, raise: c.mode === "attention" && !c.path.length,
          cup: c.spot?.cup && !c.path.length, eating: c.spot?.eat && !c.path.length,
        });
        if (c.spot?.pose === "desk" && !c.path.length) drawChair(ctx, s, px, py, false);
      }
    }
    // noite: escurece e acende telas e luminárias
    if (night) {
      ctx.fillStyle = "rgba(12,16,48,.38)";
      ctx.fillRect(0, 0, this.wc.width, this.wc.height);
      ctx.globalCompositeOperation = "lighter";
      const glow = (x, y, r, c) => {
        const g = ctx.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
        g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect((x - r) * s, (y - r) * s, r * 2 * s, r * 2 * s);
      };
      for (const f of L.furniture) {
        if (f.kind === "desk" && working.has(L.furniture.indexOf(f))) glow(f.x * T + 12, f.y * T - 2, 16, "rgba(80,170,255,.35)");
        if (f.kind === "userdesk") glow(f.x * T + 28, f.y * T - 6, 18, "rgba(255,200,90,.35)");
        if (f.kind === "counter") glow(f.x * T + 5, f.y * T - 8, 10, "rgba(255,120,90,.2)");
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }

  drawFurniture(f, t, working) {
    const { wctx: ctx } = this, s = R;
    if (f.kind === "desk") drawDesk(ctx, s, f.x, f.y, working.has(this.L.furniture.indexOf(f)), t);
    else if (f.kind === "plant") drawPlant(ctx, s, f.x, f.y, t);
    else if (f.kind === "shelf") drawShelf(ctx, s, f.x, f.y, f.w);
    else if (f.kind === "table") drawTable(ctx, s, f.x, f.y, f.w, f.h);
    else if (f.kind === "counter") drawCounter(ctx, s, f.x, f.y, f.w, t);
    else if (f.kind === "fridge") drawFridge(ctx, s, f.x, f.y);
    else if (f.kind === "cooler") drawCooler(ctx, s, f.x, f.y, t);
    else if (f.kind === "sofa") drawSofa(ctx, s, f.x, f.y, f.w);
    else if (f.kind === "userdesk") drawUserDesk(ctx, s, f.x, f.y);
  }

  roomAt(x, y) {
    return this.L.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y - (r.top ? 0 : 1) && y <= r.y + r.h - (r.top ? 0 : 1));
  }

  draw(t) {
    if (!this.L) return;
    if (this.canvas.width !== Math.round(this.canvas.clientWidth * devicePixelRatio)) this.resize();
    this.drawWorld(t);
    const { ctx, camera: cam } = this, dpr = devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#15111f";
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.imageSmoothingEnabled = cam.z * dpr < R;     // reduzindo: suaviza; ampliando: pixel puro
    ctx.drawImage(this.wc, -cam.x * cam.z, -cam.y * cam.z, this.L.W * TILE * cam.z, this.L.H * TILE * cam.z);
    for (const r of this.L.rooms) this.drawPlate(r);
    for (const c of this.chars.values()) this.drawTag(c, t);
    this.drawUserTag(t);
    this.drawMinimap();
  }

  font(px, weight = 600) { this.ctx.font = `${weight} ${px}px ui-monospace, "JetBrains Mono", monospace`; }

  label(text, x, y, bg, fg, size) {
    const { ctx } = this;
    this.font(size);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + size * 0.9, h = size * 1.55;
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, x, y + 0.5);
  }

  drawPlate(r) {
    const { ctx, camera: cam } = this;
    const p = cam.toScreen(r.x * TILE + 2, r.y * TILE + 5);
    if (p.x > cam.w || p.y > cam.h || p.x + 200 < 0 || p.y + 30 < 0) return;
    const size = Math.round(Math.min(15, Math.max(10, cam.z * 3.2)));
    this.font(size, 700);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const busy = r.kind === "dept" ? [...this.chars.values()].filter((c) => c.home === r && c.mode === "work" && !c.leaving).length : 0;
    const tag = r.kind === "dept" ? (busy ? `  ● ${busy} trabalhando` : "  ○ livre") : "";
    const w = ctx.measureText(r.nome).width;
    this.font(Math.round(size * 0.82), 600);
    const w2 = tag ? ctx.measureText(tag).width : 0;
    ctx.fillStyle = "rgba(20,16,36,.78)";
    ctx.beginPath(); ctx.roundRect(p.x - 4, p.y - size * 0.8, w + w2 + 12, size * 1.6, 6); ctx.fill();
    ctx.fillStyle = r.cor; ctx.fillRect(p.x - 4, p.y - size * 0.8, 3, size * 1.6);
    this.font(size, 700);
    ctx.fillStyle = "#f4f1ea";
    ctx.fillText(r.nome, p.x + 3, p.y);
    if (tag) { this.font(Math.round(size * 0.82), 600); ctx.fillStyle = busy ? "#7ee2a8" : "#a9a3c4"; ctx.fillText(tag, p.x + 3 + w, p.y); }
  }

  drawTag(c, t) {
    const { camera: cam } = this;
    const head = cam.toScreen(c.x * TILE + TILE / 2, c.y * TILE - 7.5);
    if (head.x < -60 || head.y < -60 || head.x > cam.w + 60 || head.y > cam.h + 60) return;
    const size = Math.round(Math.min(13, Math.max(9, cam.z * 2.4)));
    const sel = this.selected === c.id;
    const atDesk = !c.path.length && c.spot?.pose === "desk";
    if (cam.z >= 2.2 || sel) {
      const name = c.label.length > 14 ? c.label.slice(0, 13) + "…" : c.label;
      const y = atDesk ? cam.toScreen(0, c.y * TILE + TILE + 2).y + size : head.y - size * 0.9;
      this.label(name, head.x, y, sel ? "rgba(255,209,102,.96)" : "rgba(18,14,32,.8)", sel ? "#1d1a2b" : c.main ? CAP : "#ece9f7", size);
    }
    let b = null;
    if (c.leaving) b = "👋";
    else if (c.path.length) b = null;
    else if (c.mode === "attention") b = Math.floor(t * 2) % 2 ? "❗" : "❓";
    else if (c.mode === "chat") b = "💬";
    else if (c.mode === "work") b = toolInfo(c.tool).icon;
    else if (c.spot?.eat || c.spot?.cup) b = FOOD[Math.floor(c.seed + t / 9) % FOOD.length];
    if (!b) return;
    const r = Math.min(15, Math.max(8, cam.z * 3));
    if (atDesk) this.bubble(head.x + 5 * cam.z + r, head.y + 2 * cam.z, b, false, c.seed, t, r);
    else this.bubble(head.x, head.y - (cam.z >= 2.2 || sel ? size * 2.1 : 2), b, c.mode === "attention", c.seed, t, r);
  }

  drawUserTag(t) {
    const { camera: cam } = this;
    const me = this.room("me");
    const head = cam.toScreen(me.user.x * TILE + TILE / 2, me.user.y * TILE - 7.5);
    const size = Math.round(Math.min(13, Math.max(9, cam.z * 2.4)));
    this.label("Você", head.x, head.y - size * 0.9, "rgba(47,158,143,.95)", "#fff", size);
    if (Date.now() / 1000 - this.userTalking < 8) this.bubble(head.x, head.y - size * 2.1, "💬", false, 0, t, Math.min(15, Math.max(8, cam.z * 3)));
  }

  bubble(x, by, icon, alert, seed, t, r) {
    const { ctx } = this;
    const bounce = Math.sin(t * 4 + seed) * 1.5;
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath(); ctx.arc(x + 1, by - r + bounce + 1.5, r, 0, 7); ctx.fill();
    ctx.fillStyle = alert ? "#ff5d73" : "#fffaf0";
    ctx.beginPath(); ctx.arc(x, by - r + bounce, r, 0, 7); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.35, by - r * 0.25 + bounce); ctx.lineTo(x, by + r * 0.4 + bounce); ctx.lineTo(x + r * 0.35, by - r * 0.25 + bounce);
    ctx.fill();
    ctx.font = `${Math.round(r * 1.15)}px system-ui, "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, x, by - r + bounce + r * 0.1);
  }

  minimapRect() {
    const { camera: cam } = this;
    const w = Math.min(190, cam.w * 0.28), h = w * this.L.H / this.L.W;
    return { x: 10, y: cam.h - h - 10, w, h };
  }

  drawMinimap() {
    const { ctx, camera: cam } = this;
    if (cam.z <= cam.fitZoom() * 1.05) return;       // tudo já está à vista
    const m = this.minimapRect();
    ctx.fillStyle = "rgba(15,12,28,.85)";
    ctx.beginPath(); ctx.roundRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6, 6); ctx.fill();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.wc, m.x, m.y, m.w, m.h);
    const k = m.w / (this.L.W * TILE);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 1.5;
    ctx.strokeRect(m.x + cam.x * k, m.y + cam.y * k, (cam.w / cam.z) * k, (cam.h / cam.z) * k);
    for (const c of this.chars.values()) {
      ctx.fillStyle = c.mode === "attention" ? "#ff5d73" : c.mode === "work" ? "#7ee2a8" : "#ece9f7";
      ctx.fillRect(m.x + (c.x * TILE + 4) * k - 1.5, m.y + (c.y * TILE + 4) * k - 1.5, 3, 3);
    }
  }

  // ---------- cliques ----------

  hit(p) {
    if (!this.L) return null;
    const m = this.minimapRect();
    if (this.camera.z > this.camera.fitZoom() * 1.05 && p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h)
      return { mini: { x: (p.x - m.x) / m.w * this.L.W * TILE, y: (p.y - m.y) / m.h * this.L.H * TILE } };
    const w = this.camera.toWorld(p.x, p.y);
    const b = this.L.board;
    if (w.x >= b.x * TILE - 2 && w.x <= (b.x + b.w) * TILE + 2 && w.y >= b.y * TILE - 4 && w.y <= b.y * TILE + 12) return { board: true };
    let best = null, bestD = Math.max(6, 14 / this.camera.z);
    for (const c of this.chars.values()) {
      const d = Math.hypot(w.x - (c.x * TILE + TILE / 2), (w.y - (c.y * TILE + 1)) * 0.7);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) return { char: best.id };
    const r = this.roomAt(Math.floor(w.x / TILE), Math.floor(w.y / TILE));
    if (r?.kind === "me") return { me: true };
    return null;
  }

  click(p) {
    const h = this.hit(p);
    if (!h) return;
    if (h.mini) { const cam = this.camera; cam.follow = null; cam.anim = null; cam.x = h.mini.x - cam.w / cam.z / 2; cam.y = h.mini.y - cam.h / cam.z / 2; cam.clamp(); cam.save(); }
    else if (h.board) this.handlers.onBoard?.();
    else if (h.char) { this.selected = h.char; this.handlers.onSelect?.(h.char); }
    else if (h.me) this.handlers.onMe?.();
  }
}
