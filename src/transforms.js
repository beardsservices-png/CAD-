// transforms.js — precise editing operations on the current selection:
// duplicate, rotate, mirror, offset, and exact numeric resizing.
import { v } from "./geometry.js";
import { shapePoints, shapeBBox, shapeClosed, cloneShape } from "./model.js";

// ---- offset / parallel copy -----------------------------------------------
function edgeNormal(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: -dy / l, y: dx / l }; // left-hand normal
}
function offsetPolyline(pts, dist, closed) {
  const n = pts.length;
  if (n < 2) return null;
  const res = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < n - 1;
    if (hasPrev && hasNext) {
      const n1 = edgeNormal(prev, cur), n2 = edgeNormal(cur, next);
      let bx = n1.x + n2.x, by = n1.y + n2.y;
      const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
      const dot = Math.max(0.3, n1.x * bx + n1.y * by); // clamp miter blow-up
      res.push(v(cur.x + (bx * dist) / dot, cur.y + (by * dist) / dot));
    } else if (hasNext) {
      const nn = edgeNormal(cur, next);
      res.push(v(cur.x + nn.x * dist, cur.y + nn.y * dist));
    } else {
      const nn = edgeNormal(prev, cur);
      res.push(v(cur.x + nn.x * dist, cur.y + nn.y * dist));
    }
  }
  return res;
}

// Return a new shape offset from `shape` by `dist` (parallel copy). null if the
// shape type isn't offsettable or the result would collapse.
export function offsetShape(shape, dist) {
  const copy = cloneShape(shape);
  if (shape.type === "circle") {
    const b = shapeBBox(shape);
    const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
    const rx = (b.max.x - b.min.x) / 2 + dist, ry = (b.max.y - b.min.y) / 2 + dist;
    if (rx <= 0 || ry <= 0) return null;
    copy.pts = [v(cx - rx, cy - ry), v(cx + rx, cy + ry)];
    return copy;
  }
  if (shape.type === "rect") {
    const b = shapeBBox(shape);
    const x0 = b.min.x - dist, y0 = b.min.y - dist, x1 = b.max.x + dist, y1 = b.max.y + dist;
    if (x1 <= x0 || y1 <= y0) return null;
    copy.pts = [v(x0, y0), v(x1, y1)];
    return copy;
  }
  if (shape.type === "line" || shape.type === "polygon") {
    const pts = shape.type === "polygon" ? shapePoints(shape) : shape.pts;
    const off = offsetPolyline(pts, dist, shapeClosed(shape));
    if (!off) return null;
    copy.pts = off;
    return copy;
  }
  return null;
}

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

// Scale the selection away from a fixed `anchor` point. Bounding-box shapes
// are re-normalised so their two stored points stay min/max ordered.
export function scaleSelection(doc, ids, anchor, sx, sy) {
  const cx = Math.max(0.001, sx);
  const cy = Math.max(0.001, sy);
  for (const id of ids) {
    const s = doc.get(id);
    if (!s || s.locked) continue;
    s.pts = s.pts.map((p) => v(anchor.x + (p.x - anchor.x) * cx, anchor.y + (p.y - anchor.y) * cy));
    if (s.pts.length === 2 && (s.type === "rect" || s.type === "circle" || s.type === "symbol")) {
      const [a, b] = s.pts;
      s.pts = [v(Math.min(a.x, b.x), Math.min(a.y, b.y)), v(Math.max(a.x, b.x), Math.max(a.y, b.y))];
    }
    if (s.type === "rect" && s.radius) s.radius *= (cx + cy) / 2;
  }
}

