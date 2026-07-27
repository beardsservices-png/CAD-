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
import { symbolById } from "./symbols.js";

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
  // boards lying flat extrude by their thickness; on-edge boards by their depth
  "2x4": 1.5, "2x6": 1.5, "2x8": 1.5, "2x10": 1.5, "2x12": 1.5,
  "2x4edge": 3.5, "2x8edge": 7.25, "2x10edge": 9.25,
  "1x6": 0.75, deckpt: 1,
  "4x4": 96, "6x6": 96, "4x4pt": 96, "6x6pt": 96,
  "4x4elev": 3.5, "6x6elev": 5.5, // drawn in elevation, so shallow in plan
  post: 96, pier: 96, footing: 8, beam: 12, hanger: 6,
  door: 80, window: 48, stairs: 6, railing: 36,
  tree: 144, shrub: 30, bollard: 30, parking: 0,
  chair: 30, table: 30, rtable: 30, sofa: 30,
  north: 0, arrow: 0, target: 0,
};

// 3D materials — base color + a procedural texture hint used by the renderer.
export const MATERIALS = [
  { id: "auto", name: "Auto (by object)", color: null, tex: null },
  { id: "wood", name: "Wood", color: "#c39a5f", tex: "grain" },
  { id: "ply", name: "Plywood", color: "#d8b57e", tex: "grain" },
  { id: "pt", name: "Pressure-treated", color: "#7c9b5b", tex: "grain" },
  { id: "metal", name: "Metal", color: "#9aa4b0", tex: "sheen" },
  { id: "concrete", name: "Concrete", color: "#9ca3af", tex: "speckle" },
  { id: "brick", name: "Brick", color: "#a1543b", tex: "courses" },
  { id: "drywall", name: "Drywall / Paint", color: "#e9e7e2", tex: null },
  { id: "glass", name: "Glass", color: "#8fd0e6", tex: "glass" },
  { id: "shingle", name: "Shingle", color: "#4b5563", tex: "courses" },
];
export const MATERIAL_BY_ID = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));

// Infer a material from a symbol when the shape doesn't set one explicitly.
const SYMBOL_MATERIAL = {
  plywood: "ply", osb: "ply", ply34: "ply", "1x6": "wood",
  deckpt: "pt", "4x4pt": "pt", "6x6pt": "pt", "4x4elev": "pt", "6x6elev": "pt",
  dogear: "pt", dogearpanel: "pt", privacy: "pt", deckrun: "wood",
  cmu16: "concrete", cmu8: "concrete", concpad: "concrete", pier12: "concrete", brick: "brick", brickveneer: "brick",
  metalroof: "metal", chainlink: "metal", anglebracket: "metal", postbase: "metal", hurricanetie: "metal",
  lagbolt: "metal", carriagebolt: "metal", deckscrew: "metal", nailplate: "metal", furnace: "metal", minisplit: "metal",
  drywall48: "drywall", drywall412: "drywall", stucco: "drywall",
  skylight: "glass", window: "glass", shingle: "shingle",
};

// Resolve a shape's material object (or null to use its plain color).
export function materialFor(shape) {
  if (shape.material && shape.material !== "auto") return MATERIAL_BY_ID[shape.material] || null;
  if (shape.type === "symbol") {
    const m = SYMBOL_MATERIAL[shape.symbol];
    if (m) return MATERIAL_BY_ID[m];
    const def = symbolById(shape.symbol);
    if (def && (def.category === "Lumber" || def.category === "Decking & Stairs")) return MATERIAL_BY_ID.wood;
  }
  return null;
}

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
  if (shape.existing) return [7, 5]; // reference geometry always reads dashed
  if (shape.dash === "dashed") return [8, 5];
  if (shape.dash === "dotted") return [1.5, 4];
  return [];
}

// "Existing" / reference geometry: context you draw to work against — the
// house wall a deck ties into, a patio surface, a property line. It draws
// greyed-out, is excluded from materials and takeoff totals, but still snaps
// so you can pull real geometry off it.
export function isReference(shape) {
  return !!shape.existing;
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
    // Build-step playback: shapes with step > stepFilter are hidden.
    // Infinity = show everything. Transient (not serialized).
    this.stepFilter = Infinity;
    // Which way you're looking at the drawing. "plan" = from above (canvas Y
    // is depth, thickness rises toward you); "elevation" = from the side
    // (canvas Y is height, thickness goes back into the drawing). Drives how
    // the 3D view builds the model.
    this.viewMode = "plan";
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

  // ---- groups ----
  // All shape ids in `shape`'s group (or just itself if ungrouped).
  groupIds(shape) {
    if (!shape.group) return [shape.id];
    return this.shapes.filter((s) => s.group === shape.group).map((s) => s.id);
  }
  // Expand the current selection to include every member of any touched group.
  expandGroups() {
    const groups = new Set();
    for (const id of this.selection) {
      const s = this.get(id);
      if (s && s.group) groups.add(s.group);
    }
    if (!groups.size) return;
    for (const s of this.shapes) if (s.group && groups.has(s.group)) this.selection.add(s.id);
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
      viewMode: this.viewMode,
      layers: this.layers,
      activeLayer: this.activeLayer,
      shapes: this.shapes,
    };
  }

  static fromJSON(data) {
    const doc = new Document();
    doc.name = data.name || "Untitled";
    doc.viewMode = ["elevation", "iso"].includes(data.viewMode) ? data.viewMode : "plan";
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
