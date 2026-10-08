// Pixel art desenhada por código: móveis e bonequinhos. Tudo em "pixels
// virtuais" (px) que o escritório multiplica pela escala da tela.

export const TILE = 8;

export const PAL = {
  wall: "#2a2440", wallTop: "#4a4170", face: "#3d3560", faceDark: "#332c52",
  floorA: "#8a6643", floorB: "#7c5b3b", hallA: "#9a9488", hallB: "#8f897d",
  copaA: "#d8d2c2", copaB: "#cbc4b2", meA: "#5d6f8a", meB: "#566781",
  desk: "#a06a3a", deskDark: "#7a4f2a", monitor: "#1c1d26", screenOff: "#27324a",
  chair: "#33384d", chairDark: "#252938",
  window: "#9fd6ff", frame: "#e7e1d3", cork: "#b98b57", corkDark: "#94683c",
  plant: "#4caf6a", plantDark: "#2f7d49", pot: "#c0703a",
  book1: "#d65a5a", book2: "#5a8ed6", book3: "#e2b84a", shelf: "#6b4a2c",
  fridge: "#e8edf2", fridgeDark: "#b7c0ca", table: "#b98250", tableDark: "#8f5f35",
  skin: ["#f2c9a0", "#d9a273", "#a8704a", "#7a4e33"],
  hair: ["#2b2118", "#5a3a22", "#c9a35a", "#1f1f2e", "#8a3b2a", "#d8d8d8"],
};

export const rect = (ctx, s, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x * s, y * s, w * s, h * s); };

// ---------- móveis (x, y em tiles; desenham a partir do canto) ----------

export function drawDesk(ctx, s, x, y, screenOn, t) {
  const T = TILE, X = x * T, Y = y * T;
  rect(ctx, s, X, Y + 2, 3 * T, 6, PAL.desk);
  rect(ctx, s, X, Y + 8, 3 * T, 2, PAL.deskDark);
  rect(ctx, s, X + 1, Y + 10, 2, 3, PAL.deskDark);
  rect(ctx, s, X + 3 * T - 3, Y + 10, 2, 3, PAL.deskDark);
  rect(ctx, s, X + 6, Y - 6, 12, 9, PAL.monitor);
  rect(ctx, s, X + 11, Y + 2, 2, 2, PAL.monitor);
  if (screenOn) {
    rect(ctx, s, X + 7, Y - 5, 10, 7, "#1f5f86");
    for (let i = 0; i < 3; i++) {
      const w = 3 + ((Math.floor(t * 3) + i * 5 + x) % 6);
      rect(ctx, s, X + 8, Y - 4 + i * 2, w, 1, i === 1 ? "#ffd166" : "#5fd3ff");
    }
  } else rect(ctx, s, X + 7, Y - 5, 10, 7, PAL.screenOff);
  rect(ctx, s, X + 20, Y + 1, 2, 3, "#e9e9e9");
}

export function drawChairBack(ctx, s, px, py) {
  rect(ctx, s, px - 5, py - 6, 10, 4, PAL.chair);
  rect(ctx, s, px - 5, py - 3, 10, 2, PAL.chairDark);
}

export function drawPlant(ctx, s, x, y) {
  const X = x * TILE, Y = y * TILE;
  rect(ctx, s, X + 2, Y + 3, 5, 5, PAL.pot);
  rect(ctx, s, X, Y - 2, 9, 6, PAL.plant);
  rect(ctx, s, X + 3, Y - 6, 3, 5, PAL.plantDark);
}

export function drawShelf(ctx, s, x, y, w = 2) {
  const X = x * TILE, Y = y * TILE;
  rect(ctx, s, X, Y - 8, w * TILE, 15, PAL.shelf);
  const cs = [PAL.book1, PAL.book2, PAL.book3];
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < w * 3 - 1; i++) rect(ctx, s, X + 2 + i * 2.6, Y - 6 + r * 7, 2, 5, cs[(i + r) % 3]);
}

export function drawTable(ctx, s, x, y, w, h) {
  const X = x * TILE, Y = y * TILE;
  rect(ctx, s, X, Y, w * TILE, h * TILE - 2, PAL.table);
  rect(ctx, s, X, Y + h * TILE - 2, w * TILE, 2, PAL.tableDark);
  // pratos e uma fruteira
  for (let i = 0; i < w; i += 2) {
    rect(ctx, s, X + i * TILE + 2, Y + 2, 5, 3, "#f4f1ea");
    rect(ctx, s, X + i * TILE + 2, Y + h * TILE - 8, 5, 3, "#f4f1ea");
  }
  const m = X + Math.floor(w / 2) * TILE - 4;
  rect(ctx, s, m, Y + 6, 9, 4, "#c97a3a");
  rect(ctx, s, m + 1, Y + 5, 2, 2, "#e04848"); rect(ctx, s, m + 4, Y + 5, 2, 2, "#f2c14e"); rect(ctx, s, m + 7, Y + 5, 2, 2, "#7bc043");
}

export function drawFridge(ctx, s, x, y) {
  const X = x * TILE, Y = y * TILE;
  rect(ctx, s, X, Y - 10, TILE + 2, 18, PAL.fridge);
  rect(ctx, s, X, Y - 3, TILE + 2, 1, PAL.fridgeDark);
  rect(ctx, s, X + 7, Y - 8, 1, 3, PAL.fridgeDark);
  rect(ctx, s, X + 7, Y - 1, 1, 4, PAL.fridgeDark);
}

