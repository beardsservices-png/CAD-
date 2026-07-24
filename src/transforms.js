// transforms.js — precise editing operations on the current selection:
// duplicate, rotate, mirror, and exact numeric resizing.
import { v } from "./geometry.js";
import { shapePoints, shapeBBox, cloneShape } from "./model.js";

// Union bbox center of a set of shapes — the pivot for rotate/mirror.
export function selectionCenter(doc, ids) {
  let min = v(Infinity, Infinity), max = v(-Infinity, -Infinity);
  for (const id of ids) {
    const s = doc.get(id);
    if (!s) continue;
    const b = shapeBBox(s);
    min = v(Math.min(min.x, b.min.x), Math.min(min.y, b.min.y));
    max = v(Math.max(max.x, b.max.x), Math.max(max.y, b.max.y));
  }
  return v((min.x + max.x) / 2, (min.y + max.y) / 2);
}

function rotPt(p, c, ang) {
  const s = Math.sin(ang), co = Math.cos(ang);
  const dx = p.x - c.x, dy = p.y - c.y;
  return v(c.x + dx * co - dy * s, c.y + dx * s + dy * co);
}

// Rotate the selection by `angDeg` around its center.
export function rotateSelection(doc, ids, angDeg) {
  const c = selectionCenter(doc, ids);
  const ang = (angDeg * Math.PI) / 180;
  for (const id of ids) {
    const s = doc.get(id);
    if (!s) continue;
    if (s.type === "circle") {
      // a circle stays a circle: rotate its center, keep radius
      const b = shapeBBox(s);
      const ctr = rotPt(v((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2), c, ang);
      const rx = (b.max.x - b.min.x) / 2, ry = (b.max.y - b.min.y) / 2;
      s.pts = [v(ctr.x - rx, ctr.y - ry), v(ctr.x + rx, ctr.y + ry)];
    } else if (s.type === "symbol") {
      const b = shapeBBox(s);
      const ctr = rotPt(v((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2), c, ang);
      const hw = (b.max.x - b.min.x) / 2, hh = (b.max.y - b.min.y) / 2;
      s.pts = [v(ctr.x - hw, ctr.y - hh), v(ctr.x + hw, ctr.y + hh)];
      s.rot = (s.rot || 0) + ang; // render/3D honor this
    } else if (s.type === "rect") {
      // an axis-aligned rect becomes a polygon once rotated off-axis
      const rotated = shapePoints(s).map((p) => rotPt(p, c, ang));
      s.type = "polygon";
      s.closed = true;
      s.pts = rotated;
    } else {
      s.pts = s.pts.map((p) => rotPt(p, c, ang));
    }
  }
}

// Mirror the selection across its center. axis "h" flips left/right, "v" top/bottom.
export function mirrorSelection(doc, ids, axis) {
  const c = selectionCenter(doc, ids);
  const flip = (p) =>
    axis === "h" ? v(2 * c.x - p.x, p.y) : v(p.x, 2 * c.y - p.y);
  for (const id of ids) {
    const s = doc.get(id);
    if (!s) continue;
    if (s.type === "rect" || s.type === "circle" || s.type === "symbol") {
      // bbox shapes: mirror both corners, then re-normalize to min/max
      const pts = s.pts.map(flip);
      const minx = Math.min(pts[0].x, pts[1].x), maxx = Math.max(pts[0].x, pts[1].x);
      const miny = Math.min(pts[0].y, pts[1].y), maxy = Math.max(pts[0].y, pts[1].y);
      s.pts = [v(minx, miny), v(maxx, maxy)];
      if (s.type === "symbol" && s.rot) s.rot = -s.rot;
    } else {
      s.pts = s.pts.map(flip);
    }
  }
}

// Deep-copy the given shapes, offset them, add them, and return the new ids.
export function duplicateShapes(doc, ids, dx, dy) {
  const newIds = [];
  for (const id of ids) {
    const s = doc.get(id);
    if (!s) continue;
    const copy = cloneShape(s);
    copy.pts = copy.pts.map((p) => v(p.x + dx, p.y + dy));
    doc.add(copy);
    newIds.push(copy.id);
  }
  return newIds;
}

// Linear array: N copies stepped by (dx,dy). Returns all new ids.
export function arraySelection(doc, ids, count, dx, dy) {
  const all = [];
  for (let i = 1; i <= count; i++) {
    all.push(...duplicateShapes(doc, ids, dx * i, dy * i));
  }
  return all;
}

// ---- exact numeric resizing (single shape) --------------------------------

// Resize a rect to exact width/height, keeping its min (top-left) corner.
export function setRectSize(shape, width, height) {
  const b = shapeBBox(shape);
  shape.pts = [v(b.min.x, b.min.y), v(b.min.x + width, b.min.y + height)];
}

// Resize a circle to an exact diameter, keeping its center.
export function setCircleDiameter(shape, diameter) {
  const b = shapeBBox(shape);
  const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
  const r = diameter / 2;
  shape.pts = [v(cx - r, cy - r), v(cx + r, cy + r)];
}

// Set an exact length for a 2-point line/wall/dimension, keeping the first point
// and current direction.
export function setSegmentLength(shape, length) {
  if (shape.pts.length < 2) return;
  const a = shape.pts[0], b = shape.pts[shape.pts.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  shape.pts[shape.pts.length - 1] = v(a.x + (dx / l) * length, a.y + (dy / l) * length);
}
