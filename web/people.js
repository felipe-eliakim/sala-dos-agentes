// Bonequinhos com o dobro de detalhe: cada "pixel fino" vale meio pixel do
// mundo (o mundo é renderizado em escala 4, então meio pixel ainda é nítido).
// Desenho procedural por partes, com contorno escuro, sombra e acessórios.

const SKIN = [["#f6d3b3", "#e3b48f"], ["#e2ae84", "#c98f63"], ["#b97a52", "#9a603c"], ["#7d4f33", "#633c25"]];
const HAIR = [["#2b2118", "#463427"], ["#5a3a22", "#764e30"], ["#d2a65a", "#e8c27a"], ["#1f1f2e", "#363650"],
              ["#a8432f", "#c45a43"], ["#d9d9d9", "#f2f2f2"], ["#6b3fa0", "#8a5cc4"]];
const STYLES = ["curto", "espetado", "comprido", "coque", "lateral"];
const OUT = "#1b1626";

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function toHex(color) {
  if (color.startsWith("#") && color.length === 7) return color;
  const m = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (!m) return "#7a8699";
  const [h, s, l] = [m[1] / 360, m[2] / 100, m[3] / 100];
  const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
  return "#" + f(0) + f(8) + f(4);
}

// acessório: "bone" (Claude), "fone" (suporte), "oculos" (pesquisa), "prancheta" (planejamento), "chave" (configuração)
export function looks(id, shirt, opts = {}) {
  const h = hash(id);
  const base = toHex(shirt || `hsl(${h % 360} 55% 52%)`);
  const skin = SKIN[h % SKIN.length], hair = HAIR[(h >>> 3) % HAIR.length];
  return { skin: skin[0], skinD: skin[1], hair: hair[0], hairL: hair[1],
           style: opts.style || STYLES[(h >>> 6) % STYLES.length],
           shirt: base, shirtD: shade(base, 0.72), shirtL: shade(base, 1.18),
           pants: ["#2c3350", "#3a2f2a", "#24303a", "#41354f"][(h >>> 9) % 4], shoes: "#3a2a22",
           acc: opts.acc || null, cap: opts.cap || null };
}

