// app/keyboard.js — global keyboard handling: tool shortcuts, edit shortcuts,
// and the type-a-dimension capture while drawing.
import { parseLengthInput, unitLabel } from "../geometry.js";
import { translateShapes } from "../transforms.js";

export function installKeyboard(app) {
  const map = {
    v: "select", l: "line", w: "wall", r: "rect", c: "circle",
    p: "polygon", d: "dimension", t: "text", a: "arc", m: "measure",
  };

  window.addEventListener("keydown", (ev) => {
    if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") return;

    // Type-a-dimension while drawing: capture digits/feet-inches into a
    // floating box; Enter fixes the current segment to that exact length.
    const dt = app.tool;
    const canDim = app.activeToolName !== "select" && dt &&
      typeof dt.commitTypedLength === "function" && dt.pts && dt.pts.length && dt.cursor;
    if (canDim || app.dimBuffer != null) {
      if (/^[0-9.'"]$/.test(ev.key)) {
        ev.preventDefault(); app.dimBuffer = (app.dimBuffer || "") + ev.key; showDimInput(app); return;
      }
      if (ev.key === "Backspace" && app.dimBuffer != null) {
        ev.preventDefault();
        app.dimBuffer = app.dimBuffer.slice(0, -1);
        if (!app.dimBuffer) { app.dimBuffer = null; hideDimInput(); } else showDimInput(app);
        return;
      }
      if (ev.key === "Enter" && app.dimBuffer) {
        ev.preventDefault();
        const inches = parseLengthInput(app.dimBuffer);
        app.dimBuffer = null; hideDimInput();
        if (isFinite(inches) && dt.commitTypedLength) { app.doc.snapshot(); dt.commitTypedLength(inches); app._save(); }
        return;
      }
      if (ev.key === "Escape" && app.dimBuffer != null) { ev.preventDefault(); app.dimBuffer = null; hideDimInput(); return; }
    }

    if (ev.code === "Space") { app.spaceDown = true; app.canvas.style.cursor = "grab"; return; }
    if (ev.key === "Tab") { ev.preventDefault(); app._togglePanel(); return; }
    const meta = ev.ctrlKey || ev.metaKey;
    if (meta && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      if (ev.shiftKey) app.doc.redo(); else app.doc.undo();
      app.refreshPanel(); app._save(); return;
    }
    if (meta && ev.key.toLowerCase() === "s") { ev.preventDefault(); if (app.cloudOn) app._cloudSave(); else app._saveFile(); return; }
    if (meta && ev.key.toLowerCase() === "a") {
      ev.preventDefault();
      app.doc.shapes.forEach((s) => app.doc.selection.add(s.id));
      app.refreshPanel(); return;
    }
    if (meta && ev.key.toLowerCase() === "g") { ev.preventDefault(); if (ev.shiftKey) app._ungroup(); else app._group(); return; }
    if (meta && ev.key.toLowerCase() === "d") { ev.preventDefault(); app._duplicate(); return; }
    if (meta && ev.key.toLowerCase() === "c") { ev.preventDefault(); app._copy(); return; }
    if (meta && ev.key.toLowerCase() === "v") { ev.preventDefault(); app._paste(); return; }
    if (!meta && (ev.key === "[" || ev.key === "]")) {
      if (app.doc.selection.size) { ev.preventDefault(); app._rotate(ev.key === "[" ? -90 : 90); }
      return;
    }
    if (ev.key.startsWith("Arrow") && app.doc.selection.size) {
      ev.preventDefault();
      const step = ev.shiftKey ? app.snap.gridStep * 12 : app.snap.gridStep || 1;
      const dx = ev.key === "ArrowRight" ? step : ev.key === "ArrowLeft" ? -step : 0;
      const dy = ev.key === "ArrowDown" ? step : ev.key === "ArrowUp" ? -step : 0;
      if (app._editableIds().length) app.commit(() => translateShapes(app.doc, app._editableIds(), dx, dy));
      return;
    }
    if (ev.key === "Escape") { app.tool.cancel && app.tool.cancel(); return; }
    if (ev.key === "Enter") { app.tool.onEnter && app.tool.onEnter(); app._save(); return; }
    if (ev.key === "Delete" || ev.key === "Backspace") {
      const ids = app._editableIds();
      if (ids.length) {
        ev.preventDefault();
        app.commit(() => app.doc.remove(ids));
        app.refreshPanel();
      }
      return;
    }
    const t = map[ev.key.toLowerCase()];
    if (t) app.setTool(t);
  });

  window.addEventListener("keyup", (ev) => {
    if (ev.code === "Space") { app.spaceDown = false; app.panning = false; app.canvas.style.cursor = ""; }
  });
}

// ---- floating "type a length" box -----------------------------------------
export function showDimInput(app) {
  let el = document.getElementById("dim-input");
  if (!el) { el = document.createElement("div"); el.id = "dim-input"; el.className = "dim-input"; document.body.appendChild(el); }
  el.textContent = `⟺ ${app.dimBuffer} ${unitLabel()}`;
  el.style.display = "block";
  positionDimInput(app);
}
export function positionDimInput(app) {
  const el = document.getElementById("dim-input");
  if (!el || app.dimBuffer == null) return;
  const r = app.canvas.getBoundingClientRect();
  el.style.left = `${r.left + app.mouseScreen.x + 18}px`;
  el.style.top = `${r.top + app.mouseScreen.y - 12}px`;
}
export function hideDimInput() {
  const el = document.getElementById("dim-input");
  if (el) el.style.display = "none";
}
