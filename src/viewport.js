// viewport.js — camera (pan/zoom) and world<->screen transforms + grid.
import { v, getUnitMode, formatFeetInches } from "./geometry.js";

// Metric grid candidates (mm) converted to inches for the internal system.
const METRIC_CANDIDATES = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].map((mm) => mm / 25.4);
const IMPERIAL_CANDIDATES = [1, 3, 6, 12, 24, 60, 120, 240, 600, 1200];

export class Viewport {
  constructor(canvas) {
    this.canvas = canvas;
    // pixels per world-inch. 4 px/in => 1 ft (12 in) = 48 px on screen.
    this.scale = 4;
    // screen-space offset of world origin (0,0), in CSS pixels.
    this.offsetX = 0;
    this.offsetY = 0;
    this.dpr = window.devicePixelRatio || 1;
  }

  get width() {
    return this.canvas.clientWidth;
  }
  get height() {
    return this.canvas.clientHeight;
  }

  // Center the world origin in the viewport initially.
  centerOrigin() {
    this.offsetX = this.width / 2;
    this.offsetY = this.height / 2;
  }

  worldToScreen(p) {
    return v(p.x * this.scale + this.offsetX, p.y * this.scale + this.offsetY);
  }

  screenToWorld(p) {
    return v((p.x - this.offsetX) / this.scale, (p.y - this.offsetY) / this.scale);
  }

  // Zoom keeping the world point under `screenPt` fixed on screen.
  zoomAt(screenPt, factor) {
    const before = this.screenToWorld(screenPt);
    this.scale = Math.max(0.05, Math.min(200, this.scale * factor));
    const after = this.screenToWorld(screenPt);
    this.offsetX += (after.x - before.x) * this.scale;
    this.offsetY += (after.y - before.y) * this.scale;
  }

  panBy(dx, dy) {
    this.offsetX += dx;
    this.offsetY += dy;
  }

  // Resize the backing store for crisp rendering on HiDPI displays.
  resize() {
    this.dpr = window.devicePixelRatio || 1;
    const c = this.canvas;
    c.width = Math.round(c.clientWidth * this.dpr);
    c.height = Math.round(c.clientHeight * this.dpr);
  }

  // Choose a "nice" grid spacing (in inches) so major lines sit ~60-140px apart.
  gridSpacing() {
    const candidates = getUnitMode() === "metric" ? METRIC_CANDIDATES : IMPERIAL_CANDIDATES;
    for (const c of candidates) {
      if (c * this.scale >= 60) return c;
    }
    return candidates[candidates.length - 1];
  }

  drawGrid(ctx, theme) {
    const spacing = this.gridSpacing();
    const w = this.width;
    const h = this.height;

    const topLeft = this.screenToWorld(v(0, 0));
    const bottomRight = this.screenToWorld(v(w, h));

    const startX = Math.floor(topLeft.x / spacing) * spacing;
    const endX = Math.ceil(bottomRight.x / spacing) * spacing;
    const startY = Math.floor(topLeft.y / spacing) * spacing;
    const endY = Math.ceil(bottomRight.y / spacing) * spacing;

    ctx.save();
    ctx.lineWidth = 1;

    // Minor grid: subdivide the major spacing (÷10 metric, ÷12 imperial).
    const div = getUnitMode() === "metric" ? 10 : 12;
    const sub = spacing >= div ? spacing / div : spacing;
    if (sub * this.scale >= 6) {
      ctx.strokeStyle = theme.gridMinor;
      ctx.beginPath();
      for (let x = startX; x <= endX; x += sub) {
        const s = this.worldToScreen(v(x, 0));
        ctx.moveTo(Math.round(s.x) + 0.5, 0);
        ctx.lineTo(Math.round(s.x) + 0.5, h);
      }
      for (let y = startY; y <= endY; y += sub) {
        const s = this.worldToScreen(v(0, y));
        ctx.moveTo(0, Math.round(s.y) + 0.5);
        ctx.lineTo(w, Math.round(s.y) + 0.5);
      }
      ctx.stroke();
    }

    // Major grid.
    ctx.strokeStyle = theme.gridMajor;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += spacing) {
      const s = this.worldToScreen(v(x, 0));
      ctx.moveTo(Math.round(s.x) + 0.5, 0);
      ctx.lineTo(Math.round(s.x) + 0.5, h);
    }
    for (let y = startY; y <= endY; y += spacing) {
      const s = this.worldToScreen(v(0, y));
      ctx.moveTo(0, Math.round(s.y) + 0.5);
      ctx.lineTo(w, Math.round(s.y) + 0.5);
    }
    ctx.stroke();

    // Axes through the world origin.
    ctx.strokeStyle = theme.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const ox = this.worldToScreen(v(0, 0));
    ctx.moveTo(Math.round(ox.x) + 0.5, 0);
    ctx.lineTo(Math.round(ox.x) + 0.5, h);
    ctx.moveTo(0, Math.round(ox.y) + 0.5);
    ctx.lineTo(w, Math.round(ox.y) + 0.5);
    ctx.stroke();

