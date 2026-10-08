// Cenário e móveis em pixel art desenhada por código. Coordenadas em pixels
// do mundo (1 tile = 8 px); o mundo é renderizado em escala 4, então frações
// de 0,25 px ainda caem em pixel inteiro e ficam nítidas.

export const TILE = 8;
const OUT = "#1b1626";

export const PAL = {
  wall: "#231e36", wallTop: "#4a4170", face: "#3d3560", faceL: "#4a4175", base: "#2a2442",
  floorA: "#8d6a45", floorB: "#82603e", floorLine: "#6f5133",
  hallA: "#a39d90", hallB: "#99938a",
  copaA: "#e6e0d0", copaB: "#d6cfbd", meA: "#566a88", meB: "#51647f", dirA: "#7a4f3a", dirB: "#71493a",
  desk: "#b07a45", deskTop: "#c48c55", deskDark: "#7a4f2a", monitor: "#1c1d26", screenOff: "#27324a",
  chair: "#353b52", chairL: "#4a5170",
  window: "#a6dcff", windowL: "#d4f0ff", frame: "#ece6d8", cork: "#c49a66", corkDark: "#94683c",
  plant: "#4caf6a", plantL: "#6fcf8a", plantDark: "#2f7d49", pot: "#c0703a", potD: "#9a5528",
  book1: "#d65a5a", book2: "#5a8ed6", book3: "#e2b84a", book4: "#5ab88e", shelf: "#6b4a2c",
};

export const rect = (ctx, s, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x * s, y * s, w * s, h * s); };
const box = (ctx, s, x, y, w, h, c) => { rect(ctx, s, x - 0.5, y - 0.5, w + 1, h + 1, OUT); rect(ctx, s, x, y, w, h, c); };

// ---------- pisos e paredes ----------

export function drawFloor(ctx, s, x, y, kind) {
  const X = x * TILE, Y = y * TILE, odd = (x + y) % 2;
  if (kind === "hall") {
    rect(ctx, s, X, Y, TILE, TILE, odd ? PAL.hallA : PAL.hallB);
    rect(ctx, s, X, Y, TILE, 0.25, "rgba(0,0,0,.06)");
  } else if (kind === "copa") {
    rect(ctx, s, X, Y, TILE, TILE, odd ? PAL.copaA : PAL.copaB);
    rect(ctx, s, X, Y, TILE, 0.25, "rgba(0,0,0,.08)"); rect(ctx, s, X, Y, 0.25, TILE, "rgba(0,0,0,.08)");
  } else if (kind === "me") {
    rect(ctx, s, X, Y, TILE, TILE, PAL.meA);
    if (odd) rect(ctx, s, X + 2, Y + 2, 1, 1, PAL.meB);
  } else {
    // tábuas de madeira com emendas desencontradas
    const a = kind === "dir" ? PAL.dirA : PAL.floorA, b = kind === "dir" ? PAL.dirB : PAL.floorB;
    rect(ctx, s, X, Y, TILE, TILE / 2, y % 2 ? a : b);
    rect(ctx, s, X, Y + TILE / 2, TILE, TILE / 2, y % 2 ? b : a);
    rect(ctx, s, X, Y + TILE / 2 - 0.25, TILE, 0.25, PAL.floorLine);
    rect(ctx, s, X + ((x * 3 + y * 5) % 8), Y, 0.25, TILE / 2, PAL.floorLine);
  }
}

export function drawWallFace(ctx, s, r, t) {
  const X = r.x * TILE, Y = r.y * TILE, W = r.w * TILE;
  rect(ctx, s, X, Y, W, 2 * TILE, PAL.face);
  for (let i = 0; i < r.w * 2; i++) rect(ctx, s, X + i * 4, Y + 1, 0.25, 2 * TILE - 3, "rgba(0,0,0,.08)");
  rect(ctx, s, X, Y, W, 1, PAL.wallTop);
  rect(ctx, s, X, Y + 2 * TILE - 3, W, 3, r.cor);              // faixa com a cor do departamento
  rect(ctx, s, X, Y + 2 * TILE - 3, W, 0.5, "rgba(255,255,255,.25)");
}