export function drawCounter(ctx, s, x, y, w, t) {
  const X = x * TILE, Y = y * TILE;
  rect(ctx, s, X, Y - 2, w * TILE, 9, "#8d8f9c");
  rect(ctx, s, X, Y - 3, w * TILE, 2, "#b7b9c4");
  // cafeteira com luz piscando e uma cesta de pão
  rect(ctx, s, X + 2, Y - 11, 7, 9, "#5b5f6e");
  rect(ctx, s, X + 4, Y - 8, 3, 3, "#222");
  rect(ctx, s, X + 7, Y - 10, 1, 1, (t * 2) % 2 < 1 ? "#ff5a5a" : "#7a2a2a");
  rect(ctx, s, X + 12, Y - 6, 8, 4, "#a0703a");
  rect(ctx, s, X + 13, Y - 8, 6, 3, "#e0b070");
}

export function drawBoard(ctx, s, x, y, w, count, urgent, t) {
  const X = x * TILE, Y = y * TILE;
  rect(ctx, s, X - 1, Y - 1, w * TILE + 2, 12, PAL.corkDark);
  rect(ctx, s, X, Y, w * TILE, 10, PAL.cork);
  const papers = ["#fff7c2", "#cfe8ff", "#ffd6d6", "#d9f2d0", "#fff"];
  for (let i = 0; i < Math.min(count, 6); i++)
    rect(ctx, s, X + 2 + i * 5, Y + 2 + (i % 2), 4, 5, papers[i % papers.length]);
  if (urgent > 0) rect(ctx, s, X + w * TILE - 5, Y - 3, 6, 6, Math.floor(t * 2) % 2 ? "#ff5d73" : "#e0455d");
}

export function drawUserDesk(ctx, s, x, y) {
  // mesa de frente: você senta atrás dela, virado pra sala
  const X = x * TILE, Y = y * TILE;
  rect(ctx, s, X, Y, 4 * TILE, 9, PAL.desk);
  rect(ctx, s, X, Y + 9, 4 * TILE, 3, PAL.deskDark);
  rect(ctx, s, X + 3, Y - 4, 11, 6, "#3a3f52");           // notebook aberto, visto de trás
  rect(ctx, s, X + 4, Y - 3, 9, 4, "#4a5068");
  rect(ctx, s, X + 22, Y + 1, 3, 4, "#e9e9e9");
  rect(ctx, s, X + 18, Y + 2, 3, 2, PAL.book1);
}

// ---------- bonequinhos ----------

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function looks(id, shirt, opts = {}) {
  const h = hash(id);
  return { skin: PAL.skin[h % PAL.skin.length], hair: PAL.hair[(h >> 3) % PAL.hair.length],
           shirt: shirt || `hsl(${h % 360} 55% 52%)`, pants: "#2c3350", cap: opts.cap || null };
}

// pose: "stand" | "walk" | "sit" (de frente) | "desk" (de costas, digitando) | "back" (de costas, parado)
export function drawPerson(ctx, s, px, py, lk, pose, t, opts = {}) {
  const x = Math.round(px) - 4, y = Math.round(py) - 14;
  const step = Math.floor(t * 6) % 2;
  if (pose === "desk" || pose === "back") {
    rect(ctx, s, x + 1, y, 6, 6, lk.hair);
    rect(ctx, s, x, y + 6, 8, 5, lk.shirt);
    const up = pose === "desk" ? Math.floor(t * 8) % 2 : 0;
    rect(ctx, s, x - 1, y + 6 + up, 2, 3, lk.shirt);
    rect(ctx, s, x + 7, y + 7 - up, 2, 3, lk.shirt);
    if (lk.cap) rect(ctx, s, x + 1, y - 1, 6, 2, lk.cap);
    return;
  }
  const yy = y + (pose === "walk" ? step : 0) + (pose === "sit" ? 2 : 0);
  rect(ctx, s, x + 1, yy, 6, 2, lk.hair);
  rect(ctx, s, x + 1, yy + 2, 6, 4, lk.skin);
  rect(ctx, s, x + 1, yy + 2, 1, 2, lk.hair);
  rect(ctx, s, x + 6, yy + 2, 1, 2, lk.hair);
  const blink = (t + (opts.seed || 0)) % 4 < 0.12;
  if (!blink) { rect(ctx, s, x + 2, yy + 3, 1, 1, "#1b1b1b"); rect(ctx, s, x + 5, yy + 3, 1, 1, "#1b1b1b"); }
  if (opts.eating && Math.floor(t * 3 + (opts.seed || 0)) % 3 === 0) rect(ctx, s, x + 3, yy + 5, 2, 1, "#7a2a2a");
  if (lk.cap) { rect(ctx, s, x + 1, yy - 1, 6, 2, lk.cap); rect(ctx, s, x + 6, yy, 2, 1, lk.cap); }
  rect(ctx, s, x, yy + 6, 8, 5, lk.shirt);
  if (opts.raise) {
    rect(ctx, s, x + 8, yy + 1 + (Math.floor(t * 4) % 2), 2, 6, lk.shirt);
    rect(ctx, s, x + 8, yy, 2, 2, lk.skin);
  } else {
    rect(ctx, s, x - 1, yy + 7, 1, 3, lk.skin);
    rect(ctx, s, x + 8, yy + 7, 1, 3, lk.skin);
  }
  if (opts.cup) rect(ctx, s, x + 8, yy + 8, 2, 2, "#f5f5f5");
  if (pose === "sit") return;
  const l = pose === "walk" && step ? 1 : 0;
  rect(ctx, s, x + 1, yy + 11, 2, 3 - l, lk.pants);
  rect(ctx, s, x + 5, yy + 11, 2, 2 + l, lk.pants);
}
