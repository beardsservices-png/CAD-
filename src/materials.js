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
// `onlyStep` (a number) narrows the list to a single build step.
export function buildMaterialsList(doc, onlyStep = null) {
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
    if (s.existing) continue; // reference geometry isn't bought or built
    if (onlyStep != null && (s.step || 0) !== onlyStep) continue;
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
      if (mat || s.label) {
        const desc = `${s.label || mat.name} — length ${formatFeetInches(m.length || 0)}`;
        pieces.set(desc, (pieces.get(desc) || 0) + 1);
      } else {
        looseLineLen += m.length || 0;
      }
    } else if (shapeClosed(s)) {
      const mat = materialFor(s);
      const b = shapeBBox(s);
      const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
      // A shape can carry its own `label` ("2×6 double joist") so the list
      // reads like a real takeoff instead of "Wood × 9".
      const name = s.label || (mat ? mat.name : "Cut piece");
      const desc = s.type === "circle"
        ? `${name} — ⌀ ${formatFeetInches(w)}`
        : `${name} — ${formatFeetInches(w)} × ${formatFeetInches(h)}`;
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
  let posts = 0, footings = 0, beamLen = 0, deckArea = 0, joistLayouts = 0, joists = 0;

  const isPost = (id) => /^(post|4x4|6x6|4x4pt|6x6pt|4x4elev|6x6elev|pier)$/.test(id);
  const isFooting = (id) => /^(footing|concpad|pier12)$/.test(id);

  for (const s of doc.shapes) {
    const layer = doc.layer(s.layer);
    if (!layer || !layer.visible) continue;
    if (s.existing) continue; // don't spec hardware for existing structure
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
    } else if (s.label && (s.type === "rect" || s.type === "polygon")) {
      // Members you drew and named yourself ("2×6 double joist", "beam",
      // "4×4 post") count the same as library symbols.
      const lab = s.label.toLowerCase();
      const b = shapeBBox(s);
      const long = Math.max(b.max.x - b.min.x, b.max.y - b.min.y);
      if (/\bpost\b|\bcolumn\b/.test(lab)) posts++;
      else if (/\bbeam\b|\bheader\b|\bledger\b/.test(lab)) beamLen += long;
      else if (/\bjoist\b|\brafter\b/.test(lab)) joists++;
      else if (/\bfooting\b|\bpier\b|\bpad\b/.test(lab)) footings++;
      else if (/\bdeck(ing)?\b/.test(lab)) deckArea += (b.max.x - b.min.x) * (b.max.y - b.min.y);
    }
  }

  if (posts > 0) {
    out.push({ qty: posts, item: "Post base + anchor", detail: "one per post — ties post to footing/slab" });
  }
  if (posts > 0 && beamLen > 0) {
    out.push({ qty: posts, item: "Post cap / beam connector", detail: "post-to-beam connection at each post top" });
  }
  if (beamLen > 0 && joists > 0) {
    // We know the actual joist count, so tie count is exact rather than a guess.
    out.push({ qty: joists, item: "Hurricane tie / joist clip", detail: `one per joist-to-beam seat (${joists} joists)` });
  } else if (beamLen > 0 && (joistLayouts > 0 || deckArea > 0)) {
    const seats = Math.max(2, Math.ceil(beamLen / 16));
    out.push({ qty: seats, item: "Hurricane tie / joist clip", detail: "est. one per 16″ o.c. seat along beams — verify with joist count" });
  }
  if (joists > 0) {
    out.push({ qty: joists, item: "Joist hanger (house side)", detail: "one per joist if hanging off a ledger rather than bearing on it" });
  }
  if (footings > 0) {
    out.push({ qty: footings, item: "J-bolt or wedge anchor", detail: "one per footing/pad" });
  }
  if (deckArea > 0) {
    const sqft = deckArea / 144;
    out.push({ qty: Math.ceil(sqft * 3.5), item: "Deck screws (2½″)", detail: `~350 per 100 sq ft over ${Math.round(sqft)} sq ft` });
  }
  out.push(...metalRoofTrim(doc));
  return out;
}