export function drawWindow(ctx, s, x, y, w, night, t) {
  const X = x * TILE, Y = y * TILE + 2.5;
  box(ctx, s, X, Y, w * TILE, 9.5, PAL.frame);
  rect(ctx, s, X + 0.75, Y + 0.75, w * TILE - 1.5, 8, night ? "#14204a" : PAL.window);
  if (night) { for (let i = 0; i < w * 2; i++) rect(ctx, s, X + 2 + ((i * 7) % (w * TILE - 4)), Y + 1.5 + ((i * 3) % 6), 0.5, 0.5, "#fff8d0"); }
  else { rect(ctx, s, X + 2, Y + 1.5, 3, 0.75, PAL.windowL); rect(ctx, s, X + 2, Y + 2.25, 1.5, 0.75, PAL.windowL); }
  for (let i = 1; i < w; i++) rect(ctx, s, X + i * TILE - 0.25, Y + 0.75, 0.5, 8, PAL.frame);
  rect(ctx, s, X - 0.5, Y + 9.5, w * TILE + 1, 1, "#cfc7b4");     // peitoril
}

export function drawClock(ctx, s, x, y) {
  const X = x * TILE + 4, Y = y * TILE + 7, now = new Date();
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(X * s, Y * s, 3.3 * s, 0, 7); ctx.fill();
  ctx.fillStyle = "#f7f3ea"; ctx.beginPath(); ctx.arc(X * s, Y * s, 2.8 * s, 0, 7); ctx.fill();
  const hand = (ang, len, w, c) => {
    ctx.strokeStyle = c; ctx.lineWidth = w * s; ctx.beginPath(); ctx.moveTo(X * s, Y * s);
    ctx.lineTo((X + Math.sin(ang) * len) * s, (Y - Math.cos(ang) * len) * s); ctx.stroke();
  };
  hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2, 1.6, 0.5, "#222");
  hand(now.getMinutes() / 60 * Math.PI * 2, 2.3, 0.35, "#222");
  hand(now.getSeconds() / 60 * Math.PI * 2, 2.4, 0.2, "#d33");
}

export function drawPoster(ctx, s, x, y, cor) {
  const X = x * TILE, Y = y * TILE + 3;
  box(ctx, s, X, Y, 7, 8, "#f4efe2");
  rect(ctx, s, X + 1, Y + 1, 5, 3.5, cor);
  rect(ctx, s, X + 1, Y + 5.5, 5, 0.5, "#9a9488"); rect(ctx, s, X + 1, Y + 6.5, 3.5, 0.5, "#9a9488");
}

export function drawDoorway(ctx, s, x, y) {
  const X = x * TILE, Y = y * TILE;
  rect(ctx, s, X - 1, Y, 2 * TILE + 2, 2 * TILE, "#5a3f2a");
  rect(ctx, s, X, Y + 1, 2 * TILE, 2 * TILE - 1, "#15111f");
  rect(ctx, s, X, Y + 2 * TILE - 2, 2 * TILE, 2, "rgba(255,255,255,.06)");
}

// ---------- móveis ----------

export function drawDesk(ctx, s, x, y, screenOn, t) {
  const X = x * TILE, Y = y * TILE;
  // tampo, frente e pés
  box(ctx, s, X, Y + 1.5, 3 * TILE, 7, PAL.deskTop);
  rect(ctx, s, X, Y + 5.5, 3 * TILE, 3, PAL.desk);
  rect(ctx, s, X + 15, Y + 5.75, 7.5, 2.5, PAL.deskDark);            // gaveteiro
  rect(ctx, s, X + 18, Y + 6.75, 1.5, 0.5, "#e2c79a");
  rect(ctx, s, X + 0.5, Y + 8.5, 1.5, 4, PAL.deskDark); rect(ctx, s, X + 22, Y + 8.5, 1.5, 4, PAL.deskDark);
  // monitor com pé, teclado e caneca
  box(ctx, s, X + 5.5, Y - 6.5, 13, 8.5, PAL.monitor);
  rect(ctx, s, X + 11, Y + 2, 2, 1.5, PAL.monitor); rect(ctx, s, X + 9.5, Y + 3, 5, 0.75, PAL.monitor);
  if (screenOn) {
    rect(ctx, s, X + 6.5, Y - 5.5, 11, 6.5, "#123a5a");
    for (let i = 0; i < 4; i++) {
      const w = 2 + ((Math.floor(t * 4) + i * 5 + x) % 7);
      rect(ctx, s, X + 7.5 + (i % 2), Y - 4.75 + i * 1.5, w, 0.75, ["#5fd3ff", "#ffd166", "#7ee2a8", "#ff9db0"][i]);
    }
    if (Math.floor(t * 2) % 2) rect(ctx, s, X + 7.5 + ((Math.floor(t * 4) + x) % 7) + 2, Y - 0.25, 0.75, 0.75, "#fff");
  } else {
    rect(ctx, s, X + 6.5, Y - 5.5, 11, 6.5, PAL.screenOff);
    rect(ctx, s, X + 7.5, Y - 4.5, 3, 0.75, "rgba(255,255,255,.08)");
  }
  rect(ctx, s, X + 7, Y + 3.75, 10, 1.5, "#2a2d3a"); rect(ctx, s, X + 7.5, Y + 4, 9, 0.5, "#4a4f63");
  box(ctx, s, X + 20, Y + 2.5, 2, 2.5, "#f0ece4"); rect(ctx, s, X + 20, Y + 2.5, 2, 0.6, "#6a3d22");
  rect(ctx, s, X + 1.5, Y + 3, 3, 2, "#f5e9a8");                     // post-it
}

