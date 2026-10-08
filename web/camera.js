// Câmera do escritório: zoom (roda do mouse, pinça, teclado, botões),
// arrastar pra mover, ir até uma sala com transição suave e seguir um agente.
// Coordenadas: mundo em pixels do mundo; tela em pixels CSS do canvas.

const MAX_ZOOM = 9;
const KEY = "sala-camera";

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0; this.y = 0; this.z = 2;          // canto superior esquerdo visível e escala
    this.world = { w: 1, h: 1 };
    this.anim = null;
    this.follow = null;                           // função que devolve {x, y} do alvo
    this.onClick = null;
    this.moved = false;
    this.restored = false;
    this.bind();
  }

  get w() { return this.canvas.clientWidth || 1; }
  get h() { return this.canvas.clientHeight || 1; }
  fitZoom() { return Math.min(this.w / this.world.w, this.h / this.world.h); }
  minZoom() { return this.fitZoom() * 0.85; }

  setWorld(w, h) {
    const first = this.world.w === 1;
    this.world = { w, h };
    if (first && !this.restore()) this.fit(false);
    this.clamp();
  }

  toWorld(sx, sy) { return { x: sx / this.z + this.x, y: sy / this.z + this.y }; }
  toScreen(wx, wy) { return { x: (wx - this.x) * this.z, y: (wy - this.y) * this.z }; }

  clamp() {
    const vw = this.w / this.z, vh = this.h / this.z, m = 24 / this.z;
    // mundo menor que a tela: centraliza; maior: não deixa sair muito da borda
    this.x = vw >= this.world.w ? (this.world.w - vw) / 2 : Math.min(Math.max(this.x, -m), this.world.w - vw + m);
    this.y = vh >= this.world.h ? (this.world.h - vh) / 2 : Math.min(Math.max(this.y, -m), this.world.h - vh + m);
  }

  zoomAt(sx, sy, factor) {
    const before = this.toWorld(sx, sy);
    this.z = Math.min(MAX_ZOOM, Math.max(this.minZoom(), this.z * factor));
    this.x = before.x - sx / this.z;
    this.y = before.y - sy / this.z;
    this.anim = null;
    this.clamp(); this.save();
  }

  zoomBy(f) { this.zoomAt(this.w / 2, this.h / 2, f); }

  // Vai até um retângulo do mundo (uma sala), com folga, animando.
  goTo(rect, animate = true) {
    const pad = 10;
    const z = Math.min(MAX_ZOOM, Math.max(this.minZoom(), Math.min(this.w / (rect.w + pad * 2), this.h / (rect.h + pad * 2))));
    const target = { z, x: rect.x + rect.w / 2 - this.w / z / 2, y: rect.y + rect.h / 2 - this.h / z / 2 };
    this.follow = null;
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) { Object.assign(this, target); this.clamp(); this.save(); return; }
    this.anim = { from: { x: this.x, y: this.y, z: this.z }, to: target, t: 0 };
  }

  fit(animate = true) { this.goTo({ x: 0, y: 0, w: this.world.w, h: this.world.h }, animate); }

  update(dt) {
    if (this.anim) {
      const a = this.anim;
      a.t = Math.min(1, a.t + dt / 0.45);
      const e = 1 - Math.pow(1 - a.t, 3);
      // interpola o zoom em escala log e o centro em linha reta
      const z = Math.exp(Math.log(a.from.z) + (Math.log(a.to.z) - Math.log(a.from.z)) * e);
      const cx0 = a.from.x + this.w / a.from.z / 2, cy0 = a.from.y + this.h / a.from.z / 2;
      const cx1 = a.to.x + this.w / a.to.z / 2, cy1 = a.to.y + this.h / a.to.z / 2;
      const cx = cx0 + (cx1 - cx0) * e, cy = cy0 + (cy1 - cy0) * e;
      this.z = z; this.x = cx - this.w / z / 2; this.y = cy - this.h / z / 2;
      if (a.t >= 1) { this.anim = null; this.save(); }
      this.clamp();
    } else if (this.follow) {
      const p = this.follow();
      if (!p) { this.follow = null; return; }
      const k = Math.min(1, dt * 4);
      this.x += (p.x - this.w / this.z / 2 - this.x) * k;
      this.y += (p.y - this.h / this.z / 2 - this.y) * k;
      this.clamp();
    }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify({ x: this.x, y: this.y, z: this.z, w: this.world.w })); } catch { /* sem armazenamento: tudo bem */ }
  }

  restore() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY));
      if (!c || c.w !== this.world.w) return false;     // planta mudou: começa enquadrando tudo
      Object.assign(this, { x: c.x, y: c.y, z: c.z });
      return true;
    } catch { return false; }
  }

  // ---------- entrada ----------

  bind() {
    const c = this.canvas;
    const pts = new Map();
    let last = null, downAt = null, pinch = null;
    const pos = (e) => { const b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };

    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const p = pos(e);
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) this.zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
      else { this.x += e.deltaX / this.z; this.clamp(); this.save(); }
    }, { passive: false });

    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, pos(e));
      if (pts.size === 1) { last = pos(e); downAt = { ...last, t: performance.now() }; this.moved = false; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; }
    });
    c.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = pos(e);
      pts.set(e.pointerId, p);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d);
        pinch.d = d; this.moved = true;
        return;
      }
      if (!last) return;
      const dx = p.x - last.x, dy = p.y - last.y;
      if (Math.hypot(p.x - downAt.x, p.y - downAt.y) > 4) {
        this.moved = true; this.follow = null; this.anim = null;
        c.style.cursor = "grabbing";
      }
      if (this.moved) { this.x -= dx / this.z; this.y -= dy / this.z; this.clamp(); }
      last = p;
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        c.style.cursor = "";
        if (!this.moved && downAt && this.onClick) this.onClick(pos(e), e);
        if (this.moved) this.save();
        last = downAt = null;
      }
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);

    c.addEventListener("keydown", (e) => {
      const step = 40 / this.z;
      const k = e.key;
      if (k === "+" || k === "=") this.zoomBy(1.25);
      else if (k === "-" || k === "_") this.zoomBy(0.8);
      else if (k === "0") this.fit();
      else if (k === "ArrowLeft" || k === "a") this.x -= step;
      else if (k === "ArrowRight" || k === "d") this.x += step;
      else if (k === "ArrowUp" || k === "w") this.y -= step;
      else if (k === "ArrowDown" || k === "s") this.y += step;
      else return;
      e.preventDefault();
      this.follow = null; this.clamp(); this.save();
    });
  }
}
