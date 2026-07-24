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

  if (best) return { point: best, type, guides: [] };

  // Magnetic alignment: snap X and/or Y to line up with an existing vertex,
  // drawing a guide line to show the inferred alignment.
  if (settings.align) {
    let ax = null, ay = null;
    let dxBest = tolWorld, dyBest = tolWorld;
    for (const s of doc.shapes) {
      if (exclude.has(s.id)) continue;
      if (!doc.layer(s.layer).visible) continue;
      for (const pt of shapePoints(s)) {
        const dx = Math.abs(pt.x - worldPt.x);
        const dy = Math.abs(pt.y - worldPt.y);
        if (dx < dxBest) { dxBest = dx; ax = pt; }
        if (dy < dyBest) { dyBest = dy; ay = pt; }
      }
    }
    if (ax || ay) {
      const px = ax ? ax.x : (settings.grid ? snapToStep(worldPt.x, settings.gridStep) : worldPt.x);
      const py = ay ? ay.y : (settings.grid ? snapToStep(worldPt.y, settings.gridStep) : worldPt.y);
      const point = v(px, py);
      const guides = [];
      if (ax) guides.push({ from: { ...ax }, to: point, axis: "v" });
      if (ay) guides.push({ from: { ...ay }, to: point, axis: "h" });
      return { point, type: "align", guides };
    }
  }

  // Fall back to grid snap.
  if (settings.grid) {
    return {
      point: v(
        snapToStep(worldPt.x, settings.gridStep),
        snapToStep(worldPt.y, settings.gridStep)
      ),
      type: "grid",
      guides: [],
    };
  }

  return { point: { ...worldPt }, type: null, guides: [] };
}
