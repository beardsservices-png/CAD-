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
  "Sheet Goods",
  "Masonry & Concrete",
  "Roofing",
  "Siding",
  "Decking & Stairs",
  "Fencing",
  "Hardware",
  "Electrical",
  "HVAC",
  "Plumbing",
  "Structural",
  "Architectural",
  "Site & Landscape",
  "Furniture",
  "Annotation",
];

// Evenly spaced parallel lines (for siding, decking, grilles, etc.).
function stripes(dir, count, x0 = 0, x1 = 1, y0 = 0, y1 = 1) {
  const p = [];
  for (let i = 1; i < count; i++) {
    const t = i / count;
    if (dir === "h") p.push({ t: "line", x1: x0, y1: y0 + (y1 - y0) * t, x2: x1, y2: y0 + (y1 - y0) * t });
    else p.push({ t: "line", x1: x0 + (x1 - x0) * t, y1: y0, x2: x0 + (x1 - x0) * t, y2: y1 });
  }
  return p;
}

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

  // ---- Sheet goods -----------------------------------------------------------
  { id: "ply34", name: "Plywood 3/4″ 4×8", category: "Sheet Goods", w: 48, h: 96, label: '3/4" Ply',
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0, x2: 1, y2: 0.05 }] },
  { id: "drywall48", name: "Drywall 4×8", category: "Sheet Goods", w: 48, h: 96, label: "Drywall", color: "#94a3b8",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }] },
  { id: "drywall412", name: "Drywall 4×12", category: "Sheet Goods", w: 48, h: 144, label: "Drywall 4×12", color: "#94a3b8",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }] },
  { id: "mdf", name: "MDF 4×8", category: "Sheet Goods", w: 48, h: 96, label: "MDF", color: "#a16207",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }] },
  { id: "cementboard", name: "Cement Board 3×5", category: "Sheet Goods", w: 36, h: 60, label: "Cement bd", color: "#6b7280",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("h", 5)] },
  { id: "rigidfoam", name: "Rigid Foam 4×8", category: "Sheet Goods", w: 48, h: 96, label: "Foam", color: "#db2777",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 1, x2: 1, y2: 0 }, { t: "line", x1: 0, y1: 0.5, x2: 0.5, y2: 0 }] },

  // ---- Roofing ---------------------------------------------------------------
  { id: "shingle", name: "Shingle Course", category: "Roofing", w: 36, h: 12, label: "Shingles", color: "#334155",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("v", 6, 0, 1, 0.4, 1) , { t: "line", x1: 0, y1: 0.4, x2: 1, y2: 0.4 }] },
  { id: "metalroof", name: "Metal Roof Panel", category: "Roofing", w: 36, h: 120, label: "Metal panel", color: "#64748b",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("v", 5)] },
  { id: "ridgecap", name: "Ridge Cap", category: "Roofing", w: 12, h: 36, label: "Ridge",
    prims: [{ t: "poly", pts: [[0, 0.5], [0.5, 0.1], [1, 0.5]] }, { t: "line", x1: 0.5, y1: 0.1, x2: 0.5, y2: 1 }] },
  { id: "roofvent", name: "Roof Vent", category: "Roofing", w: 12, h: 12, label: "Vent",
    prims: [{ t: "rect", x: 0.05, y: 0.05, w: 0.9, h: 0.9 }, { t: "circle", cx: 0.5, cy: 0.5, r: 0.3 }] },
  { id: "skylight", name: "Skylight", category: "Roofing", w: 24, h: 48, label: "Skylight", color: "#0ea5e9",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0, x2: 1, y2: 1 }, { t: "line", x1: 1, y1: 0, x2: 0, y2: 1 }] },
  { id: "chimney", name: "Chimney", category: "Roofing", w: 16, h: 16, label: "Chimney", color: "#9a3412",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "rect", x: 0.25, y: 0.25, w: 0.5, h: 0.5 }] },

  // ---- Siding ----------------------------------------------------------------
  { id: "lapsiding", name: "Lap Siding", category: "Siding", w: 96, h: 24, label: "Lap siding",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("h", 6)] },
  { id: "vinylsiding", name: "Vinyl Siding", category: "Siding", w: 96, h: 24, label: "Vinyl siding", color: "#e2e8f0",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("h", 4)] },
  { id: "boardbatten", name: "Board & Batten", category: "Siding", w: 96, h: 48, label: "Board & batten",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("v", 8)] },
  { id: "brickveneer", name: "Brick Veneer", category: "Siding", w: 48, h: 24, label: "Brick", color: "#9a3412",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("h", 3),
            { t: "line", x1: 0.5, y1: 0, x2: 0.5, y2: 0.333 }, { t: "line", x1: 0.25, y1: 0.333, x2: 0.25, y2: 0.666 }, { t: "line", x1: 0.75, y1: 0.333, x2: 0.75, y2: 0.666 }] },
  { id: "stucco", name: "Stucco Panel", category: "Siding", w: 48, h: 48, label: "Stucco", color: "#d6d3d1",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 },
            { t: "circle", cx: 0.3, cy: 0.3, r: 0.03, fill: true }, { t: "circle", cx: 0.7, cy: 0.4, r: 0.03, fill: true },
            { t: "circle", cx: 0.5, cy: 0.7, r: 0.03, fill: true }, { t: "circle", cx: 0.2, cy: 0.7, r: 0.03, fill: true }] },

  // ---- Decking & Stairs ------------------------------------------------------
  { id: "deckrun", name: "Deck Board Run", category: "Decking & Stairs", w: 96, h: 48, label: "Decking", color: "#a16207",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("h", 9)] },
  { id: "joistlayout", name: "Joist Layout 16″", category: "Decking & Stairs", w: 96, h: 96, label: "Joists 16″",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("v", 6)] },
  { id: "stairstringer", name: "Stair Stringer", category: "Decking & Stairs", w: 40, h: 48, label: "Stringer",
    prims: [{ t: "poly", pts: [[0, 1], [0, 0.75], [0.25, 0.75], [0.25, 0.5], [0.5, 0.5], [0.5, 0.25], [0.75, 0.25], [0.75, 0], [1, 0], [1, 1]], closed: true }] },
  { id: "stairsection", name: "Stairs (section)", category: "Decking & Stairs", w: 48, h: 60, label: "Stairs",
    prims: [{ t: "rect", x: 0.05, y: 0.02, w: 0.9, h: 0.96 }, ...stripes("h", 7, 0.05, 0.95)] },
  { id: "baluster", name: "Baluster", category: "Decking & Stairs", w: 2, h: 36, label: "Baluster",
    prims: [{ t: "rect", x: 0.2, y: 0, w: 0.6, h: 1 }] },

  // ---- Hardware --------------------------------------------------------------
  { id: "anglebracket", name: "Angle Bracket", category: "Hardware", w: 3, h: 3, label: "L-bracket", color: "#475569",
    prims: [{ t: "poly", pts: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.35], [0.35, 0.35], [0.35, 0.9], [0.1, 0.9]], closed: true },
            { t: "circle", cx: 0.22, cy: 0.6, r: 0.05, fill: true }, { t: "circle", cx: 0.6, cy: 0.22, r: 0.05, fill: true }] },
  { id: "postbase", name: "Post Base", category: "Hardware", w: 6, h: 6, label: "Post base", color: "#475569",
    prims: [{ t: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, { t: "rect", x: 0.4, y: 0.02, w: 0.2, h: 0.4 }, { t: "circle", cx: 0.5, cy: 0.6, r: 0.06, fill: true }] },
  { id: "hurricanetie", name: "Hurricane Tie", category: "Hardware", w: 3, h: 5, label: "H-tie", color: "#475569",
    prims: [{ t: "poly", pts: [[0.3, 0], [0.7, 0], [0.7, 0.6], [0.9, 0.6], [0.9, 1], [0.5, 1], [0.5, 0.6], [0.3, 0.6]], closed: true }] },
  { id: "lagbolt", name: "Lag Bolt", category: "Hardware", w: 1, h: 6, label: "Lag bolt", color: "#334155",
    prims: [{ t: "rect", x: 0.2, y: 0, w: 0.6, h: 0.18 }, { t: "line", x1: 0.5, y1: 0.18, x2: 0.5, y2: 1 }, ...stripes("h", 8, 0.35, 0.65, 0.2, 1)] },
  { id: "carriagebolt", name: "Carriage Bolt", category: "Hardware", w: 1, h: 6, label: "Carriage", color: "#334155",
    prims: [{ t: "circle", cx: 0.5, cy: 0.14, r: 0.14 }, { t: "line", x1: 0.5, y1: 0.28, x2: 0.5, y2: 1 }] },
  { id: "deckscrew", name: "Deck Screw", category: "Hardware", w: 0.5, h: 3, label: "Screw", color: "#334155",
    prims: [{ t: "poly", pts: [[0.2, 0], [0.8, 0], [0.5, 0.15]], closed: true }, { t: "line", x1: 0.5, y1: 0.15, x2: 0.5, y2: 1 }, ...stripes("h", 6, 0.3, 0.7, 0.15, 1)] },
  { id: "nailplate", name: "Nail Plate", category: "Hardware", w: 5, h: 3, label: "Nail plate", color: "#64748b",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("v", 6), ...stripes("h", 4)] },

  // ---- Electrical ------------------------------------------------------------
  { id: "outlet", name: "Duplex Outlet", category: "Electrical", w: 4, h: 4, label: "Outlet",
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.45 }, { t: "line", x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.9 }, { t: "line", x1: 0.35, y1: 0.35, x2: 0.35, y2: 0.65 }, { t: "line", x1: 0.65, y1: 0.35, x2: 0.65, y2: 0.65 }] },
  { id: "switch", name: "Switch", category: "Electrical", w: 4, h: 4, label: "Switch",
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.45 }, { t: "line", x1: 0.35, y1: 0.7, x2: 0.65, y2: 0.3 }] },
  { id: "ceilinglight", name: "Ceiling Light", category: "Electrical", w: 12, h: 12, label: "Light",
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.45 }, { t: "line", x1: 0.15, y1: 0.15, x2: 0.85, y2: 0.85 }, { t: "line", x1: 0.85, y1: 0.15, x2: 0.15, y2: 0.85 }] },
  { id: "recessed", name: "Recessed Light", category: "Electrical", w: 6, h: 6, label: "Can light",
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.45 }, { t: "circle", cx: 0.5, cy: 0.5, r: 0.2 }] },
  { id: "epanel", name: "Electrical Panel", category: "Electrical", w: 14, h: 20, label: "Panel", color: "#475569",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "rect", x: 0.15, y: 0.1, w: 0.7, h: 0.8 }, ...stripes("h", 6, 0.15, 0.85, 0.1, 0.9)] },
  { id: "jbox", name: "Junction Box", category: "Electrical", w: 4, h: 4, label: "J-box",
    prims: [{ t: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, { t: "line", x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 }] },

  // ---- HVAC ------------------------------------------------------------------
  { id: "supplyreg", name: "Supply Register", category: "HVAC", w: 12, h: 6, label: "Supply",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("v", 6)] },
  { id: "returngrille", name: "Return Grille", category: "HVAC", w: 20, h: 20, label: "Return",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, ...stripes("h", 6)] },
  { id: "ductround", name: "Round Duct", category: "HVAC", w: 8, h: 8, label: "Duct",
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.45 }, { t: "circle", cx: 0.5, cy: 0.5, r: 0.35 }] },
  { id: "ductrect", name: "Rect Duct", category: "HVAC", w: 20, h: 8, label: "Duct",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0, x2: 0.1, y2: 0.2 }] },
  { id: "minisplit", name: "Mini-Split Head", category: "HVAC", w: 32, h: 8, label: "Mini-split", color: "#e2e8f0",
    prims: [{ t: "rect", x: 0, y: 0.1, w: 1, h: 0.8 }, { t: "line", x1: 0.05, y1: 0.7, x2: 0.95, y2: 0.7 }] },
  { id: "furnace", name: "Furnace / AHU", category: "HVAC", w: 24, h: 30, label: "Furnace", color: "#475569",
    prims: [{ t: "rect", x: 0, y: 0, w: 1, h: 1 }, { t: "line", x1: 0, y1: 0.3, x2: 1, y2: 0.3 }, { t: "circle", cx: 0.5, cy: 0.65, r: 0.2 }] },

  // ---- Plumbing --------------------------------------------------------------
  { id: "pipe", name: "Pipe", category: "Plumbing", w: 4, h: 48, label: "Pipe", color: "#0891b2",
    prims: [{ t: "line", x1: 0.3, y1: 0, x2: 0.3, y2: 1 }, { t: "line", x1: 0.7, y1: 0, x2: 0.7, y2: 1 }] },
  { id: "elbow", name: "Pipe Elbow", category: "Plumbing", w: 8, h: 8, label: "Elbow", color: "#0891b2",
    prims: [{ t: "line", x1: 0.3, y1: 0, x2: 0.3, y2: 0.7 }, { t: "line", x1: 0.3, y1: 0.7, x2: 1, y2: 0.7 }, { t: "line", x1: 0.7, y1: 0, x2: 0.7, y2: 0.3 }, { t: "line", x1: 0.7, y1: 0.3, x2: 1, y2: 0.3 }] },
  { id: "tee", name: "Pipe Tee", category: "Plumbing", w: 12, h: 8, label: "Tee", color: "#0891b2",
    prims: [{ t: "line", x1: 0, y1: 0.3, x2: 1, y2: 0.3 }, { t: "line", x1: 0, y1: 0.7, x2: 1, y2: 0.7 }, { t: "line", x1: 0.4, y1: 0.7, x2: 0.4, y2: 1 }, { t: "line", x1: 0.6, y1: 0.7, x2: 0.6, y2: 1 }] },
  { id: "valve", name: "Valve", category: "Plumbing", w: 8, h: 6, label: "Valve", color: "#0891b2",
    prims: [{ t: "poly", pts: [[0.05, 0.2], [0.5, 0.5], [0.05, 0.8]], closed: true }, { t: "poly", pts: [[0.95, 0.2], [0.5, 0.5], [0.95, 0.8]], closed: true }] },
  { id: "cleanout", name: "Cleanout", category: "Plumbing", w: 6, h: 6, label: "CO", color: "#0891b2",
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.45 }, { t: "line", x1: 0.3, y1: 0.3, x2: 0.7, y2: 0.7 }, { t: "line", x1: 0.7, y1: 0.3, x2: 0.3, y2: 0.7 }] },
  { id: "floordrain", name: "Floor Drain", category: "Plumbing", w: 6, h: 6, label: "Drain", color: "#0891b2",
    prims: [{ t: "rect", x: 0.05, y: 0.05, w: 0.9, h: 0.9 }, ...stripes("v", 4, 0.05, 0.95, 0.05, 0.95)] },
  { id: "hosebib", name: "Hose Bib", category: "Plumbing", w: 4, h: 4, label: "Hose bib", color: "#0891b2",
    prims: [{ t: "circle", cx: 0.5, cy: 0.5, r: 0.3 }, { t: "line", x1: 0.5, y1: 0.5, x2: 0.5, y2: 1 }, { t: "line", x1: 0.5, y1: 0.2, x2: 0.5, y2: 0 }] },
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
