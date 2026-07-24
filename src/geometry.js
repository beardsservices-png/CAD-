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

// Format inches as feet + inches with a fractional inch to `denom` (e.g. 16).
// e.g. 30.5 -> `2' 6 1/2"`
export function formatFeetInches(inches, denom = 16) {
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

// Format an area given in square inches as square feet.
export function formatArea(sqInches) {
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
