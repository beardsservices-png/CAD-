// render.js — draws the document (shapes, dimensions, selection) to the canvas.
import { v, sub, len, angle, formatFeetInches, formatArea } from "./geometry.js";
import { shapePoints, shapeClosed, shapeBBox, shapeMetrics } from "./model.js";
import { symbolById, drawSymbolDef } from "./symbols.js";

// Draw a text label with a rounded background pill, centered at screen point.
export function label(ctx, text, sx, sy, theme, opts = {}) {
  ctx.save();
  ctx.font = opts.font || "12px system-ui, sans-serif";
  const padX = 6;
  const padY = 3;
  const m = ctx.measureText(text);
  const w = m.width + padX * 2;
  const h = 18;
  const x = sx - w / 2;
  const y = sy - h / 2;
  ctx.fillStyle = opts.bg || theme.labelBg;
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();
  ctx.fillStyle = opts.color || theme.labelText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, sx, sy + 0.5);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function screenPath(ctx, vp, pts, closed) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const s = vp.worldToScreen(p);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  if (closed) ctx.closePath();
}

export function renderShapes(ctx, doc, vp, theme) {
  for (const shape of doc.shapes) {
    const layer = doc.layer(shape.layer);
    if (!layer.visible) continue;
    const color = shape.color || layer.color;
    const selected = doc.selection.has(shape.id);
    drawShape(ctx, shape, vp, theme, color, selected);
  }
  // Selection handles drawn on top.
  for (const shape of doc.shapes) {
    if (doc.selection.has(shape.id)) drawHandles(ctx, shape, vp, theme);
  }
}

function drawShape(ctx, shape, vp, theme, color, selected) {
  ctx.save();
  const stroke = selected ? theme.selection : color;

  if (shape.type === "wall") {
    // Walls render as a thick band at real thickness (default 3.5").
    const thick = (shape.thickness || 3.5) * vp.scale;
    ctx.lineWidth = Math.max(2, thick);
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    screenPath(ctx, vp, shape.pts, false);
    ctx.stroke();
    // center line
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    screenPath(ctx, vp, shape.pts, false);
    ctx.stroke();
    if (selected) outline(ctx, shape, vp, theme);
    drawSegmentLengths(ctx, shape, vp, theme);
  } else if (shape.type === "line") {
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = stroke;
    screenPath(ctx, vp, shape.pts, false);
    ctx.stroke();
    drawSegmentLengths(ctx, shape, vp, theme);
  } else if (shape.type === "rect" || shape.type === "polygon") {
    const pts = shapePoints(shape);
    const closed = shapeClosed(shape);
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = stroke;
    if (closed && shape.fill !== false) {
      ctx.fillStyle = hexA(color, 0.08);
      screenPath(ctx, vp, pts, true);
      ctx.fill();
    }
    screenPath(ctx, vp, pts, closed);
    ctx.stroke();
    if (closed) drawAreaLabel(ctx, shape, vp, theme);
    drawSegmentLengths(ctx, shape, vp, theme);
  } else if (shape.type === "circle") {
    const b = shapeBBox(shape);
    const p0 = vp.worldToScreen(b.min);
    const p1 = vp.worldToScreen(b.max);
    const cx = (p0.x + p1.x) / 2;
    const cy = (p0.y + p1.y) / 2;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.abs(p1.x - p0.x) / 2, Math.abs(p1.y - p0.y) / 2, 0, 0, Math.PI * 2);
    if (shape.fill !== false) {
      ctx.fillStyle = hexA(color, 0.08);
      ctx.fill();
    }
    ctx.stroke();
    drawAreaLabel(ctx, shape, vp, theme);
  } else if (shape.type === "text") {
    drawText(ctx, shape, vp, stroke);
  } else if (shape.type === "dimension") {
    drawDimension(ctx, shape, vp, theme, stroke);
  } else if (shape.type === "symbol") {
    drawSymbol(ctx, shape, vp, theme, stroke, selected);
  }

  ctx.restore();
}

function drawText(ctx, shape, vp, stroke) {
  const p = vp.worldToScreen(shape.pts[0]);
  const size = Math.max(9, (shape.size || 12) * vp.scale * 0.5);
  ctx.save();
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = stroke;
  const lines = (shape.text || "").split("\n");
  lines.forEach((ln, i) => ctx.fillText(ln, p.x, p.y + i * size * 1.25));
  ctx.restore();
}

function outline(ctx, shape, vp, theme) {
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = theme.selection;
  screenPath(ctx, vp, shape.pts, false);
  ctx.stroke();
  ctx.restore();
}