export function drawChair(ctx, s, px, py, front) {
  // cadeira de escritório; px,py = onde fica o pé de quem senta
  if (front) {       // vazia, vista de trás (encosto alto, rodinhas)
    box(ctx, s, px - 3.5, py - 9, 7, 6, PAL.chair);
    rect(ctx, s, px - 3, py - 8.5, 6, 1, PAL.chairL);
    rect(ctx, s, px - 0.5, py - 3, 1, 2, OUT);
    rect(ctx, s, px - 3, py - 1.25, 6, 0.75, OUT);
  } else {           // encosto na frente de quem está sentado de costas
    box(ctx, s, px - 3.5, py - 6, 7, 4.5, PAL.chair);
    rect(ctx, s, px - 3, py - 5.5, 6, 0.75, PAL.chairL);
    rect(ctx, s, px - 0.5, py - 1.5, 1, 1, OUT);
  }
}

export function drawStool(ctx, s, px, py, behind) {
  // banquinho da copa: atrás de quem senta de frente, ou encosto na frente de quem senta de costas
  if (behind) { box(ctx, s, px - 3, py - 10, 6, 4, "#b5652e"); rect(ctx, s, px - 2.5, py - 9.5, 5, 0.75, "#d4844a"); }
  else { box(ctx, s, px - 3, py - 5, 6, 3, "#b5652e"); rect(ctx, s, px - 2.5, py - 4.5, 5, 0.75, "#d4844a"); }
}

export function drawPlant(ctx, s, x, y, t) {
  const X = x * TILE, Y = y * TILE, sway = Math.sin((t || 0) * 1.3 + x) * 0.35;
  box(ctx, s, X + 2, Y + 3, 5, 5, PAL.pot); rect(ctx, s, X + 5, Y + 3, 2, 5, PAL.potD);
  rect(ctx, s, X + 1.5, Y + 2.5, 6, 1.25, PAL.potD);
  box(ctx, s, X + 0.5 + sway, Y - 2.5, 8, 5.5, PAL.plant);
  box(ctx, s, X + 2.5 + sway * 1.5, Y - 6, 4, 4.5, PAL.plantDark);
  rect(ctx, s, X + 1.5 + sway, Y - 1.5, 2, 1, PAL.plantL); rect(ctx, s, X + 3 + sway * 1.5, Y - 5, 1.5, 1, PAL.plantL);
}

export function drawShelf(ctx, s, x, y, w = 2) {
  const X = x * TILE, Y = y * TILE, cs = [PAL.book1, PAL.book2, PAL.book3, PAL.book4];
  box(ctx, s, X, Y - 9, w * TILE, 16, PAL.shelf);
  for (let r = 0; r < 2; r++) {
    rect(ctx, s, X, Y - 9 + 8 * r + 7, w * TILE, 0.75, "#4a3220");
    for (let i = 0; i < w * 4 - 1; i++) {
      const h = 4.5 + ((i * 7 + r) % 3) * 0.75;
      rect(ctx, s, X + 1 + i * 1.9, Y - 9 + 8 * r + 7 - h, 1.5, h, cs[(i + r * 2) % 4]);
    }
  }
}