    ctx.restore();
    return spacing;
  }

  // Isometric graph paper: three families of parallel lines (two receding at
  // 30°, plus verticals) — the grid you'd sketch a 3D view on by hand.
  drawIsoGrid(ctx, theme) {
    const spacing = this.gridSpacing();
    ctx.save();
    ctx.lineWidth = 1;
    const sub = spacing / 2;
    if (sub * this.scale >= 10) {
      ctx.strokeStyle = theme.gridMinor;
      ctx.beginPath();
      for (const a of [Math.PI / 6, -Math.PI / 6, Math.PI / 2]) this._family(ctx, a, sub);
      ctx.stroke();
    }
    ctx.strokeStyle = theme.gridMajor;
    ctx.beginPath();
    for (const a of [Math.PI / 6, -Math.PI / 6, Math.PI / 2]) this._family(ctx, a, spacing);
    ctx.stroke();
    ctx.restore();
    return spacing;
  }

  // One family of parallel world-space lines at `angle`, `step` apart, clipped
  // to the visible area. Path only — caller strokes.
  _family(ctx, angle, step) {
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const perp = { x: -dir.y, y: dir.x };
    const corners = [
      this.screenToWorld(v(0, 0)),
      this.screenToWorld(v(this.width, 0)),
      this.screenToWorld(v(0, this.height)),
      this.screenToWorld(v(this.width, this.height)),
    ];
    const ds = corners.map((p) => p.x * perp.x + p.y * perp.y);
    const kMin = Math.floor(Math.min(...ds) / step);
    const kMax = Math.ceil(Math.max(...ds) / step);
    if (kMax - kMin > 400) return; // too dense to be useful
    const L = (Math.hypot(this.width, this.height) / this.scale) * 1.2;
    for (let k = kMin; k <= kMax; k++) {
      const bx = perp.x * k * step, by = perp.y * k * step;
      const a = this.worldToScreen(v(bx - dir.x * L, by - dir.y * L));
      const b = this.worldToScreen(v(bx + dir.x * L, by + dir.y * L));
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  }

  // Rulers along the top and left edges with real-world coordinate labels, so
  // scale is readable point-to-point without drawing a measure line. `cursor`
  // (screen px) draws position markers on both rulers.
  drawRulers(ctx, theme, cursor) {
    const RS = 22; // ruler thickness in px
    const spacing = this.gridSpacing();
    const w = this.width, h = this.height;
    const topLeft = this.screenToWorld(v(0, 0));
    const bottomRight = this.screenToWorld(v(w, h));

    ctx.save();
    // strips
    ctx.fillStyle = theme.rulerBg;
    ctx.fillRect(0, 0, w, RS);
    ctx.fillRect(0, 0, RS, h);
    ctx.strokeStyle = theme.gridMajor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, RS + 0.5); ctx.lineTo(w, RS + 0.5);
    ctx.moveTo(RS + 0.5, 0); ctx.lineTo(RS + 0.5, h);
    ctx.stroke();

    ctx.fillStyle = theme.rulerText;
    ctx.strokeStyle = theme.rulerText;
    ctx.font = "9px system-ui, sans-serif";

    // top ruler (X)
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const startX = Math.floor(topLeft.x / spacing) * spacing;
    for (let x = startX; x <= bottomRight.x; x += spacing) {
      const sx = Math.round(this.worldToScreen(v(x, 0)).x) + 0.5;
      if (sx < RS + 2) continue;
      ctx.beginPath();
      ctx.moveTo(sx, RS - 6); ctx.lineTo(sx, RS);
      ctx.stroke();
      ctx.fillText(formatFeetInches(x), sx + 3, 3);
    }

    // left ruler (Y)
    const startY = Math.floor(topLeft.y / spacing) * spacing;
    for (let y = startY; y <= bottomRight.y; y += spacing) {
      const sy = Math.round(this.worldToScreen(v(0, y)).y) + 0.5;
      if (sy < RS + 2) continue;
      ctx.beginPath();
      ctx.moveTo(RS - 6, sy); ctx.lineTo(RS, sy);
      ctx.stroke();
      ctx.save();
      ctx.translate(4, sy + 3);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "right";
      ctx.fillText(formatFeetInches(y), 0, 0);
      ctx.restore();
    }

    // cursor position markers
    if (cursor && (cursor.x || cursor.y)) {
      ctx.strokeStyle = theme.selection;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cursor.x, 0); ctx.lineTo(cursor.x, RS);
      ctx.moveTo(0, cursor.y); ctx.lineTo(RS, cursor.y);
      ctx.stroke();
    }

    // corner cap
    ctx.fillStyle = theme.rulerBg;
    ctx.fillRect(0, 0, RS, RS);
    ctx.strokeStyle = theme.gridMajor;
    ctx.strokeRect(0.5, 0.5, RS, RS);
    ctx.restore();
  }
}
