// viewport.js — camera (pan/zoom) and world<->screen transforms + grid.
import { v } from "./geometry.js";

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
    const candidates = [1, 3, 6, 12, 24, 60, 120, 240, 600, 1200];
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

    // Minor grid: subdivide the major spacing into a "foot-ish" sub-grid.
    const sub = spacing >= 12 ? spacing / 12 : spacing; // ~1 ft major -> 1 in minor
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
}
