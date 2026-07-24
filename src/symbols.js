// symbols.js — the extensible shape/symbol library.
//
// Each symbol is drawn from a list of primitives in a NORMALIZED 0..1 box,
// so new symbols are pure data — no per-symbol render code. `w`/`h` are the
// default real-world footprint in inches when the symbol is stamped.
//
// Primitive shapes:
//   { t:"rect",    x,y,w,h,           fill? }
//   { t:"circle",  cx,cy,r,           fill? }
//   { t:"ellipse", cx,cy,rx,ry,       fill? }
//   { t:"line",    x1,y1,x2,y2 }
//   { t:"poly",    pts:[[x,y],...], closed?, fill? }
//   { t:"arc",     cx,cy,r,a0,a1 }        (radians)

export const CATEGORIES = [
  "Geometric",
  "Lumber",
  "Masonry & Concrete",
  "Fencing",
  "Structural",
  "Architectural",
  "Site & Landscape",
  "Furniture",
  "Annotation",
];

// Grain lines for a lumber cross-section (a few lines along the length).
function grain(along = "h") {
  const p = [];
  if (along === "h") {
    for (const y of [0.3, 0.5, 0.7]) p.push({ t: "line", x1: 0.04, y1: y, x2: 0.96, y2: y });
  } else {
    for (const x of [0.3, 0.5, 0.7]) p.push({ t: "line", x1: x, y1: 0.04, x2: x, y2: 0.96 });
  }
  return p;
}