export function drawTable(ctx, s, x, y, w, h) {
  const X = x * TILE, Y = y * TILE;
  box(ctx, s, X, Y, w * TILE, h * TILE - 2, "#f4efe6");                 // toalha
  for (let i = 0; i < w * 2; i++) rect(ctx, s, X + i * 4, Y, 2, h * TILE - 2, "rgba(214,90,90,.13)");
  rect(ctx, s, X, Y + h * TILE - 2, w * TILE, 2, "#c9bfae");
  for (let i = 0; i < w; i += 2) {                                       // pratos com lanche
    for (const py of [Y + 1.5, Y + h * TILE - 7.5]) {
      box(ctx, s, X + i * TILE + 2, py, 5, 3, "#ffffff");
      rect(ctx, s, X + i * TILE + 3, py + 0.75, 3, 1.5, ["#e0a050", "#d65a5a", "#7bc043", "#f2c14e"][(i / 2) % 4]);
    }
  }
  const m = X + Math.floor(w / 2) * TILE - 4;                           // fruteira
  box(ctx, s, m, Y + 6, 9, 3.5, "#c97a3a");
  rect(ctx, s, m + 1, Y + 4.75, 2, 2, "#e04848"); rect(ctx, s, m + 3.5, Y + 4.5, 2, 2, "#f2c14e"); rect(ctx, s, m + 6, Y + 4.75, 2, 2, "#7bc043");
}

export function drawFridge(ctx, s, x, y) {
  const X = x * TILE, Y = y * TILE;
  box(ctx, s, X, Y - 11, TILE + 1, 19, "#e8edf2");
  rect(ctx, s, X + TILE - 1, Y - 11, 2, 19, "#c9d1da");
  rect(ctx, s, X, Y - 4, TILE + 1, 0.5, "#9aa3ad");
  rect(ctx, s, X + 6.5, Y - 9, 0.75, 3.5, "#8a939d"); rect(ctx, s, X + 6.5, Y - 2.5, 0.75, 4, "#8a939d");
  rect(ctx, s, X + 1.5, Y - 9.5, 1.5, 1.5, "#e04848"); rect(ctx, s, X + 3.5, Y - 8.5, 1.5, 1.5, "#5a8ed6"); rect(ctx, s, X + 2, Y - 1, 2.5, 2, "#f5e9a8");
}

export function drawCounter(ctx, s, x, y, w, t) {
  const X = x * TILE, Y = y * TILE;
  box(ctx, s, X, Y - 3, w * TILE, 10, "#8d8f9c");
  rect(ctx, s, X, Y - 3, w * TILE, 1.5, "#c4c6cf");
  rect(ctx, s, X + 1, Y + 1, w * TILE - 2, 0.5, "#6f717d");
  // cafeteira com vapor
  box(ctx, s, X + 1.5, Y - 12, 7, 9, "#4b4f5e");
  rect(ctx, s, X + 3, Y - 9.5, 4, 3, "#1c1c22"); rect(ctx, s, X + 4, Y - 7, 2, 2.5, "#f0ece4");
  rect(ctx, s, X + 7, Y - 11.25, 0.75, 0.75, Math.floor(t * 2) % 2 ? "#ff5a5a" : "#7a2a2a");
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.8 + i / 3) % 1;
    rect(ctx, s, X + 4.5 + Math.sin((t + i) * 3) * 0.8, Y - 13 - k * 6, 1, 1, `rgba(255,255,255,${0.55 * (1 - k)})`);
  }
  // micro-ondas e cesta de pão
  box(ctx, s, X + 10, Y - 9, 9, 6, "#d8dbe2"); rect(ctx, s, X + 11, Y - 8, 5, 4, "#2a2d3a"); rect(ctx, s, X + 17, Y - 7.5, 1, 1, "#7ee2a8");
  box(ctx, s, X + 20, Y - 5.5, 3.5, 2.5, "#a0703a"); rect(ctx, s, X + 20.5, Y - 7, 2.5, 1.5, "#e0b070");
}

