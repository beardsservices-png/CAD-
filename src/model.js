// model.js — the drawing document: shapes, layers, persistence, undo/redo.
import {
  v,
  dist,
  pointToSegment,
  bboxOfPoints,
  polygonArea,
  pathLength,
  arcPoints,
  arcLength,
} from "./geometry.js";

let _id = 1;
const nextId = () => `s${_id++}`;

// Default layers. General-purpose, and grouped so a takeoff can total by layer.
export const DEFAULT_LAYERS = [
  { id: "walls", name: "Walls", color: "#1e3a8a", visible: true },
  { id: "structure", name: "Structure", color: "#c2410c", visible: true },
  { id: "objects", name: "Objects", color: "#0f766e", visible: true },
  { id: "detail", name: "Detail", color: "#334155", visible: true },
  { id: "dims", name: "Dimensions", color: "#6d28d9", visible: true },
];

// A shape is a plain object: { id, type, layer, pts:[...], ...props }.
// type ∈ line | wall | rect | polygon | dimension | symbol | circle | text
// Optional 3D props: height (inches, extrusion) and elevation (base height).
export function makeShape(type, props = {}) {
  return { id: nextId(), type, layer: "walls", pts: [], ...props };
}

// Deep-copy a shape and give it a fresh id (used by duplicate/paste).
export function cloneShape(shape) {
  const copy = JSON.parse(JSON.stringify(shape));
  copy.id = nextId();
  return copy;
}

// Default extrusion height (inches) used by the 3D preview when a shape has no
// explicit `height`. This is what turns the 2D plan into a massing model.
export const DEFAULT_HEIGHTS = {
  wall: 96, // 8 ft
  line: 36, // rail-height ribbon
  rect: 6, // a low slab / platform
  polygon: 6,
  circle: 6,
};
export const SYMBOL_HEIGHTS = {
  post: 96, pier: 96, footing: 8, beam: 12, hanger: 6,
  door: 80, window: 48, stairs: 6, railing: 36,
  tree: 144, shrub: 30, bollard: 30, parking: 0,
  chair: 30, table: 30, rtable: 30, sofa: 30,
  north: 0, arrow: 0, target: 0,
};

export function shapeHeight(shape) {
  if (shape.height != null) return shape.height;
  if (shape.type === "symbol") return SYMBOL_HEIGHTS[shape.symbol] ?? 36;
  return DEFAULT_HEIGHTS[shape.type] ?? 0;
}
export function shapeElevation(shape) {
  if (shape.elevation != null) return shape.elevation;
  if (shape.type === "symbol" && shape.symbol === "window") return 36;
  return 0;
}

// Return the polygon/polyline points that define a shape's outline,
// used for hit testing, bbox and rendering fallbacks.
export function shapePoints(shape) {
  if (shape.type === "rect" || shape.type === "circle") {
    const [a, b] = shape.pts;
    return [v(a.x, a.y), v(b.x, a.y), v(b.x, b.y), v(a.x, b.y)];
  }
  return shape.pts;
}

export function shapeClosed(shape) {
  return (
    shape.type === "rect" ||
    shape.type === "circle" ||
    (shape.type === "polygon" && shape.closed)
  );
}

export function shapeBBox(shape) {
  if (shape.type === "arc" && shape.pts.length === 3) {
    return bboxOfPoints(arcPoints(shape.pts[0], shape.pts[1], shape.pts[2], 16));
  }
  return bboxOfPoints(shapePoints(shape));
}

// Line weight (px) and dash pattern from a shape's style props.
export function lineWeightPx(shape, selected) {
  const base = shape.weight || 1;
  return (selected ? 1 : 0) + base * 2;
}
export function dashArray(shape) {
  if (shape.dash === "dashed") return [8, 5];
  if (shape.dash === "dotted") return [1.5, 4];
  return [];
}