export const SYMBOLS = [
  // ---- Geometric ----------------------------------------------------------
  { id: "sq", name: "Square", category: "Geometric", w: 24, h: 24,
    prims: [{ t: "rect", x: 0.05, y: 0.05, w: 0.9, h: 0.9 }] },
  { id: "circle", name: "Circle", category: "Geometric", w: 24, h: 24,
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.45 }] },
  { id: "triangle", name: "Triangle", category: "Geometric", w: 24, h: 24,
    prims: [{ t: "poly", pts: [[0.5, 0.05], [0.95, 0.95], [0.05, 0.95]], closed: true }] },
  { id: "hexagon", name: "Hexagon", category: "Geometric", w: 24, h: 24,
    prims: [{ t: "poly", pts: [[0.5, 0.03], [0.95, 0.27], [0.95, 0.73], [0.5, 0.97], [0.05, 0.73], [0.05, 0.27]], closed: true }] },
  { id: "diamond", name: "Diamond", category: "Geometric", w: 24, h: 24,
    prims: [{ t: "poly", pts: [[0.5, 0.05], [0.95, 0.5], [0.5, 0.95], [0.05, 0.5]], closed: true }] },

  // ---- Structural ---------------------------------------------------------
  { id: "post", name: "Post", category: "Structural", w: 5.5, h: 5.5, label: "POST",
    prims: [{ t: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8, fill: true },
            { t: "line", x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 },
            { t: "line", x1: 0.9, y1: 0.1, x2: 0.1, y2: 0.9 }] },
  { id: "footing", name: "Footing", category: "Structural", w: 16, h: 16, label: "FTG",
    prims: [{ t: "rect", x: 0.05, y: 0.05, w: 0.9, h: 0.9 },
            { t: "circle", cx: 0.5, cy: 0.5, r: 0.28, fill: true }] },
  { id: "pier", name: "Pier / Column", category: "Structural", w: 8, h: 8,
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.45 },
            { t: "circle", cx: 0.5, cy: 0.5, r: 0.22, fill: true }] },
  { id: "beam", name: "Beam", category: "Structural", w: 96, h: 5.5, label: "BEAM",
    prims: [{ t: "rect", x: 0.01, y: 0.15, w: 0.98, h: 0.7 },
            { t: "line", x1: 0.01, y1: 0.5, x2: 0.99, y2: 0.5 }] },
  { id: "hanger", name: "Joist Hanger", category: "Structural", w: 4, h: 6,
    prims: [{ t: "poly", pts: [[0.2, 0], [0.8, 0], [0.8, 0.85], [0.5, 1], [0.2, 0.85]] },
            { t: "circle", cx: 0.35, cy: 0.3, r: 0.06, fill: true },
            { t: "circle", cx: 0.65, cy: 0.3, r: 0.06, fill: true }] },

  // ---- Architectural ------------------------------------------------------
  { id: "door", name: "Door (swing)", category: "Architectural", w: 32, h: 32,
    prims: [{ t: "line", x1: 0.05, y1: 0.95, x2: 0.05, y2: 0.05 },
            { t: "arc", cx: 0.05, cy: 0.95, r: 0.9, a0: -Math.PI / 2, a1: 0 },
            { t: "line", x1: 0.05, y1: 0.95, x2: 0.95, y2: 0.95 }] },
  { id: "window", name: "Window", category: "Architectural", w: 36, h: 6,
    prims: [{ t: "rect", x: 0.0, y: 0.2, w: 1.0, h: 0.6 },
            { t: "line", x1: 0.0, y1: 0.5, x2: 1.0, y2: 0.5 }] },
  { id: "stairs", name: "Stairs", category: "Architectural", w: 40, h: 60,
    prims: [{ t: "rect", x: 0.05, y: 0.02, w: 0.9, h: 0.96 },
            { t: "line", x1: 0.05, y1: 0.18, x2: 0.95, y2: 0.18 },
            { t: "line", x1: 0.05, y1: 0.34, x2: 0.95, y2: 0.34 },
            { t: "line", x1: 0.05, y1: 0.5, x2: 0.95, y2: 0.5 },
            { t: "line", x1: 0.05, y1: 0.66, x2: 0.95, y2: 0.66 },
            { t: "line", x1: 0.05, y1: 0.82, x2: 0.95, y2: 0.82 }] },
  { id: "railing", name: "Railing", category: "Architectural", w: 48, h: 4,
    prims: [{ t: "line", x1: 0, y1: 0.5, x2: 1, y2: 0.5 },
            { t: "circle", cx: 0.08, cy: 0.5, r: 0.14, fill: true },
            { t: "circle", cx: 0.34, cy: 0.5, r: 0.14, fill: true },
            { t: "circle", cx: 0.6, cy: 0.5, r: 0.14, fill: true },
            { t: "circle", cx: 0.9, cy: 0.5, r: 0.14, fill: true }] },

  // ---- Site & Landscape ---------------------------------------------------
  { id: "tree", name: "Tree", category: "Site & Landscape", w: 72, h: 72,
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.45 },
            { t: "circle", cx: 0.5, cy: 0.5, r: 0.08, fill: true },
            { t: "line", x1: 0.5, y1: 0.05, x2: 0.62, y2: 0.2 },
            { t: "line", x1: 0.95, y1: 0.5, x2: 0.8, y2: 0.62 },
            { t: "line", x1: 0.5, y1: 0.95, x2: 0.38, y2: 0.8 },
            { t: "line", x1: 0.05, y1: 0.5, x2: 0.2, y2: 0.38 }] },
  { id: "shrub", name: "Shrub", category: "Site & Landscape", w: 36, h: 36,
    prims: [{ t: "poly", pts: [[0.5, 0.05], [0.68, 0.2], [0.9, 0.28], [0.82, 0.5], [0.95, 0.72], [0.7, 0.78], [0.5, 0.95], [0.3, 0.78], [0.05, 0.72], [0.18, 0.5], [0.1, 0.28], [0.32, 0.2]], closed: true }] },
  { id: "bollard", name: "Bollard", category: "Site & Landscape", w: 8, h: 8,
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.4, fill: true }] },
  { id: "parking", name: "Parking Stall", category: "Site & Landscape", w: 108, h: 216,
    prims: [{ t: "line", x1: 0.05, y1: 0, x2: 0.05, y2: 1 },
            { t: "line", x1: 0.95, y1: 0, x2: 0.95, y2: 1 },
            { t: "line", x1: 0.05, y1: 1, x2: 0.95, y2: 1 }] },

  // ---- Furniture ----------------------------------------------------------
  { id: "chair", name: "Chair", category: "Furniture", w: 20, h: 20,
    prims: [{ t: "rect", x: 0.2, y: 0.25, w: 0.6, h: 0.6 },
            { t: "rect", x: 0.2, y: 0.08, w: 0.6, h: 0.17 }] },
  { id: "table", name: "Table", category: "Furniture", w: 48, h: 30,
    prims: [{ t: "rect", x: 0.03, y: 0.05, w: 0.94, h: 0.9 }] },
  { id: "rtable", name: "Round Table", category: "Furniture", w: 42, h: 42,
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.46 }] },
  { id: "sofa", name: "Sofa", category: "Furniture", w: 78, h: 36,
    prims: [{ t: "rect", x: 0.02, y: 0.1, w: 0.96, h: 0.85 },
            { t: "rect", x: 0.08, y: 0.28, w: 0.84, h: 0.6 },
            { t: "line", x1: 0.5, y1: 0.28, x2: 0.5, y2: 0.88 }] },

  // ---- Annotation ---------------------------------------------------------
  { id: "north", name: "North Arrow", category: "Annotation", w: 24, h: 30,
    prims: [{ t: "poly", pts: [[0.5, 0.02], [0.72, 0.78], [0.5, 0.6], [0.28, 0.78]], closed: true, fill: true },
            { t: "line", x1: 0.5, y1: 0.6, x2: 0.5, y2: 0.98 }] },
  { id: "arrow", name: "Arrow", category: "Annotation", w: 36, h: 12,
    prims: [{ t: "line", x1: 0.02, y1: 0.5, x2: 0.9, y2: 0.5 },
            { t: "line", x1: 0.9, y1: 0.5, x2: 0.7, y2: 0.28 },
            { t: "line", x1: 0.9, y1: 0.5, x2: 0.7, y2: 0.72 }] },
  { id: "target", name: "Reference Mark", category: "Annotation", w: 16, h: 16,
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.4 },
            { t: "line", x1: 0.5, y1: 0.0, x2: 0.5, y2: 1.0 },
            { t: "line", x1: 0.0, y1: 0.5, x2: 1.0, y2: 0.5 }] },

  // ---- Lumber (actual dimensions in inches; stretch to the length you need) --
  { id: "2x4", name: "2×4", category: "Lumber", w: 3.5, h: 1.5, label: "2×4",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...grain("h")] },
  { id: "2x6", name: "2×6", category: "Lumber", w: 5.5, h: 1.5, label: "2×6",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...grain("h")] },
  { id: "2x8", name: "2×8", category: "Lumber", w: 7.25, h: 1.5, label: "2×8",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...grain("h")] },
  { id: "2x10", name: "2×10", category: "Lumber", w: 9.25, h: 1.5, label: "2×10",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...grain("h")] },
  { id: "2x12", name: "2×12", category: "Lumber", w: 11.25, h: 1.5, label: "2×12",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...grain("h")] },
  { id: "4x4", name: "4×4 Post", category: "Lumber", w: 3.5, h: 3.5, label: "4×4",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0, x2: 1, y2: 1 }, { t: "line", x1: 1, y1: 0, x2: 0, y2: 1 }] },
  { id: "6x6", name: "6×6 Post", category: "Lumber", w: 5.5, h: 5.5, label: "6×6",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0, x2: 1, y2: 1 }, { t: "line", x1: 1, y1: 0, x2: 0, y2: 1 }] },
  { id: "1x6", name: "1×6 Board", category: "Lumber", w: 5.5, h: 0.75, label: "1×6",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...grain("h")] },
  { id: "deckpt", name: "5/4×6 Deck (PT)", category: "Lumber", w: 5.5, h: 1, label: "5/4 PT", color: "#3f7d20",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...grain("h")] },
  { id: "4x4pt", name: "4×4 Post (PT)", category: "Lumber", w: 3.5, h: 3.5, label: "4×4 PT", color: "#3f7d20",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0, x2: 1, y2: 1 }, { t: "line", x1: 1, y1: 0, x2: 0, y2: 1 }] },
  { id: "6x6pt", name: "6×6 Post (PT)", category: "Lumber", w: 5.5, h: 5.5, label: "6×6 PT", color: "#3f7d20",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0, x2: 1, y2: 1 }, { t: "line", x1: 1, y1: 0, x2: 0, y2: 1 }] },
  { id: "plywood", name: "Plywood 4×8", category: "Lumber", w: 48, h: 96, label: "Plywood 4×8",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0, x2: 1, y2: 0.06 }] },
  { id: "osb", name: "OSB 4×8", category: "Lumber", w: 48, h: 96, label: "OSB 4×8",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0.5, x2: 1, y2: 0.55 }, { t: "line", x1: 0, y1: 0.25, x2: 1, y2: 0.2 }] },

  // ---- Masonry & concrete ----------------------------------------------------
  { id: "cmu16", name: "CMU 8×16", category: "Masonry & Concrete", w: 15.625, h: 7.625, label: "CMU",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 },
            { t: "rect", x: 0.08, y: 0.18, w: 0.38, h: 0.64 },
            { t: "rect", x: 0.54, y: 0.18, w: 0.38, h: 0.64 }] },
  { id: "cmu8", name: "CMU Half 8×8", category: "Masonry & Concrete", w: 7.625, h: 7.625, label: "CMU½",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "rect", x: 0.18, y: 0.18, w: 0.64, h: 0.64 }] },
  { id: "brick", name: "Brick", category: "Masonry & Concrete", w: 7.625, h: 3.625, label: "Brick", color: "#9a3412",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }] },
  { id: "concpad", name: "Concrete Pad 24″", category: "Masonry & Concrete", w: 24, h: 24, label: "Conc. pad", color: "#6b7280",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0, x2: 1, y2: 1 }, { t: "line", x1: 1, y1: 0, x2: 0, y2: 1 }] },
  { id: "pier12", name: "Pier 12″", category: "Masonry & Concrete", w: 12, h: 12, label: "Pier 12″", color: "#6b7280",
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.48 }, { t: "circle", cx: 0.5, cy: 0.5, r: 0.12, fill: true }] },

  // ---- Fencing ---------------------------------------------------------------
  { id: "chainlink", name: "Chain-link (8′)", category: "Fencing", w: 96, h: 48, label: "Chain-link", color: "#64748b",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 },
            { t: "line", x1: 0, y1: 0.5, x2: 0.25, y2: 0 }, { t: "line", x1: 0.25, y1: 1, x2: 0.75, y2: 0 },
            { t: "line", x1: 0.75, y1: 1, x2: 1, y2: 0.5 },
            { t: "line", x1: 0, y1: 0.5, x2: 0.25, y2: 1 }, { t: "line", x1: 0.25, y1: 0, x2: 0.75, y2: 1 },
            { t: "line", x1: 0.75, y1: 0, x2: 1, y2: 0.5 }] },
  { id: "dogear", name: "Dog-ear Picket", category: "Fencing", w: 5.5, h: 72, label: "Dog-ear", color: "#3f7d20",
    prims: [{ t: "poly", closed: true, pts: [[0.12, 1], [0.12, 0.12], [0.3, 0.02], [0.7, 0.02], [0.88, 0.12], [0.88, 1]] }] },
  { id: "dogearpanel", name: "Dog-ear Panel (8′)", category: "Fencing", w: 96, h: 72, label: "Dog-ear panel", color: "#3f7d20",
    prims: [{ t: "line", x1: 0, y1: 0.25, x2: 1, y2: 0.25 }, { t: "line", x1: 0, y1: 0.8, x2: 1, y2: 0.8 },
            { t: "line", x1: 0.1, y1: 0.05, x2: 0.1, y2: 1 }, { t: "line", x1: 0.3, y1: 0.05, x2: 0.3, y2: 1 },
            { t: "line", x1: 0.5, y1: 0.05, x2: 0.5, y2: 1 }, { t: "line", x1: 0.7, y1: 0.05, x2: 0.7, y2: 1 },
            { t: "line", x1: 0.9, y1: 0.05, x2: 0.9, y2: 1 }] },
  { id: "privacy", name: "Privacy Panel (8′)", category: "Fencing", w: 96, h: 72, label: "Privacy panel", color: "#3f7d20",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 },
            { t: "line", x1: 0.2, y1: 0, x2: 0.2, y2: 1 }, { t: "line", x1: 0.4, y1: 0, x2: 0.4, y2: 1 },
            { t: "line", x1: 0.6, y1: 0, x2: 0.6, y2: 1 }, { t: "line", x1: 0.8, y1: 0, x2: 0.8, y2: 1 }] },
  { id: "gate", name: "Gate", category: "Fencing", w: 48, h: 72, label: "Gate",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 1, x2: 1, y2: 0 }] },
];

