// snap.js — resolves the cursor world-position to a snapped point, and
// reports what kind of snap happened (for drawing snap indicators).
import { v, dist, snapToStep, pointToSegment } from "./geometry.js";
import { shapePoints } from "./model.js";

// settings: { grid:bool, gridStep:inches, endpoint:bool, tolPx:number }
export function resolveSnap(worldPt, doc, viewport, settings, exclude = new Set()) {
  const tolWorld = settings.tolPx / viewport.scale;
  let best = null;
  let bestDist = Infinity;
  let type = null;

  if (settings.endpoint) {
    // Snap to vertices of existing shapes first (strongest snap).
    for (const s of doc.shapes) {
      if (exclude.has(s.id)) continue;
      if (!doc.layer(s.layer).visible) continue;
      for (const pt of shapePoints(s)) {
        const d = dist(worldPt, pt);
        if (d < bestDist && d <= tolWorld) {
          bestDist = d;
          best = { ...pt };
          type = "endpoint";
        }
      }
    }
    // Then to midpoints of segments.
    if (!best) {
      for (const s of doc.shapes) {
        if (exclude.has(s.id)) continue;
        if (!doc.layer(s.layer).visible) continue;
        const pts = shapePoints(s);
        for (let i = 0; i < pts.length - 1; i++) {
          const mid = v(
            (pts[i].x + pts[i + 1].x) / 2,
            (pts[i].y + pts[i + 1].y) / 2
          );
          const d = dist(worldPt, mid);
          if (d < bestDist && d <= tolWorld) {
            bestDist = d;
            best = mid;
            type = "midpoint";
          }
        }
      }
    }
  }

  if (best) return { point: best, type };

  // Fall back to grid snap.
  if (settings.grid) {
    return {
      point: v(
        snapToStep(worldPt.x, settings.gridStep),
        snapToStep(worldPt.y, settings.gridStep)
      ),
      type: "grid",
    };
  }

  return { point: { ...worldPt }, type: null };
}
