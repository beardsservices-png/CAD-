// view3d.js — a tiny dependency-free software 3D renderer.
//
// It turns the 2D plan into a MASSING MODEL by extruding each shape to its
// height, then draws the faces with an orthographic camera and a painter's
// algorithm (sort far-to-near). This is the conceptual bridge from drafting to
// CAD: one model, viewed in plan (2D) or in 3D — no separate modeling step.
import { shapePoints, shapeBBox, shapeClosed, shapeHeight, shapeElevation } from "./model.js";
import { hexA } from "./render.js";
import { arcPoints } from "./geometry.js";

// ---- minimal 3D vector helpers (z is up) ----
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm3 = (a) => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

export class View3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.doc = null;
    this.cam = { az: -0.9, el: 0.62, scale: 3, target: { x: 0, y: 0, z: 0 } };
    this.light = norm3({ x: -0.4, y: -0.7, z: 0.9 });
    this.dpr = window.devicePixelRatio || 1;
    this.dragging = false;
  }

  setDoc(doc) {
    this.doc = doc;
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.canvas.clientWidth * this.dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * this.dpr);
  }

  orbit(dx, dy) {
    this.cam.az -= dx * 0.008;
    this.cam.el = Math.max(0.05, Math.min(1.5, this.cam.el + dy * 0.008));
  }
  zoom(f) {
    this.cam.scale = Math.max(0.2, Math.min(40, this.cam.scale * f));
  }

  // Snap the camera to a standard orthographic view.
  setView(name) {
    const P = Math.PI;
    const views = {
      top: { az: -P / 2, el: 1.45 },   // plan (looking down)
      front: { az: -P / 2, el: 0.08 }, // looking north
      back: { az: P / 2, el: 0.08 },
      left: { az: P, el: 0.08 },
      right: { az: 0, el: 0.08 },
      iso: { az: -0.9, el: 0.62 },     // SE isometric
    };
    const vw = views[name] || views.iso;
    this.cam.az = vw.az;
    this.cam.el = vw.el;
  }

  // Camera basis from spherical angles; orthographic projection.
  _basis() {
    const { az, el } = this.cam;
    const dir = norm3({
      x: Math.cos(el) * Math.cos(az),
      y: Math.cos(el) * Math.sin(az),
      z: Math.sin(el),
    });
    const worldUp = { x: 0, y: 0, z: 1 };
    const right = norm3(cross3(worldUp, dir));
    const up = cross3(dir, right);
    return { dir, right, up };
  }

  _project(p, basis, cx, cy) {
    const rel = sub3(p, this.cam.target);
    return {
      x: cx + dot3(rel, basis.right) * this.cam.scale,
      y: cy - dot3(rel, basis.up) * this.cam.scale,
      depth: dot3(rel, basis.dir), // higher = nearer camera
    };
  }

  // Build extruded faces from the document.
  _faces() {
    const faces = [];
    if (!this.doc) return faces;
    for (const s of this.doc.shapes) {
      if (s.type === "dimension" || s.type === "text") continue;
      if (!this.doc.layer(s.layer).visible) continue;
      const color = s.color || this.doc.layer(s.layer).color;
      const z0 = shapeElevation(s);
      const z1 = z0 + shapeHeight(s);

      if (s.type === "wall") {
        // solid walls: each segment becomes a box at the wall's thickness
        const pts = s.pts;
        const t = (s.thickness || 3.5) / 2;
        for (let i = 0; i < pts.length - 1; i++) {
          this._segmentBox(faces, pts[i], pts[i + 1], t, z0, z1, color);
        }
      } else if (s.type === "line" || s.type === "arc") {
        // thin vertical ribbons along the path
        const pts = s.type === "arc" && s.pts.length === 3
          ? this._outline(s)
          : s.pts;
        for (let i = 0; i < pts.length - 1; i++) {
          faces.push(this._quad(pts[i], pts[i + 1], z0, z1, color, 0.9));
        }
      } else if (shapeClosed(s)) {
        const poly = this._outline(s);
        // sides
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          faces.push(this._quad(a, b, z0, z1, color, 1));
        }
        // top cap
        faces.push({
          verts: poly.map((p) => ({ x: p.x, y: p.y, z: z1 })),
          color,
          shadeBias: 1.15,
        });
      } else if (s.type === "symbol") {
        // extrude footprint bbox as a box (skip flat annotations)
        if (z1 - z0 <= 0.01) continue;
        const bb = shapeBBox(s);
        const box = [
          { x: bb.min.x, y: bb.min.y },
          { x: bb.max.x, y: bb.min.y },
          { x: bb.max.x, y: bb.max.y },
          { x: bb.min.x, y: bb.max.y },
        ];
        for (let i = 0; i < 4; i++) {
          faces.push(this._quad(box[i], box[(i + 1) % 4], z0, z1, color, 1));
        }
        faces.push({
          verts: box.map((p) => ({ x: p.x, y: p.y, z: z1 })),
          color,
          shadeBias: 1.15,
        });
      }
    }
    return faces;
  }

  // Build a box (4 sides + top) for one wall segment at half-thickness `t`.
  _segmentBox(faces, a, b, t, z0, z1, color) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * t, ny = (dx / l) * t;
    const corners = [
      { x: a.x + nx, y: a.y + ny },
      { x: b.x + nx, y: b.y + ny },
      { x: b.x - nx, y: b.y - ny },
      { x: a.x - nx, y: a.y - ny },
    ];
    for (let i = 0; i < 4; i++) {
      faces.push(this._quad(corners[i], corners[(i + 1) % 4], z0, z1, color, 1));
    }
    faces.push({ verts: corners.map((p) => ({ x: p.x, y: p.y, z: z1 })), color, shadeBias: 1.15 });
  }

  // For circles, approximate the outline with an N-gon so it extrudes to a
  // cylinder; for arcs, sample the curve; otherwise use polygon points.
  _outline(s) {
    if (s.type === "arc" && s.pts.length === 3) {
      return arcPoints(s.pts[0], s.pts[1], s.pts[2], 24);
    }
    if (s.type === "circle") {
      const p = shapePoints(s);
      const cx = (p[0].x + p[2].x) / 2;
      const cy = (p[0].y + p[2].y) / 2;
      const rx = Math.abs(p[2].x - p[0].x) / 2;
      const ry = Math.abs(p[2].y - p[0].y) / 2;
      const N = 40;
      const out = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
      }
      return out;
    }
    return shapePoints(s);
  }

  _quad(a, b, z0, z1, color, alpha) {
    return {
      verts: [
        { x: a.x, y: a.y, z: z0 },
        { x: b.x, y: b.y, z: z0 },
        { x: b.x, y: b.y, z: z1 },
        { x: a.x, y: a.y, z: z1 },
      ],
      color,
      alpha,
    };
  }

  fit() {
    if (!this.doc || !this.doc.shapes.length) return;
    let min = { x: Infinity, y: Infinity }, max = { x: -Infinity, y: -Infinity };
    let maxZ = 0;
    for (const s of this.doc.shapes) {
      if (s.type === "dimension" || s.type === "text") continue;
      for (const p of shapePoints(s)) {
        min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y);
        max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y);
      }
      maxZ = Math.max(maxZ, shapeElevation(s) + shapeHeight(s));
    }
    if (min.x === Infinity) return;
    this.cam.target = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: maxZ / 2 };
    const spanX = (max.x - min.x) || 240;
    const spanY = (max.y - min.y) || 240;
    const span = Math.max(spanX, spanY, maxZ) * 1.5;
    const px = Math.min(this.canvas.clientWidth, this.canvas.clientHeight);
    this.cam.scale = Math.max(0.3, (px / span));
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    // sky/ground backdrop
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#eef2f8");
    g.addColorStop(1, "#dfe6ef");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const basis = this._basis();
    const cx = W / 2, cy = H * 0.58;

    this._drawGround(ctx, basis, cx, cy);

    const faces = this._faces();
    // project + compute average depth + shading
    const drawList = [];
    for (const f of faces) {
      const proj = f.verts.map((v) => this._project(v, basis, cx, cy));
      const depth = proj.reduce((s, p) => s + p.depth, 0) / proj.length;
      // face normal for shading
      const e1 = sub3(f.verts[1], f.verts[0]);
      const e2 = sub3(f.verts[2], f.verts[0]);
      const n = norm3(cross3(e1, e2));
      const lit = 0.45 + 0.55 * Math.abs(dot3(n, this.light));
      drawList.push({ proj, f, depth, lit });
    }
    drawList.sort((a, b) => a.depth - b.depth); // far first

    for (const d of drawList) {
      const shade = Math.min(1, d.lit * (d.f.shadeBias || 1));
      ctx.beginPath();
      d.proj.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = shadeColor(d.f.color, shade, d.f.alpha ?? 1);
      ctx.fill();
      ctx.strokeStyle = "rgba(15,23,42,0.25)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    this._drawGizmo(ctx, basis, 54, H - 54);
  }

  // Orientation triad (bottom-left): which way is up / north / east.
  _drawGizmo(ctx, basis, ox, oy) {
    const axes = [
      { v: { x: 1, y: 0, z: 0 }, c: "#dc2626", label: "E" },
      { v: { x: 0, y: 1, z: 0 }, c: "#16a34a", label: "N" },
      { v: { x: 0, y: 0, z: 1 }, c: "#2563eb", label: "Up" },
    ];
    const L = 30;
    ctx.save();
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 2;
    for (const a of axes) {
      const sx = ox + dot3(a.v, basis.right) * L;
      const sy = oy - dot3(a.v, basis.up) * L;
      ctx.strokeStyle = a.c;
      ctx.fillStyle = a.c;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = a.c;
      ctx.stroke();
      ctx.fillStyle = a.c;
      ctx.fillText(a.label, sx, sy + 0.5);
    }
    ctx.restore();
  }

  // A faint ground grid so the massing reads against a plane.
  _drawGround(ctx, basis, cx, cy) {
    if (!this.doc) return;
    const step = 60; // 5 ft
    const t = this.cam.target;
    const half = 20 * step;
    ctx.strokeStyle = "rgba(100,116,139,0.18)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = -20; i <= 20; i++) {
      const gx = Math.round(t.x / step) * step + i * step;
      const a = this._project({ x: gx, y: t.y - half, z: 0 }, basis, cx, cy);
      const b = this._project({ x: gx, y: t.y + half, z: 0 }, basis, cx, cy);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      const gy = Math.round(t.y / step) * step + i * step;
      const c = this._project({ x: t.x - half, y: gy, z: 0 }, basis, cx, cy);
      const d = this._project({ x: t.x + half, y: gy, z: 0 }, basis, cx, cy);
      ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    }
    ctx.stroke();
  }
}

// Multiply a hex color's brightness by `shade` (0..~1.15) and apply alpha.
function shadeColor(hex, shade, alpha) {
  if (!hex || hex[0] !== "#") return hexA("#64748b", alpha);
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  // lift toward white a bit so extrusions don't look muddy
  r = Math.min(255, Math.round(r * shade + 40 * shade));
  g = Math.min(255, Math.round(g * shade + 40 * shade));
  b = Math.min(255, Math.round(b * shade + 40 * shade));
  return `rgba(${r},${g},${b},${alpha})`;
}