export function symbolById(id) {
  return SYMBOLS.find((s) => s.id === id);
}

export function symbolsByCategory() {
  const map = new Map(CATEGORIES.map((c) => [c, []]));
  for (const s of SYMBOLS) {
    if (!map.has(s.category)) map.set(s.category, []);
    map.get(s.category).push(s);
  }
  return map;
}

// Draw a symbol definition into a screen-space box {x,y,w,h}.
export function drawSymbolDef(ctx, def, box, stroke, fillColor) {
  const X = (nx) => box.x + nx * box.w;
  const Y = (ny) => box.y + ny * box.h;
  const S = Math.min(box.w, box.h);
  for (const p of def.prims) {
    ctx.beginPath();
    if (p.t === "rect") {
      ctx.rect(X(p.x), Y(p.y), p.w * box.w, p.h * box.h);
    } else if (p.t === "circle") {
      ctx.ellipse(X(p.cx), Y(p.cy), p.r * box.w, p.r * box.h, 0, 0, Math.PI * 2);
    } else if (p.t === "ellipse") {
      ctx.ellipse(X(p.cx), Y(p.cy), p.rx * box.w, p.ry * box.h, 0, 0, Math.PI * 2);
    } else if (p.t === "line") {
      ctx.moveTo(X(p.x1), Y(p.y1));
      ctx.lineTo(X(p.x2), Y(p.y2));
    } else if (p.t === "poly") {
      p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      if (p.closed) ctx.closePath();
    } else if (p.t === "arc") {
      ctx.arc(X(p.cx), Y(p.cy), p.r * S, p.a0, p.a1);
    }
    if (p.fill) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