export function drawBoard(ctx, s, x, y, w, count, urgent, t) {
  const X = x * TILE, Y = y * TILE;
  box(ctx, s, X, Y - 0.5, w * TILE, 11, PAL.corkDark);
  rect(ctx, s, X + 0.75, Y + 0.25, w * TILE - 1.5, 9.5, PAL.cork);
  const papers = ["#fff7c2", "#cfe8ff", "#ffd6d6", "#d9f2d0", "#ffffff"];
  for (let i = 0; i < Math.min(count, 8); i++) {
    const px = X + 1.5 + (i % 4) * 7.5, py = Y + 1 + Math.floor(i / 4) * 4.5 + (i % 2) * 0.5;
    rect(ctx, s, px, py, 5.5, 3.75, papers[i % papers.length]);
    rect(ctx, s, px + 2.5, py - 0.25, 0.75, 0.75, "#d33");
    rect(ctx, s, px + 1, py + 1.5, 3.5, 0.4, "#9a9488");
  }
  if (urgent > 0) {
    const on = Math.floor(t * 2) % 2;
    ctx.fillStyle = on ? "#ff5d73" : "#e0455d";
    ctx.beginPath(); ctx.arc((X + w * TILE - 1) * s, (Y - 0.5) * s, 2.6 * s, 0, 7); ctx.fill();
  }
}

export function drawUserDesk(ctx, s, x, y) {
  // mesa de frente: você senta atrás dela, virado pra sala
  const X = x * TILE, Y = y * TILE;
  box(ctx, s, X, Y, 4 * TILE, 9, "#8a5a32");
  rect(ctx, s, X, Y, 4 * TILE, 2, "#a8723f");
  rect(ctx, s, X + 2, Y + 3.5, 28, 0.5, "#6f4526");
  box(ctx, s, X + 3, Y - 5, 11, 6, "#3a3f52");                 // notebook, visto de trás
  rect(ctx, s, X + 8, Y - 3, 1.5, 1.5, "#cfd3dd");
  box(ctx, s, X + 23, Y - 1, 3, 3.5, "#f0ece4");               // caneca
  rect(ctx, s, X + 17, Y - 0.5, 4, 2.5, PAL.book1); rect(ctx, s, X + 17, Y - 1.5, 4, 1, PAL.book2);
  // luminária
  rect(ctx, s, X + 28, Y - 7, 0.75, 7, "#2b2b3a");
  box(ctx, s, X + 26, Y - 9, 4, 2.5, "#e2b84a");
}

export function drawSofa(ctx, s, x, y, w = 3) {
  const X = x * TILE, Y = y * TILE;
  box(ctx, s, X, Y - 4, w * TILE, 5, "#6b4fa0");
  box(ctx, s, X, Y + 1, w * TILE, 4.5, "#8462bf");
  rect(ctx, s, X - 1.5, Y - 2, 2, 7.5, "#5a4290"); rect(ctx, s, X + w * TILE - 0.5, Y - 2, 2, 7.5, "#5a4290");
  for (let i = 1; i < w; i++) rect(ctx, s, X + i * TILE, Y + 1, 0.4, 4.5, "#5a4290");
}

export function drawRug(ctx, s, x, y, w, h, c) {
  const X = x * TILE, Y = y * TILE;
  rect(ctx, s, X, Y, w * TILE, h * TILE, c);
  rect(ctx, s, X + 1, Y + 1, w * TILE - 2, h * TILE - 2, "rgba(255,255,255,.12)");
  rect(ctx, s, X + 2, Y + 2, w * TILE - 4, h * TILE - 4, c);
}

export function drawCooler(ctx, s, x, y, t) {
  const X = x * TILE, Y = y * TILE;
  box(ctx, s, X + 1.5, Y - 4, 5, 11, "#e8edf2");
  box(ctx, s, X + 2, Y - 10, 4, 6, "#9fd6ff");
  rect(ctx, s, X + 2.5, Y - 9 + ((t * 0.5) % 1) * 4, 1, 1, "rgba(255,255,255,.8)");
  rect(ctx, s, X + 3.5, Y - 1, 1, 1, "#5a8ed6");
}

export function drawReception(ctx, s, x, y) {
  // balcão da recepção, de frente pro corredor
  const X = x * TILE, Y = y * TILE;
  box(ctx, s, X, Y, 3 * TILE, 8, "#2fb3c6");
  rect(ctx, s, X, Y, 3 * TILE, 2, "#7fd6e2");
  rect(ctx, s, X + 2, Y + 4, 3 * TILE - 4, 0.5, "#1f8a99");
  box(ctx, s, X + 3, Y - 4, 7, 4.5, "#3a3f52");                 // monitor visto de trás
  box(ctx, s, X + 14, Y - 1.5, 5, 2, "#f4efe2");                // agenda
  rect(ctx, s, X + 14.5, Y - 1, 4, 0.4, "#d65a5a");
  box(ctx, s, X + 20.5, Y - 3, 1.5, 3, "#e2b84a");               // canetas
}
