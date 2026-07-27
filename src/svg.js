// svg.js — export the drawing as a scalable vector graphic.
// World units (inches) map directly to SVG user units; world Y is down, which
// matches SVG, so no coordinate flip is needed.
import { shapePoints, shapeClosed, shapeBBox, shapeMetrics } from "./model.js";
import { arcThrough, formatFeetInches, roundedRectPoints } from "./geometry.js";
import { symbolById } from "./symbols.js";

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const n = (x) => (Math.round(x * 1000) / 1000);

export function toSVG(doc) {
  const shapes = doc.shapes.filter((s) => doc.layer(s.layer).visible);
  if (!shapes.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>`;

  // overall bounds
  let min = { x: Infinity, y: Infinity }, max = { x: -Infinity, y: -Infinity };
  for (const s of shapes) {
    const b = shapeBBox(s);
    min.x = Math.min(min.x, b.min.x); min.y = Math.min(min.y, b.min.y);
    max.x = Math.max(max.x, b.max.x); max.y = Math.max(max.y, b.max.y);
  }
  const span = Math.max(max.x - min.x, max.y - min.y) || 100;
  const pad = span * 0.05;
  const vb = { x: min.x - pad, y: min.y - pad, w: max.x - min.x + pad * 2, h: max.y - min.y + pad * 2 };
  const baseW = Math.max(span * 0.0015, 0.2); // stroke unit scaled to drawing size

  const body = shapes.map((s) => shapeSVG(s, doc, baseW)).join("\n");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(vb.x)} ${n(vb.y)} ${n(vb.w)} ${n(vb.h)}" ` +
    `width="${Math.round(vb.w)}" height="${Math.round(vb.h)}">\n` +
    `<rect x="${n(vb.x)}" y="${n(vb.y)}" width="${n(vb.w)}" height="${n(vb.h)}" fill="#ffffff"/>\n` +
    body +
    `\n</svg>\n`
  );
}

function shapeSVG(s, doc, baseW) {
  const color = s.existing ? "#94a3b8" : (s.color || doc.layer(s.layer).color);
  const w = baseW * (s.weight || 1);
  const dash = s.existing ? ` stroke-dasharray="${n(w * 3.5)} ${n(w * 2.5)}"` :
    s.dash === "dashed" ? ` stroke-dasharray="${n(w * 4)} ${n(w * 3)}"` :
    s.dash === "dotted" ? ` stroke-dasharray="${n(w)} ${n(w * 3)}"` : "";
  const stroke = `stroke="${color}" stroke-width="${n(w)}" fill="none" stroke-linejoin="round" stroke-linecap="round"${dash}`;

  if (s.type === "line") {
    return `<polyline points="${ptsStr(s.pts)}" ${stroke}/>`;
  }
  if (s.type === "wall") {
    return `<polyline points="${ptsStr(s.pts)}" stroke="${color}" stroke-width="${n(s.thickness || 3.5)}" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  if (s.type === "rect" && s.radius > 0) {
    const b = shapeBBox(s);
    const r = Math.min(s.radius, (b.max.x - b.min.x) / 2, (b.max.y - b.min.y) / 2);
    return `<rect x="${n(b.min.x)}" y="${n(b.min.y)}" width="${n(b.max.x - b.min.x)}" height="${n(b.max.y - b.min.y)}" rx="${n(r)}" ry="${n(r)}" stroke="${color}" stroke-width="${n(w)}" ${fillFor(s, color)}${dash}/>`;
  }
  if (s.type === "rect" || s.type === "polygon") {
    const pts = shapePoints(s);
    const fill = fillFor(s, color);
    const tag = shapeClosed(s) ? "polygon" : "polyline";
    return `<${tag} points="${ptsStr(pts)}" stroke="${color}" stroke-width="${n(w)}" ${fill}${dash} stroke-linejoin="round"/>`;
  }
  if (s.type === "circle") {
    const b = shapeBBox(s);
    const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
    const rx = (b.max.x - b.min.x) / 2, ry = (b.max.y - b.min.y) / 2;
    return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" stroke="${color}" stroke-width="${n(w)}" ${fillFor(s, color)}${dash}/>`;
  }
  if (s.type === "arc" && s.pts.length === 3) {
    const arc = arcThrough(s.pts[0], s.pts[1], s.pts[2]);
    if (!arc) return `<polyline points="${ptsStr([s.pts[0], s.pts[2]])}" ${stroke}/>`;
    const norm = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const sweepAng = arc.ccw ? norm(arc.a1 - arc.a0) : norm(arc.a0 - arc.a1);
    const large = sweepAng > Math.PI ? 1 : 0;
    const sweepFlag = arc.ccw ? 1 : 0;
    const a = s.pts[0], c = s.pts[2];
    return `<path d="M ${n(a.x)} ${n(a.y)} A ${n(arc.r)} ${n(arc.r)} 0 ${large} ${sweepFlag} ${n(c.x)} ${n(c.y)}" ${stroke}/>`;
  }
  if (s.type === "dimension") {
    const [a, b] = s.pts;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m = shapeMetrics(s);
    const fs = baseW * 8;
    return (
      `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" ${stroke}/>` +
      `<text x="${n(mid.x)}" y="${n(mid.y - fs * 0.4)}" font-size="${n(fs)}" fill="${color}" text-anchor="middle" font-family="sans-serif">${esc(formatFeetInches(m.length || 0))}</text>`
    );
  }
  if (s.type === "text") {
    const p = s.pts[0];
    const fs = (s.size || 12);
    return `<text x="${n(p.x)}" y="${n(p.y)}" font-size="${n(fs)}" fill="${color}" font-family="sans-serif">${esc(s.text || "")}</text>`;
  }
  if (s.type === "symbol") {
    return symbolSVG(s, color, w);
  }
  return "";
}