// px,py = pé do bonequinho em pixels do mundo. facing: "front" | "back" | "left" | "right"
// pose: "stand" | "walk" | "sit" | "type" | "backsit"
export function drawPerson(ctx, S, px, py, lk, facing, pose, t, opts = {}) {
  const ox = px - 4, oy = py - 14;          // canto do sprite (16x28 finos = 8x14 do mundo)
  const flip = facing === "left";
  const P = (x, y, w, h, c) => {           // retângulo em pixels finos
    if (flip) x = 16 - x - w;
    ctx.fillStyle = c;
    ctx.fillRect((ox + x / 2) * S, (oy + y / 2) * S, (w / 2) * S, (h / 2) * S);
  };
  const step = pose === "walk" ? Math.floor(t * 7 + (opts.seed || 0)) % 2 : 0;
  const bob = pose === "walk" && step ? -1 : 0;
  const seated = pose === "sit" || pose === "backsit" || pose === "type";

  // sombra no chão
  if (!seated) {
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath();
    ctx.ellipse(px * S, (py - 0.2) * S, 3.6 * S, 1.1 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const side = facing === "left" || facing === "right";
  const back = facing === "back";
  const y0 = (seated ? 2 : 0) + bob;

  // ---- pernas e sapatos ----
  if (!seated) {
    if (side) {
      const a = step ? 2 : 0;
      P(6 - a, 21, 3, 5, OUT); P(9 + a, 21, 3, 5, OUT);
      P(6.5 - a, 21, 2, 4.5, lk.pants); P(9.5 + a, 21, 2, 4.5, lk.pants);
      P(5 - a, 25.5, 4, 2.5, OUT); P(9 + a, 25.5, 4, 2.5, OUT);
      P(5.5 - a, 25.5, 3, 1.5, lk.shoes); P(9.5 + a, 25.5, 3, 1.5, lk.shoes);
    } else {
      const l = step ? 1 : 0, r = step ? 0 : (pose === "walk" ? 1 : 0);
      P(4.5, 20, 7, 6, OUT);
      P(5, 20, 2.5, 5 - l, lk.pants); P(8.5, 20, 2.5, 5 - r, lk.pants);
      P(4.5, 25 - l, 3.5, 2.5, OUT); P(8, 25 - r, 3.5, 2.5, OUT);
      P(5, 25 - l, 2.5, 1.5, lk.shoes); P(8.5, 25 - r, 2.5, 1.5, lk.shoes);
    }
  } else if (pose === "sit") {
    P(4.5, 20 + y0 - 2, 7, 3, OUT); P(5, 20 + y0 - 2, 6, 2, lk.pants);
  }

  // ---- tronco e braços ----
  const tw = side ? 7 : 9, tx = side ? 4.5 : 3.5;
  P(tx - 0.5, 12 + y0, tw + 1, 9.5, OUT);
  P(tx, 12.5 + y0, tw, 8.5, lk.shirt);
  P(tx + tw - 2, 12.5 + y0, 2, 8.5, lk.shirtD);
  if (!back && !side) {
    P(6.5, 12.5 + y0, 3, 1.5, lk.shirtL);                   // gola
    if (lk.cap) P(7.5, 14 + y0, 1, 4, "#ffd166");           // gravata dourada do Claude
  }
  const typing = pose === "type";
  if (side) {
    const sw = pose === "walk" ? (step ? 1.5 : -1.5) : 0;
    P(7 + sw, 13 + y0, 2.5, 6.5, OUT); P(7.5 + sw, 13.5 + y0, 1.5, 5, lk.shirtD); P(7.5 + sw, 18.5 + y0, 1.5, 1.5, lk.skin);
  } else if (typing) {
    const up = Math.floor(t * 9 + (opts.seed || 0)) % 2;
    P(1.5, 12.5 + y0 + up, 3, 5, OUT); P(11.5, 12.5 + y0 + (1 - up), 3, 5, OUT);
    P(2, 13 + y0 + up, 2, 3.5, lk.shirt); P(12, 13 + y0 + (1 - up), 2, 3.5, lk.shirt);
  } else if (opts.raise) {
    const wave = Math.floor(t * 4) % 2;
    P(1.5, 13 + y0, 3, 7, OUT); P(2, 13.5 + y0, 2, 5, lk.shirt); P(2, 18.5 + y0, 2, 1.5, lk.skin);
    P(11.5, 4 + y0 + wave, 3, 9.5, OUT); P(12, 5 + y0 + wave, 2, 7, lk.shirt); P(12, 4 + y0 + wave, 2, 2, lk.skin);
  } else {
    const sw = pose === "walk" ? (step ? 1 : -1) : 0;
    P(1.5, 12.5 + y0 + sw, 3, 8, OUT); P(11.5, 12.5 + y0 - sw, 3, 8, OUT);
    P(2, 13 + y0 + sw, 2, 5.5, lk.shirt); P(12, 13 + y0 - sw, 2, 5.5, lk.shirtD);
    P(2, 18.5 + y0 + sw, 2, 1.5, lk.skin); P(12, 18.5 + y0 - sw, 2, 1.5, lk.skin);
    if (opts.cup) { P(12.5, 17 + y0, 3, 3.5, OUT); P(13, 17.5 + y0, 2, 2.5, "#f5f5f5"); P(13, 17.5 + y0, 2, 0.8, "#7a4a2a"); }
    if (lk.acc === "prancheta" && !back) { P(0, 15 + y0, 4, 5, OUT); P(0.5, 15.5 + y0, 3, 4, "#f4efe2"); P(1, 16.5 + y0, 2, 0.5, "#8a8a8a"); P(1, 17.5 + y0, 2, 0.5, "#8a8a8a"); }
    if (lk.acc === "chave" && !back) { P(12.5, 18 + y0, 1, 3.5, "#a9b1bd"); P(12, 21 + y0, 2, 1, "#a9b1bd"); }
  }

  // ---- cabeça ----
  const hy = 1 + y0;
  P(3, hy, 10, 11.5, OUT);
  P(4, hy + 1, 8, 9.5, back ? lk.hair : lk.skin);
  P(5.5, hy + 10.5, 5, 1, OUT);                              // queixo/pescoço
  if (!back) P(6.5, hy + 10.5, 3, 1, lk.skinD);
  // cabelo
  const H = lk.hair, HL = lk.hairL;
  if (back) {
    P(4, hy + 1, 8, 9.5, H); P(5, hy + 1.5, 3, 1, HL);
    if (lk.style === "comprido") P(3.5, hy + 8, 9, 4, H);
    if (lk.style === "coque") { P(5.5, hy - 1.5, 5, 3, OUT); P(6, hy - 1, 4, 2, H); }
  } else if (side) {
    P(4, hy + 1, 8, 3.5, H); P(4, hy + 1, 3.5, 8, H); P(5, hy + 1.5, 4, 1, HL);
    if (lk.style === "comprido") P(3.5, hy + 4, 3, 8, H);
    if (lk.style === "espetado") { P(5, hy - 0.5, 1.5, 1.5, H); P(8, hy - 0.5, 1.5, 1.5, H); }
    P(9.5, hy + 5, 1.2, 1.5, "#1b1b1b");                     // olho
    P(11.5, hy + 6, 1, 1.5, lk.skinD);                       // nariz
    P(9, hy + 8, 1.5, 0.6, "#8a3b3b");
  } else {
    P(4, hy + 1, 8, 3, H); P(5, hy + 1.5, 3, 1, HL);
    if (lk.style === "curto") { P(4, hy + 3.5, 1.5, 2.5, H); P(10.5, hy + 3.5, 1.5, 2.5, H); }
    if (lk.style === "espetado") { P(4.5, hy - 0.5, 1.5, 1.5, H); P(7.25, hy - 1, 1.5, 2, H); P(10, hy - 0.5, 1.5, 1.5, H); P(4, hy + 3.5, 1, 2, H); P(11, hy + 3.5, 1, 2, H); }
    if (lk.style === "comprido") { P(3.5, hy + 3, 2, 9, H); P(10.5, hy + 3, 2, 9, H); }
    if (lk.style === "coque") { P(5.5, hy - 1.5, 5, 3, OUT); P(6, hy - 1, 4, 2, H); P(4, hy + 3.5, 1, 2, H); P(11, hy + 3.5, 1, 2, H); }
    if (lk.style === "lateral") { P(4, hy + 3.5, 5, 1.5, H); P(4, hy + 3.5, 1.5, 3.5, H); }
    const blink = (t + (opts.seed || 0) * 1.7) % 4.2 < 0.13;
    if (blink) { P(5, hy + 6, 2, 0.6, "#1b1b1b"); P(9, hy + 6, 2, 0.6, "#1b1b1b"); }
    else { P(5, hy + 5, 2, 2, "#1b1b1b"); P(9, hy + 5, 2, 2, "#1b1b1b"); P(5.5, hy + 5, 0.8, 0.8, "#fff"); P(9.5, hy + 5, 0.8, 0.8, "#fff"); }
    P(4.5, hy + 7.5, 1.5, 1, "rgba(230,110,110,.45)"); P(10, hy + 7.5, 1.5, 1, "rgba(230,110,110,.45)");
    const chew = opts.eating && Math.floor(t * 3 + (opts.seed || 0)) % 3 === 0;
    P(7, hy + 8, 2, chew ? 1.2 : 0.6, "#8a3b3b");
    if (lk.acc === "oculos") { P(4.5, hy + 4.5, 3, 3, "#2b2b3a"); P(8.5, hy + 4.5, 3, 3, "#2b2b3a"); P(5, hy + 5, 2, 2, "rgba(170,220,255,.55)"); P(9, hy + 5, 2, 2, "rgba(170,220,255,.55)"); P(7.5, hy + 5.5, 1, 0.6, "#2b2b3a"); }
  }
  if (lk.acc === "fone") { P(2.5, hy + 4, 2, 4, OUT); P(11.5, hy + 4, 2, 4, OUT); P(3.5, hy - 0.5, 9, 1.2, OUT); if (!back) P(11, hy + 8, 3, 0.8, OUT); }
  if (lk.cap) {                                              // boné do Claude
    P(3, hy - 1, 10, 3.5, OUT); P(3.5, hy - 0.5, 9, 2.5, lk.cap); P(5, hy, 3, 0.8, "#fff1c4");
    if (!back) { const bx = side ? 11 : 9; P(bx, hy + 1.5, 5, 1.5, OUT); P(bx + 0.5, hy + 1.5, 4, 1, shade(lk.cap, 0.8)); }
  }
}