// Draw per-segment length labels at each segment midpoint.
function drawSegmentLengths(ctx, shape, vp, theme) {
  const pts = shapePoints(shape);
  const closed = shapeClosed(shape);
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const l = len(sub(b, a));
    if (l < 1) continue;
    const mid = vp.worldToScreen(v((a.x + b.x) / 2, (a.y + b.y) / 2));
    label(ctx, formatFeetInches(l), mid.x, mid.y, theme, {
      bg: theme.dimBg,
      color: theme.dimText,
      font: "11px system-ui, sans-serif",
    });
  }
}

function drawAreaLabel(ctx, shape, vp, theme) {
  const b = shapeBBox(shape);
  const c = vp.worldToScreen(v((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2));
  const m = shapeMetrics(shape);
  label(ctx, formatArea(m.area), c.x, c.y, theme, {
    bg: theme.areaBg,
    color: theme.areaText,
    font: "12px system-ui, sans-serif",
  });
}

function drawDimension(ctx, shape, vp, theme, stroke) {
  const [a, b] = shape.pts;
  const off = shape.offset || 0;
  // perpendicular offset direction
  const dir = sub(b, a);
  const l = len(dir) || 1;
  const nx = -dir.y / l;
  const ny = dir.x / l;
  const oa = v(a.x + nx * off, a.y + ny * off);
  const ob = v(b.x + nx * off, b.y + ny * off);
  const sa = vp.worldToScreen(oa);
  const sb = vp.worldToScreen(ob);
  const ea = vp.worldToScreen(a);
  const eb = vp.worldToScreen(b);

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  // extension lines
  ctx.beginPath();
  ctx.moveTo(ea.x, ea.y);
  ctx.lineTo(sa.x, sa.y);
  ctx.moveTo(eb.x, eb.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();
  // dimension line with arrows
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();
  arrow(ctx, sa, sb);
  arrow(ctx, sb, sa);
  const mid = v((sa.x + sb.x) / 2, (sa.y + sb.y) / 2);
  label(ctx, formatFeetInches(len(dir)), mid.x, mid.y, theme, {
    bg: theme.dimBg,
    color: theme.dimText,
  });
  ctx.restore();
}

function arrow(ctx, from, to) {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 8;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(
    from.x + Math.cos(a - 0.4) * size,
    from.y + Math.sin(a - 0.4) * size
  );
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(
    from.x + Math.cos(a + 0.4) * size,
    from.y + Math.sin(a + 0.4) * size
  );
  ctx.stroke();
}

function drawSymbol(ctx, shape, vp, theme, stroke, selected) {
  const b = shapeBBox(shape);
  const p0 = vp.worldToScreen(b.min);
  const p1 = vp.worldToScreen(b.max);
  const box = { x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y };
  const cx = p0.x + box.w / 2;
  const cyb = p0.y + box.h / 2;
  ctx.save();
  ctx.lineWidth = selected ? 2.5 : 1.75;
  ctx.lineJoin = "round";

  // Draw the (optionally rotated) symbol art in its own transform, so the
  // selection outline and caption below stay upright.
  ctx.save();
  if (shape.rot) {
    ctx.translate(cx, cyb);
    ctx.rotate(shape.rot);
    ctx.translate(-cx, -cyb);
  }
  const def = symbolById(shape.symbol);
  if (def) {
    drawSymbolDef(ctx, def, box, stroke, hexA(shape.color || theme.symbol, 0.14));
  } else {
    ctx.strokeStyle = stroke;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
  }
  ctx.restore();

  if (selected) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = theme.selection;
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    ctx.setLineDash([]);
  }

  const cap = shape.label || (def && def.label);
  if (cap && box.w > 26) {
    label(ctx, cap, cx, p1.y + 11, theme, {
      bg: theme.labelBg,
      color: theme.labelText,
      font: "10px system-ui, sans-serif",
    });
  }
  ctx.restore();
}

function drawHandles(ctx, shape, vp, theme) {
  const pts = shape.type === "symbol" ? [] : shapePoints(shape);
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = theme.selection;
  ctx.lineWidth = 1.5;
  for (const p of pts) {
    const s = vp.worldToScreen(p);
    ctx.beginPath();
    ctx.rect(s.x - 4, s.y - 4, 8, 8);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Convert a #rrggbb color plus alpha to an rgba() string.
export function hexA(hex, a) {
  if (!hex || hex[0] !== "#") return `rgba(100,116,139,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