// When the drawing contains metal roof panels, spec the trim, flashing,
// closures and fasteners that finish the roof. Lengths come from the panel
// field's extents; trim is ordered in 10 ft stock lengths.
function metalRoofTrim(doc) {
  const out = [];
  let min = { x: Infinity, y: Infinity }, max = { x: -Infinity, y: -Infinity };
  let found = false;
  let gutterLen = 0, downspouts = 0;

  for (const s of doc.shapes) {
    const layer = doc.layer(s.layer);
    if (!layer || !layer.visible || s.existing) continue;
    const lab = (s.label || "").toLowerCase();
    const isPanel = s.symbol === "metalroof" ||
      (/panel/.test(lab) && /metal|roof/.test(lab)) ||
      (s.material === "metal" && /roof/.test(lab));
    if (isPanel) {
      const b = shapeBBox(s);
      min.x = Math.min(min.x, b.min.x); min.y = Math.min(min.y, b.min.y);
      max.x = Math.max(max.x, b.max.x); max.y = Math.max(max.y, b.max.y);
      found = true;
    }
    if (/gutter/.test(lab) && !/guard/.test(lab)) {
      const b = shapeBBox(s);
      gutterLen += Math.max(b.max.x - b.min.x, b.max.y - b.min.y);
    }
    if (/downspout/.test(lab)) downspouts++;
  }
  if (!found) return out;

  const eave = max.x - min.x;   // along the eave
  const slope = max.y - min.y;  // up the slope (already slope length if drawn so)
  const sqft = (eave * slope) / 144;
  const ft = (inches) => inches / 12;
  const sticks = (inches) => Math.max(1, Math.ceil(ft(inches) / 10)); // 10 ft stock
  const lf = (inches) => `${ft(inches).toFixed(1)} lf`;

  out.push({ qty: sticks(eave), item: "Eave trim / drip edge (10 ft)", detail: `${lf(eave)} along the eave` });
  out.push({ qty: sticks(eave), item: "Fascia metal (10 ft)", detail: `${lf(eave)} over the wood fascia` });
  out.push({ qty: sticks(slope * 2), item: "Rake / gable trim (10 ft)", detail: `2 rakes × ${ft(slope).toFixed(1)} ft` });
  out.push({ qty: sticks(eave), item: "Headwall / apron flashing (10 ft)", detail: `${lf(eave)} where the roof meets the house` });
  out.push({ qty: 2, item: "Kickout flashing", detail: "one at each end where the roof edge meets the wall" });
  out.push({ qty: sticks(eave), item: "Outside closure strip", detail: `${lf(eave)} at the eave — fills under the ribs` });
  out.push({ qty: sticks(eave), item: "Inside closure strip", detail: `${lf(eave)} at the headwall — fills over the flats` });
  out.push({ qty: Math.ceil(ft(eave * 2 + slope * 2) / 45), item: "Butyl sealant tape (45 ft roll)", detail: "closures, laps and flashing seams" });
  out.push({ qty: Math.ceil((sqft / 100) * 80), item: "Panel screws w/ washer", detail: `~80 per square over ${Math.round(sqft)} sq ft` });
  out.push({ qty: Math.ceil(ft(slope) * 2 * (eave / 36)), item: "Stitch screws (side laps)", detail: "~2 per ft of panel side lap" });
  out.push({ qty: 1, item: "Touch-up paint / sealant", detail: "cut edges and fastener touch-ups" });

  if (gutterLen > 0) {
    out.push({ qty: sticks(gutterLen), item: "Gutter guard (10 ft)", detail: `${lf(gutterLen)} over the gutter` });
    out.push({ qty: Math.max(2, Math.ceil(ft(gutterLen) / 2.5)), item: "Gutter hanger / bracket", detail: "one every ~30 in" });
    out.push({ qty: 1, item: "Gutter end cap pair", detail: "left + right" });
  }
  if (downspouts > 0) {
    out.push({ qty: downspouts * 3, item: "Downspout elbow", detail: "2 at the gutter, 1 at grade per downspout" });
    out.push({ qty: downspouts * 2, item: "Downspout strap", detail: "secures the downspout to the wall" });
    out.push({ qty: downspouts, item: "Downspout outlet / drop", detail: "gutter-to-downspout connection" });
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
