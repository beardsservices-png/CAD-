// materials.js — build a scale-accurate materials / cut list from the drawing,
// the digital version of tallying a graph-paper plan before the lumber run.
import { shapeMetrics, shapeBBox, shapeClosed, materialFor } from "./model.js";
import { symbolById } from "./symbols.js";
import { formatFeetInches, formatArea } from "./geometry.js";

// Materials sold as 4×8 sheets get a sheet-count estimate from total area.
const SHEET_MATERIALS = {
  ply: { name: "Plywood", w: 48, h: 96 },
  drywall: { name: "Drywall", w: 48, h: 96 },
};

// Returns rows of { qty, item, detail }, sorted by item name.
export function buildMaterialsList(doc) {
  const rows = [];
  const symGroups = new Map();   // symbol name+size -> qty
  const wallGroups = new Map();  // thickness -> { len, qty }
  const pieces = new Map();      // description -> qty
  const sheetAreas = new Map();  // sheet material id -> total sq in
  let looseLineLen = 0;

  for (const s of doc.shapes) {
    const layer = doc.layer(s.layer);
    if (!layer || !layer.visible) continue;
    if (s.type === "dimension" || s.type === "text") continue;
    const m = shapeMetrics(s);

    if (s.type === "symbol") {
      const def = symbolById(s.symbol);
      const b = shapeBBox(s);
      const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
      const key = `${def ? def.name : s.symbol}|${w.toFixed(1)}|${h.toFixed(1)}`;
      const g = symGroups.get(key) || { name: def ? def.name : s.symbol, w, h, qty: 0 };
      g.qty++;
      symGroups.set(key, g);
    } else if (s.type === "wall") {
      const t = s.thickness || 3.5;
      const g = wallGroups.get(t) || { len: 0, qty: 0 };
      g.len += m.length || 0;
      g.qty++;
      wallGroups.set(t, g);
    } else if (s.type === "line" || s.type === "arc") {
      const mat = materialFor(s);
      if (mat) {
        const desc = `${mat.name} — length ${formatFeetInches(m.length || 0)}`;
        pieces.set(desc, (pieces.get(desc) || 0) + 1);
      } else {
        looseLineLen += m.length || 0;
      }
    } else if (shapeClosed(s)) {
      const mat = materialFor(s);
      const b = shapeBBox(s);
      const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
      const desc = s.type === "circle"
        ? `${mat ? mat.name : "Cut piece"} — ⌀ ${formatFeetInches(w)}`
        : `${mat ? mat.name : "Cut piece"} — ${formatFeetInches(w)} × ${formatFeetInches(h)}`;
      pieces.set(desc, (pieces.get(desc) || 0) + 1);
      if (mat && SHEET_MATERIALS[mat.id]) {
        sheetAreas.set(mat.id, (sheetAreas.get(mat.id) || 0) + (m.area || w * h));
      }
    }
  }

  for (const g of symGroups.values()) {
    rows.push({ qty: g.qty, item: g.name, detail: `${formatFeetInches(g.w)} × ${formatFeetInches(g.h)}` });
  }
  for (const [t, g] of wallGroups) {
    rows.push({ qty: g.qty, item: `Wall run (${formatFeetInches(t)} thick)`, detail: `total ${formatFeetInches(g.len)}` });
  }
  for (const [desc, qty] of pieces) {
    const i = desc.indexOf(" — ");
    rows.push({ qty, item: i > 0 ? desc.slice(0, i) : desc, detail: i > 0 ? desc.slice(i + 3) : "" });
  }
  for (const [matId, area] of sheetAreas) {
    const sm = SHEET_MATERIALS[matId];
    const sheets = Math.ceil(area / (sm.w * sm.h));
    rows.push({ qty: sheets, item: `${sm.name} 4×8 sheets (est.)`, detail: `covers ${formatArea(area)} — add your waste factor` });
  }
  if (looseLineLen > 0) {
    rows.push({ qty: 1, item: "Unassigned lines", detail: `total ${formatFeetInches(looseLineLen)}` });
  }

  rows.sort((a, b) => a.item.localeCompare(b.item));
  return rows;
}

// Suggested connection hardware, inferred from what's in the drawing:
// posts want bases, post+beam wants caps, beams carrying joists want
// hurricane ties, decking wants screws. Estimates only — check local code.
export function buildHardwareSuggestions(doc) {
  const out = [];
  let posts = 0, footings = 0, beamLen = 0, deckArea = 0, joistLayouts = 0;

  const isPost = (id) => /^(post|4x4|6x6|4x4pt|6x6pt|pier)$/.test(id);
  const isFooting = (id) => /^(footing|concpad|pier12)$/.test(id);

  for (const s of doc.shapes) {
    const layer = doc.layer(s.layer);
    if (!layer || !layer.visible) continue;
    if (s.type === "symbol") {
      if (isPost(s.symbol)) posts++;
      else if (isFooting(s.symbol)) footings++;
      else if (s.symbol === "beam") {
        const b = shapeBBox(s);
        beamLen += Math.max(b.max.x - b.min.x, b.max.y - b.min.y);
      } else if (s.symbol === "joistlayout") joistLayouts++;
      else if (s.symbol === "deckrun") {
        const b = shapeBBox(s);
        deckArea += (b.max.x - b.min.x) * (b.max.y - b.min.y);
      }
    } else if (s.type === "wall") {
      // thick structural runs (5.5"+ walls on any layer, or anything on a
      // "structure" layer) read as beams
      if ((s.thickness || 3.5) >= 4.5 || layer.id === "structure") {
        beamLen += shapeMetrics(s).length || 0;
      }
    }
  }

  if (posts > 0) {
    out.push({ qty: posts, item: "Post base + anchor", detail: "one per post — ties post to footing/slab" });
  }
  if (posts > 0 && beamLen > 0) {
    out.push({ qty: posts, item: "Post cap / beam connector", detail: "post-to-beam connection at each post top" });
  }
  if (beamLen > 0 && (joistLayouts > 0 || deckArea > 0)) {
    const seats = Math.max(2, Math.ceil(beamLen / 16));
    out.push({ qty: seats, item: "Hurricane tie / joist clip", detail: "est. one per 16″ o.c. seat along beams — verify with joist count" });
  }
  if (footings > 0) {
    out.push({ qty: footings, item: "J-bolt or wedge anchor", detail: "one per footing/pad" });
  }
  if (deckArea > 0) {
    const sqft = deckArea / 144;
    out.push({ qty: Math.ceil(sqft * 3.5), item: "Deck screws (2½″)", detail: `~350 per 100 sq ft over ${Math.round(sqft)} sq ft` });
  }
  return out;
}

// Plain-text version for copy/paste (shopping list style).
export function materialsText(doc, rows, hardware = []) {
  const lines = [`Materials — ${doc.name || "Untitled"}`, ""];
  for (const r of rows) {
    lines.push(`${String(r.qty).padStart(3)} × ${r.item}${r.detail ? `  (${r.detail})` : ""}`);
  }
  if (hardware.length) {
    lines.push("", "Suggested hardware (verify with local code):");
    for (const r of hardware) {
      lines.push(`${String(r.qty).padStart(3)} × ${r.item}${r.detail ? `  (${r.detail})` : ""}`);
    }
  }
  return lines.join("\n");
}