// Distance from world point to a shape (for selection). Small = close.
export function shapeDistance(shape, p) {
  const pts = shapePoints(shape);
  if (shape.type === "arc" && shape.pts.length === 3) {
    const sampled = arcPoints(shape.pts[0], shape.pts[1], shape.pts[2], 24);
    let best = Infinity;
    for (let i = 0; i < sampled.length - 1; i++) {
      best = Math.min(best, pointToSegment(p, sampled[i], sampled[i + 1]).dist);
    }
    return best;
  }
  if (shape.type === "symbol" || shape.type === "text") {
    // symbols/text hit-test by their bbox center proximity
    const b = shapeBBox(shape);
    const c = v((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2);
    return dist(p, c);
  }
  if (shape.type === "circle") {
    const b = shapeBBox(shape);
    const c = v((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2);
    const rx = (b.max.x - b.min.x) / 2;
    const ry = (b.max.y - b.min.y) / 2;
    return Math.abs(dist(p, c) - (rx + ry) / 2);
  }
  const closed = shapeClosed(shape);
  let best = Infinity;
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    best = Math.min(best, pointToSegment(p, a, b).dist);
  }
  return best;
}

// Human-readable metrics for the properties panel.
export function shapeMetrics(shape) {
  const pts = shapePoints(shape);
  const closed = shapeClosed(shape);
  const out = {};
  if (shape.type === "symbol" || shape.type === "text") {
    return out;
  }
  if (shape.type === "circle") {
    const b = shapeBBox(shape);
    const rx = (b.max.x - b.min.x) / 2;
    const ry = (b.max.y - b.min.y) / 2;
    out.area = Math.PI * rx * ry;
    // Ramanujan ellipse perimeter approximation
    const h = Math.pow((rx - ry) / (rx + ry || 1), 2);
    out.perimeter = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    return out;
  }
  if (shape.type === "arc" && shape.pts.length === 3) {
    out.length = arcLength(shape.pts[0], shape.pts[1], shape.pts[2]);
    return out;
  }
  if (shape.type === "dimension") {
    out.length = dist(shape.pts[0], shape.pts[1]);
  } else if (closed) {
    out.perimeter = pathLength(pts, true);
    out.area = polygonArea(pts);
  } else {
    out.length = pathLength(pts, false);
  }
  return out;
}

export class Document {
  constructor() {
    this.shapes = [];
    this.layers = DEFAULT_LAYERS.map((l) => ({ ...l }));
    this.activeLayer = "walls";
    this.selection = new Set();
    this._undo = [];
    this._redo = [];
    this.name = "Untitled";
  }

  layer(id) {
    return this.layers.find((l) => l.id === id) || this.layers[0];
  }

  add(shape) {
    this.shapes.push(shape);
    return shape;
  }

  remove(ids) {
    const set = new Set(ids);
    this.shapes = this.shapes.filter((s) => !set.has(s.id));
    ids.forEach((id) => this.selection.delete(id));
  }

  get(id) {
    return this.shapes.find((s) => s.id === id);
  }

  // Topmost shape near world point p within pixel tolerance (converted to world).
  hitTest(p, tolWorld) {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      if (!this.layer(s.layer).visible) continue;
      if (shapeDistance(s, p) <= tolWorld) return s;
    }
    return null;
  }

  // ---- Undo / redo (snapshot based; simple and robust) ----
  snapshot() {
    this._undo.push(this._serializeShapes());
    if (this._undo.length > 100) this._undo.shift();
    this._redo.length = 0;
  }
  undo() {
    if (!this._undo.length) return;
    this._redo.push(this._serializeShapes());
    this._restoreShapes(this._undo.pop());
  }
  redo() {
    if (!this._redo.length) return;
    this._undo.push(this._serializeShapes());
    this._restoreShapes(this._redo.pop());
  }
  _serializeShapes() {
    return JSON.stringify(this.shapes);
  }
  _restoreShapes(json) {
    this.shapes = JSON.parse(json);
    this.selection.clear();
  }

  // ---- Persistence ----
  toJSON() {
    return {
      version: 1,
      name: this.name,
      layers: this.layers,
      activeLayer: this.activeLayer,
      shapes: this.shapes,
    };
  }

  static fromJSON(data) {
    const doc = new Document();
    doc.name = data.name || "Untitled";
    if (data.layers) doc.layers = data.layers;
    if (data.activeLayer) doc.activeLayer = data.activeLayer;
    doc.shapes = data.shapes || [];
    // keep id counter ahead of loaded ids
    doc.shapes.forEach((s) => {
      const n = parseInt(String(s.id).replace(/\D/g, ""), 10);
      if (!isNaN(n) && n >= _id) _id = n + 1;
    });
    return doc;
  }
}
