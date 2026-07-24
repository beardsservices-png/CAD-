// geometry.js — vector math, unit formatting, and snapping helpers.
// World coordinates are measured in INCHES. Screen coordinates are in pixels.

export const v = (x = 0, y = 0) => ({ x, y });
export const add = (a, b) => v(a.x + b.x, a.y + b.y);
export const sub = (a, b) => v(a.x - b.x, a.y - b.y);
export const scale = (a, s) => v(a.x * s, a.y * s);
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dot = (a, b) => a.x * b.x + a.y * b.y;

// Angle of vector in radians, and normalized degrees 0..360.
export const angle = (a) => Math.atan2(a.y, a.x);
export function angleDeg(a) {
  let d = (angle(a) * 180) / Math.PI;
  if (d < 0) d += 360;
  return d;
}

// Distance from point p to segment ab, plus the closest point on the segment.
export function pointToSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  if (l2 === 0) return { dist: dist(p, a), point: { ...a }, t: 0 };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2;
  t = Math.max(0, Math.min(1, t));
  const point = v(a.x + t * abx, a.y + t * aby);
  return { dist: dist(p, point), point, t };
}

// Axis-aligned bounding box helpers.
export function bboxOfPoints(pts) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    min: v(Math.min(...xs), Math.min(...ys)),
    max: v(Math.max(...xs), Math.max(...ys)),
  };
}

export function pointInBox(p, box, pad = 0) {
  return (
    p.x >= box.min.x - pad &&
    p.x <= box.max.x + pad &&
    p.y >= box.min.y - pad &&
    p.y <= box.max.y + pad
  );
}

// Snap a world value to the nearest multiple of `step` (inches).
export function snapToStep(value, step) {
  if (!step) return value;
  return Math.round(value / step) * step;
}

// Constrain vector `d` to the nearest multiple of `angStepDeg` degrees,
// preserving length. Used for ortho / angle-lock while drawing.
export function constrainAngle(d, angStepDeg) {
  const l = len(d);
  if (l === 0) return d;
  const a = angle(d);
  const step = (angStepDeg * Math.PI) / 180;
  const snapped = Math.round(a / step) * step;
  return v(Math.cos(snapped) * l, Math.sin(snapped) * l);
}

// ---- Unit formatting -------------------------------------------------------

// Reduce a fraction n/d to lowest terms.
function reduce(n, d) {
  const g = (a, b) => (b ? g(b, a % b) : a);
  const k = g(n, d) || 1;
  return [n / k, d / k];
}

// ---- Units -----------------------------------------------------------------
// World units are always inches internally; the display unit is switchable.
const MM_PER_IN = 25.4;
let _unit = "imperial"; // "imperial" | "metric"
export function setUnitMode(m) { _unit = m === "metric" ? "metric" : "imperial"; }
export function getUnitMode() { return _unit; }
export function unitLabel() { return _unit === "metric" ? "mm" : "in"; }
export function displayStep() { return _unit === "metric" ? 1 : 0.125; }
// Convert an internal inch value to the current display unit and back.
export function toDisplay(inches) { return _unit === "metric" ? inches * MM_PER_IN : inches; }
export function fromDisplay(val) { return _unit === "metric" ? val / MM_PER_IN : val; }
// Round to display precision (1 mm, or 1/8").
export function roundDisplay(inches) {
  return _unit === "metric" ? Math.round(inches * MM_PER_IN) / MM_PER_IN : Math.round(inches * 8) / 8;
}

// Format a metric length from inches, choosing mm / cm / m sensibly.
function formatMetric(inches) {
  const mm = inches * MM_PER_IN;
  const a = Math.abs(mm);
  if (a >= 1000) return `${(mm / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} m`;
  if (a >= 10) return `${(mm / 10).toLocaleString(undefined, { maximumFractionDigits: 1 })} cm`;
  return `${Math.round(mm)} mm`;
}

