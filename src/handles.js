// handles.js — screen-space transform handles for the current selection:
// 8 scale handles around the bounding box (drag an edge or corner to resize)
// plus a rotate handle just outside the top-right corner. Shared by the
// renderer (to draw them) and the select tool (to hit-test them) so the two
// can never disagree.
import { shapeBBox } from "./model.js";

export const HANDLE_HIT = 11;  // px — generous for touchpads
export const ROTATE_HIT = 13;
const ROTATE_OFFSET = 20;      // px diagonally outside the corner

// Shapes whose geometry *is* their bounding box get box scale handles;
// point-based shapes (lines, walls, polygons, arcs) keep vertex handles.
const BOX_TYPES = ["rect", "circle", "symbol", "text"];

export function selectionBounds(doc, ids) {
  let min = { x: Infinity, y: Infinity };
  let max = { x: -Infinity, y: -Infinity };
  for (const id of ids) {
    const s = doc.get(id);
    if (!s) continue;
    const b = shapeBBox(s);
    min.x = Math.min(min.x, b.min.x); min.y = Math.min(min.y, b.min.y);
    max.x = Math.max(max.x, b.max.x); max.y = Math.max(max.y, b.max.y);
  }
  return min.x === Infinity ? null : { min, max };
}

export function handleMode(doc, ids) {
  if (ids.length !== 1) return "bbox";
  const s = doc.get(ids[0]);
  if (!s) return "bbox";
  return BOX_TYPES.includes(s.type) ? "bbox" : "points";
}

// Returns { mode, box:{x0,y0,x1,y1}, scale:[{id,x,y}], rotate:{x,y} } in screen
// px, or null when there's nothing transformable selected.
export function screenHandles(doc, ids, vp) {
  const editable = ids.filter((id) => { const s = doc.get(id); return s && !s.locked; });
  if (!editable.length) return null;
  const b = selectionBounds(doc, editable);
  if (!b) return null;

  const p0 = vp.worldToScreen(b.min);
  const p1 = vp.worldToScreen(b.max);
  const x0 = Math.min(p0.x, p1.x), x1 = Math.max(p0.x, p1.x);
  const y0 = Math.min(p0.y, p1.y), y1 = Math.max(p0.y, p1.y);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;

  const mode = handleMode(doc, editable);
  const out = {
    mode,
    ids: editable,
    box: { x0, y0, x1, y1 },
    scale: [],
    rotate: { x: x1 + ROTATE_OFFSET, y: y0 - ROTATE_OFFSET },
  };
  if (mode === "bbox") {
    out.scale = [
      { id: "nw", x: x0, y: y0 }, { id: "n", x: mx, y: y0 }, { id: "ne", x: x1, y: y0 },
      { id: "w", x: x0, y: my }, { id: "e", x: x1, y: my },
      { id: "sw", x: x0, y: y1 }, { id: "s", x: mx, y: y1 }, { id: "se", x: x1, y: y1 },
    ];
  }
  return out;
}

// The fixed point a given handle scales away from (the opposite side/corner),
// in world coordinates.
export function scaleAnchor(bounds, handleId) {
  const { min, max } = bounds;
  const x = handleId.includes("w") ? max.x : handleId.includes("e") ? min.x : (min.x + max.x) / 2;
  const y = handleId.includes("n") ? max.y : handleId.includes("s") ? min.y : (min.y + max.y) / 2;
  return { x, y };
}

export function cursorForHandle(id) {
  if (id === "n" || id === "s") return "ns-resize";
  if (id === "e" || id === "w") return "ew-resize";
  if (id === "nw" || id === "se") return "nwse-resize";
  if (id === "ne" || id === "sw") return "nesw-resize";
  return "default";
}