// ---- framing layout ---------------------------------------------------------
// Fill a closed shape's bounding box with evenly spaced members (joists,
// studs, rafters) at a given on-centre spacing. Returns new shape objects —
// real geometry with a lumber material, so they land in the materials list
// with their true lengths.
export function generateFraming(shape, opts = {}) {
  const {
    spacing = 16,      // inches on centre
    thickness = 1.5,   // actual lumber thickness (2x = 1.5")
    dir = "v",         // "v" = members run vertically, spaced left→right
    layer = "structure",
    material = "wood",
  } = opts;
  const b = shapeBBox(shape);
  const w = b.max.x - b.min.x;
  const h = b.max.y - b.min.y;
  if (w <= 0 || h <= 0 || spacing <= 0) return [];

  const span = dir === "v" ? w : h;
  const count = Math.max(2, Math.floor(span / spacing) + 1);
  const out = [];
  for (let i = 0; i < count; i++) {
    let at = i * spacing;
    // keep the final member flush inside the far edge rather than overhanging
    if (at + thickness > span) at = span - thickness;
    if (at < 0) at = 0;
    const pts = dir === "v"
      ? [v(b.min.x + at, b.min.y), v(b.min.x + at + thickness, b.max.y)]
      : [v(b.min.x, b.min.y + at), v(b.max.x, b.min.y + at + thickness)];
    out.push(cloneShape({
      id: "tmp", type: "rect", layer, material, pts, fill: "light",
    }));
    if (at === span - thickness) break; // reached the end
  }
  return out;
}

// ---- translation & positioning --------------------------------------------

export function translateShapes(doc, ids, dx, dy) {
  for (const id of ids) {
    const s = doc.get(id);
    if (s) s.pts = s.pts.map((p) => v(p.x + dx, p.y + dy));
  }
}

// Move a single shape so its bbox min corner sits at (x, y).
export function setPosition(doc, id, x, y) {
  const s = doc.get(id);
  if (!s) return;
  const b = shapeBBox(s);
  translateShapes(doc, [id], x - b.min.x, y - b.min.y);
}

// ---- align & distribute (multi-selection) ---------------------------------

// edge ∈ left|hcenter|right|top|vmiddle|bottom
export function alignSelection(doc, ids, edge) {
  const boxes = ids.map((id) => ({ id, b: shapeBBox(doc.get(id)) })).filter((x) => x.b);
  if (boxes.length < 2) return;
  const all = boxes.map((x) => x.b);
  const minX = Math.min(...all.map((b) => b.min.x));
  const maxX = Math.max(...all.map((b) => b.max.x));
  const minY = Math.min(...all.map((b) => b.min.y));
  const maxY = Math.max(...all.map((b) => b.max.y));
  for (const { id, b } of boxes) {
    let dx = 0, dy = 0;
    if (edge === "left") dx = minX - b.min.x;
    else if (edge === "right") dx = maxX - b.max.x;
    else if (edge === "hcenter") dx = (minX + maxX) / 2 - (b.min.x + b.max.x) / 2;
    else if (edge === "top") dy = minY - b.min.y;
    else if (edge === "bottom") dy = maxY - b.max.y;
    else if (edge === "vmiddle") dy = (minY + maxY) / 2 - (b.min.y + b.max.y) / 2;
    translateShapes(doc, [id], dx, dy);
  }
}

// Evenly space selected shapes along an axis ("h" or "v") by their centers.
export function distributeSelection(doc, ids, axis) {
  const items = ids
    .map((id) => ({ id, b: shapeBBox(doc.get(id)) }))
    .filter((x) => x.b)
    .map((x) => ({ ...x, c: axis === "h" ? (x.b.min.x + x.b.max.x) / 2 : (x.b.min.y + x.b.max.y) / 2 }))
    .sort((a, b) => a.c - b.c);
  if (items.length < 3) return;
  const first = items[0].c, last = items[items.length - 1].c;
  const step = (last - first) / (items.length - 1);
  items.forEach((it, i) => {
    const target = first + step * i;
    const d = target - it.c;
    translateShapes(doc, [it.id], axis === "h" ? d : 0, axis === "h" ? 0 : d);
  });
}
