// tools.js — interactive drawing/selection tools (a small state machine).
import {
  v,
  add,
  sub,
  dist,
  len,
  constrainAngle,
  formatFeetInches,
  angleDeg,
} from "./geometry.js";
import {
  makeShape,
  shapePoints,
  shapeBBox,
  shapeClosed,
} from "./model.js";
import { label } from "./render.js";
import { symbolById, drawSymbolDef } from "./symbols.js";

// Apply ortho / angle-lock relative to an anchor point when appropriate.
function maybeConstrain(anchor, pt, ev, settings) {
  if (!anchor) return pt;
  const d = sub(pt, anchor);
  if (ev && ev.shiftKey) return add(anchor, constrainAngle(d, 90));
  if (settings.ortho) return add(anchor, constrainAngle(d, 90));
  if (settings.angleLock) return add(anchor, constrainAngle(d, 15));
  return pt;
}

// ---- Base multi-point polyline tool (line / wall / polygon) ----------------
class PolyTool {
  constructor(app, type) {
    this.app = app;
    this.type = type;
    this.pts = [];
    this.cursor = null;
  }
  reset() {
    this.pts = [];
    this.cursor = null;
  }
  onDown(sp) {
    if (this.pts.length) {
      const constrained = maybeConstrain(
        this.pts[this.pts.length - 1],
        sp,
        this._ev,
        this.app.snap
      );
      // Close polygon if clicking near the start.
      if (
        this.type === "polygon" &&
        this.pts.length >= 3 &&
        dist(constrained, this.pts[0]) < this.app.snap.tolPx / this.app.vp.scale
      ) {
        this._commit(true);
        return;
      }
      this.pts.push(constrained);
    } else {
      this.pts.push({ ...sp });
    }
    this.cursor = { ...sp };
  }
  onMove(sp, ev) {
    this._ev = ev;
    this.cursor = maybeConstrain(
      this.pts[this.pts.length - 1],
      sp,
      ev,
      this.app.snap
    );
  }
  onDblClick() {
    this._commit(false);
  }
  onEnter() {
    this._commit(false);
  }
  cancel() {
    this.reset();
  }
  _commit(closed) {
    let pts = this.pts.slice();
    if (this.type !== "polygon") {
      // include the live cursor as the final vertex for line/wall
      if (this.cursor && (pts.length === 0 || dist(this.cursor, pts[pts.length - 1]) > 0.01))
        pts.push({ ...this.cursor });
    }
    if (pts.length >= 2) {
      const props = { pts, layer: this.app.doc.activeLayer };
      if (this.type === "wall") props.thickness = this.app.wallThickness;
      if (this.type === "polygon") props.closed = closed;
      this.app.commit(() => this.app.doc.add(makeShape(this.type, props)));
    }
    this.reset();
  }
  draw(ctx, vp, theme) {
    if (!this.pts.length) return;
    const chain = this.pts.concat(this.cursor ? [this.cursor] : []);
    ctx.save();
    ctx.strokeStyle = theme.selection;
    ctx.lineWidth = this.type === "wall" ? Math.max(2, (this.app.wallThickness || 3.5) * vp.scale) : 2;
    ctx.setLineDash(this.type === "wall" ? [] : [6, 4]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    chain.forEach((p, i) => {
      const s = vp.worldToScreen(p);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.restore();

    // live length + angle of the segment being drawn
    if (this.cursor && this.pts.length) {
      const a = this.pts[this.pts.length - 1];
      const d = sub(this.cursor, a);
      const l = len(d);
      const mid = vp.worldToScreen(v((a.x + this.cursor.x) / 2, (a.y + this.cursor.y) / 2));
      label(
        ctx,
        `${formatFeetInches(l)}  ·  ${Math.round(angleDeg(d))}°`,
        mid.x,
        mid.y - 14,
        theme,
        { bg: theme.dimBg, color: theme.dimText }
      );
    }
  }
}

// ---- Two-point tool (rectangle / dimension) --------------------------------
class TwoPointTool {
  constructor(app, type) {
    this.app = app;
    this.type = type;
    this.p0 = null;
    this.cursor = null;
  }
  reset() {
    this.p0 = null;
    this.cursor = null;
  }
  onDown(sp, ev) {
    if (!this.p0) {
      this.p0 = { ...sp };
      this.cursor = { ...sp };
    } else if (this.type === "circle") {
      const r = dist(this.p0, sp);
      if (r > 0.5) {
        this.app.commit(() =>
          this.app.doc.add(
            makeShape("circle", {
              layer: this.app.doc.activeLayer,
              pts: [v(this.p0.x - r, this.p0.y - r), v(this.p0.x + r, this.p0.y + r)],
            })
          )
        );
      }
      this.reset();
    } else {
      const p1 =
        this.type === "rect" ? maybeConstrain(this.p0, sp, ev, this.app.snap) : sp;
      if (dist(this.p0, p1) > 0.5) {
        const type = this.type === "dimension" ? "dimension" : "rect";
        const layer = this.type === "dimension" ? "dims" : this.app.doc.activeLayer;
        this.app.commit(() =>
          this.app.doc.add(makeShape(type, { pts: [this.p0, p1], layer }))
        );
      }
      this.reset();
    }
  }
  onMove(sp, ev) {
    if (this.p0) this.cursor = this.type === "rect" ? maybeConstrain(this.p0, sp, ev, this.app.snap) : { ...sp };
  }
  cancel() {
    this.reset();
  }
  draw(ctx, vp, theme) {
    if (!this.p0 || !this.cursor) return;
    ctx.save();
    ctx.strokeStyle = theme.selection;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    if (this.type === "rect") {
      const a = vp.worldToScreen(this.p0);
      const b = vp.worldToScreen(this.cursor);
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      const w = Math.abs(this.cursor.x - this.p0.x);
      const h = Math.abs(this.cursor.y - this.p0.y);
      const top = vp.worldToScreen(v((this.p0.x + this.cursor.x) / 2, Math.min(this.p0.y, this.cursor.y)));
      const side = vp.worldToScreen(v(Math.max(this.p0.x, this.cursor.x), (this.p0.y + this.cursor.y) / 2));
      label(ctx, formatFeetInches(w), top.x, top.y - 12, theme, { bg: theme.dimBg, color: theme.dimText });
      label(ctx, formatFeetInches(h), side.x + 22, side.y, theme, { bg: theme.dimBg, color: theme.dimText });
    } else if (this.type === "circle") {
      const c = vp.worldToScreen(this.p0);
      const r = dist(this.p0, this.cursor) * vp.scale;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(vp.worldToScreen(this.cursor).x, vp.worldToScreen(this.cursor).y);
      ctx.stroke();
      label(ctx, `⌀ ${formatFeetInches(dist(this.p0, this.cursor) * 2)}`, c.x, c.y - 14, theme, {
        bg: theme.dimBg,
        color: theme.dimText,
      });
    } else {
      const a = vp.worldToScreen(this.p0);
      const b = vp.worldToScreen(this.cursor);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const mid = v((a.x + b.x) / 2, (a.y + b.y) / 2);
      label(ctx, formatFeetInches(dist(this.p0, this.cursor)), mid.x, mid.y - 12, theme, {
        bg: theme.dimBg,
        color: theme.dimText,
      });
    }
    ctx.restore();
  }
}

// ---- Symbol stamp tool (places a library symbol at its default size) -------
class SymbolTool {
  constructor(app, symbolId) {
    this.app = app;
    this.def = symbolById(symbolId);
    this.symbolId = symbolId;
    this.cursor = null;
  }
  reset() {
    this.cursor = null;
  }
  onDown(sp) {
    const w = (this.def && this.def.w) || 24;
    const h = (this.def && this.def.h) || 24;
    this.app.commit(() =>
      this.app.doc.add(
        makeShape("symbol", {
          symbol: this.symbolId,
          layer: "objects",
          pts: [v(sp.x - w / 2, sp.y - h / 2), v(sp.x + w / 2, sp.y + h / 2)],
        })
      )
    );
  }
  onMove(sp) {
    this.cursor = { ...sp };
  }
  cancel() {
    this.reset();
  }
  draw(ctx, vp, theme) {
    if (!this.cursor || !this.def) return;
    const w = this.def.w * vp.scale;
    const h = this.def.h * vp.scale;
    const s = vp.worldToScreen(this.cursor);
    const box = { x: s.x - w / 2, y: s.y - h / 2, w, h };
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawSymbolDef(ctx, this.def, box, theme.selection, "rgba(37,99,235,0.12)");
    ctx.restore();
  }
}

// ---- Text tool -------------------------------------------------------------
class TextTool {
  constructor(app) {
    this.app = app;
    this.cursor = null;
  }
  reset() {
    this.cursor = null;
  }
  onDown(sp) {
    const text = window.prompt("Text / note:", "");
    if (text && text.trim()) {
      this.app.commit(() =>
        this.app.doc.add(
          makeShape("text", { layer: "detail", pts: [{ ...sp }], text: text.trim(), size: 12 })
        )
      );
    }
  }
  onMove(sp) {
    this.cursor = { ...sp };
  }
  cancel() {
    this.reset();
  }
  draw(ctx, vp, theme) {
    if (!this.cursor) return;
    const s = vp.worldToScreen(this.cursor);
    ctx.save();
    ctx.strokeStyle = theme.selection;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 8);
    ctx.lineTo(s.x, s.y + 8);
    ctx.stroke();
    ctx.restore();
  }
}

// ---- Select / move / edit tool ---------------------------------------------
class SelectTool {
  constructor(app) {
    this.app = app;
    this.mode = null; // 'move' | 'vertex' | 'marquee'
    this.start = null;
    this.last = null;
    this.vertexRef = null;
    this.marquee = null;
    this.moved = false;
  }
  reset() {
    this.mode = null;
    this.start = null;
    this.last = null;
    this.vertexRef = null;
    this.marquee = null;
    this.moved = false;
  }
  onDown(sp, ev, rawWorld) {
    const doc = this.app.doc;
    const tolWorld = 8 / this.app.vp.scale;

    // 1) grab a vertex handle of an already-selected shape
    for (const id of doc.selection) {
      const shape = doc.get(id);
      if (!shape || shape.type === "symbol") continue;
      const pts = shape.pts;
      for (let i = 0; i < pts.length; i++) {
        if (dist(rawWorld, pts[i]) <= tolWorld) {
          this.app.doc.snapshot();
          this.mode = "vertex";
          this.vertexRef = { id, index: i };
          this.last = sp;
          return;
        }
      }
    }

    // 2) click on a shape -> select (+move on drag)
    const hit = doc.hitTest(rawWorld, tolWorld);
    if (hit) {
      if (ev.shiftKey) {
        if (doc.selection.has(hit.id)) doc.selection.delete(hit.id);
        else doc.selection.add(hit.id);
      } else if (!doc.selection.has(hit.id)) {
        doc.selection.clear();
        doc.selection.add(hit.id);
      }
      this.app.doc.snapshot();
      this.mode = "move";
      this.last = sp;
      this.moved = false;
      this.app.refreshPanel();
      return;
    }

    // 3) empty space -> marquee (clear unless shift)
    if (!ev.shiftKey) doc.selection.clear();
    this.mode = "marquee";
    this.start = rawWorld;
    this.marquee = { min: rawWorld, max: rawWorld };
    this.app.refreshPanel();
  }

  onMove(sp, ev, rawWorld) {
    if (this.mode === "move") {
      const dx = (sp.x - this.last.x);
      const dy = (sp.y - this.last.y);
      if (dx || dy) this.moved = true;
      for (const id of this.app.doc.selection) {
        const shape = this.app.doc.get(id);
        if (!shape) continue;
        shape.pts = shape.pts.map((p) => v(p.x + dx, p.y + dy));
      }
      this.last = sp;
    } else if (this.mode === "vertex") {
      const shape = this.app.doc.get(this.vertexRef.id);
      if (shape) {
        let np = sp;
        if (shape.pts.length && this.vertexRef.index > 0) {
          np = maybeConstrain(shape.pts[this.vertexRef.index - 1], sp, ev, this.app.snap);
        }
        shape.pts[this.vertexRef.index] = { ...np };
      }
    } else if (this.mode === "marquee") {
      this.marquee = {
        min: v(Math.min(this.start.x, rawWorld.x), Math.min(this.start.y, rawWorld.y)),
        max: v(Math.max(this.start.x, rawWorld.x), Math.max(this.start.y, rawWorld.y)),
      };
    }
  }

  onUp() {
    if (this.mode === "marquee" && this.marquee) {
      const box = this.marquee;
      const w = box.max.x - box.min.x;
      const h = box.max.y - box.min.y;
      if (w > 1 || h > 1) {
        for (const s of this.app.doc.shapes) {
          if (!this.app.doc.layer(s.layer).visible) continue;
          const b = shapeBBox(s);
          if (b.min.x >= box.min.x && b.max.x <= box.max.x && b.min.y >= box.min.y && b.max.y <= box.max.y)
            this.app.doc.selection.add(s.id);
        }
      }
      this.app.refreshPanel();
    }
    this.reset();
  }

  cancel() {
    this.app.doc.selection.clear();
    this.reset();
    this.app.refreshPanel();
  }

  draw(ctx, vp, theme) {
    if (this.mode === "marquee" && this.marquee) {
      const a = vp.worldToScreen(this.marquee.min);
      const b = vp.worldToScreen(this.marquee.max);
      ctx.save();
      ctx.strokeStyle = theme.selection;
      ctx.fillStyle = "rgba(37,99,235,0.08)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.restore();
    }
  }
}

export function createTool(app, name) {
  // Library symbol tools are addressed as "sym:<id>".
  if (name && name.startsWith("sym:")) {
    return new SymbolTool(app, name.slice(4));
  }
  switch (name) {
    case "select":
      return new SelectTool(app);
    case "line":
    case "wall":
    case "polygon":
      return new PolyTool(app, name);
    case "rect":
    case "dimension":
    case "circle":
      return new TwoPointTool(app, name);
    case "text":
      return new TextTool(app);
    default:
      return new SelectTool(app);
  }
}