function fillFor(s, color) {
  if (s.fill === false) return `fill="none"`;
  if (s.fill === "solid") return `fill="${color}" fill-opacity="0.35"`;
  return `fill="${color}" fill-opacity="0.08"`;
}

function ptsStr(pts) {
  return pts.map((p) => `${n(p.x)},${n(p.y)}`).join(" ");
}

// Convert a library symbol's normalized primitives to absolute SVG.
function symbolSVG(s, color, w) {
  const def = symbolById(s.symbol);
  const b = shapeBBox(s);
  const bw = b.max.x - b.min.x, bh = b.max.y - b.min.y;
  if (!def) return `<rect x="${n(b.min.x)}" y="${n(b.min.y)}" width="${n(bw)}" height="${n(bh)}" stroke="${color}" stroke-width="${n(w)}" fill="none"/>`;
  const X = (nx) => b.min.x + nx * bw;
  const Y = (ny) => b.min.y + ny * bh;
  const rot = s.rot ? ` transform="rotate(${n((s.rot * 180) / Math.PI)} ${n((b.min.x + b.max.x) / 2)} ${n((b.min.y + b.max.y) / 2)})"` : "";
  const st = `stroke="${color}" stroke-width="${n(w)}"`;
  const parts = def.prims.map((p) => {
    const fill = p.fill ? `fill="${color}" fill-opacity="0.14"` : `fill="none"`;
    if (p.t === "rect") return `<rect x="${n(X(p.x))}" y="${n(Y(p.y))}" width="${n(p.w * bw)}" height="${n(p.h * bh)}" ${st} ${fill}/>`;
    if (p.t === "circle") return `<ellipse cx="${n(X(p.cx))}" cy="${n(Y(p.cy))}" rx="${n(p.r * bw)}" ry="${n(p.r * bh)}" ${st} ${fill}/>`;
    if (p.t === "ellipse") return `<ellipse cx="${n(X(p.cx))}" cy="${n(Y(p.cy))}" rx="${n(p.rx * bw)}" ry="${n(p.ry * bh)}" ${st} ${fill}/>`;
    if (p.t === "line") return `<line x1="${n(X(p.x1))}" y1="${n(Y(p.y1))}" x2="${n(X(p.x2))}" y2="${n(Y(p.y2))}" ${st}/>`;
    if (p.t === "poly") {
      const pp = p.pts.map(([x, y]) => `${n(X(x))},${n(Y(y))}`).join(" ");
      return `<${p.closed ? "polygon" : "polyline"} points="${pp}" ${st} ${p.closed ? fill : 'fill="none"'}/>`;
    }
    if (p.t === "arc") {
      const cx = X(p.cx), cy = Y(p.cy), r = p.r * Math.min(bw, bh);
      const x0 = cx + Math.cos(p.a0) * r, y0 = cy + Math.sin(p.a0) * r;
      const x1 = cx + Math.cos(p.a1) * r, y1 = cy + Math.sin(p.a1) * r;
      const large = Math.abs(p.a1 - p.a0) > Math.PI ? 1 : 0;
      return `<path d="M ${n(x0)} ${n(y0)} A ${n(r)} ${n(r)} 0 ${large} 1 ${n(x1)} ${n(y1)}" ${st} fill="none"/>`;
    }
    return "";
  });
  return `<g${rot}>${parts.join("")}</g>`;
}