// Format inches as feet + inches with a fractional inch to `denom` (e.g. 16),
// or in metric when the display unit is metric. e.g. 30.5 -> `2' 6 1/2"`.
export function formatFeetInches(inches, denom = 16) {
  if (_unit === "metric") return formatMetric(inches);
  const neg = inches < 0;
  let total = Math.abs(inches);
  const feet = Math.floor(total / 12);
  let rem = total - feet * 12;

  const whole = Math.floor(rem);
  let frac = Math.round((rem - whole) * denom);
  let wholeAdj = whole;
  let feetAdj = feet;
  if (frac === denom) {
    frac = 0;
    wholeAdj += 1;
  }
  if (wholeAdj === 12) {
    wholeAdj = 0;
    feetAdj += 1;
  }

  let inchStr = `${wholeAdj}`;
  if (frac > 0) {
    const [n, d] = reduce(frac, denom);
    inchStr = wholeAdj > 0 ? `${wholeAdj} ${n}/${d}` : `${n}/${d}`;
  }

  const parts = [];
  if (feetAdj > 0) parts.push(`${feetAdj}'`);
  // Always show inches unless it's an exact foot count with zero inches.
  if (!(feetAdj > 0 && wholeAdj === 0 && frac === 0)) parts.push(`${inchStr}"`);
  if (parts.length === 0) parts.push(`0"`);
  return (neg ? "-" : "") + parts.join(" ");
}

// Format an area given in square inches, as square feet or square metres.
export function formatArea(sqInches) {
  if (_unit === "metric") {
    const sqm = (sqInches * MM_PER_IN * MM_PER_IN) / 1e6;
    return `${sqm.toLocaleString(undefined, { maximumFractionDigits: 2 })} m²`;
  }
  const sqft = sqInches / 144;
  return `${sqft.toLocaleString(undefined, { maximumFractionDigits: 1 })} sq ft`;
}

// Polygon area (shoelace) in square world-units, for a list of points.
export function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

// Perimeter length of an open polyline or closed polygon.
export function pathLength(pts, closed = false) {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += dist(pts[i], pts[i + 1]);
  if (closed && pts.length > 2) total += dist(pts[pts.length - 1], pts[0]);
  return total;
}

// ---- Arcs ------------------------------------------------------------------
// A 3-point arc is defined by start (a), a point it passes through (b), and
// end (c). Compute the circle through the three points, plus the swept angles.
// Returns null when the points are (nearly) collinear — caller draws a line.
export function arcThrough(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  const center = v(ux, uy);
  const r = dist(center, a);
  const a0 = Math.atan2(a.y - uy, a.x - ux);
  const a1 = Math.atan2(b.y - uy, b.x - ux);
  const a2e = Math.atan2(c.y - uy, c.x - ux);
  // Determine sweep direction so the arc passes through b.
  const ccw = arcContains(a0, a2e, a1, false);
  return { center, r, a0, a1: a2e, ccw };
}

// Is angle `t` on the arc from `a0` to `a1` going CCW (or CW if ccw=false)?
function arcContains(a0, a1, t, ccw) {
  const norm = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const sweep = ccw ? norm(a1 - a0) : norm(a0 - a1);
  const rel = ccw ? norm(t - a0) : norm(a0 - t);
  return rel <= sweep;
}

// Sample points along a 3-point arc (fallback: the straight chord).
export function arcPoints(a, b, c, n = 24) {
  const arc = arcThrough(a, b, c);
  if (!arc) return [a, c];
  const norm = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let sweep = arc.ccw ? norm(arc.a1 - arc.a0) : -norm(arc.a0 - arc.a1);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const ang = arc.a0 + (sweep * i) / n;
    out.push(v(arc.center.x + Math.cos(ang) * arc.r, arc.center.y + Math.sin(ang) * arc.r));
  }
  return out;
}

// Length of a 3-point arc.
export function arcLength(a, b, c) {
  const arc = arcThrough(a, b, c);
  if (!arc) return dist(a, c);
  const norm = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const sweep = arc.ccw ? norm(arc.a1 - arc.a0) : norm(arc.a0 - arc.a1);
  return arc.r * sweep;
}
