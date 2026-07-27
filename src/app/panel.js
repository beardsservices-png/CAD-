// app/panel.js — the right-hand side panel: properties/style/modify controls,
// layers, the shape library palette, takeoff totals, hints, and settings UI.
import {
  formatFeetInches, formatArea,
  getUnitMode, toDisplay, fromDisplay, unitLabel, displayStep,
} from "../geometry.js";
import {
  shapeMetrics, shapeClosed, shapeBBox, shapeHeight, shapeElevation, MATERIALS,
} from "../model.js";
import {
  setRectSize, setCircleDiameter, setSegmentLength, setPosition,
  alignSelection, distributeSelection, offsetShape, generateFraming,
} from "../transforms.js";
import { symbolsByCategory, SYMBOLS, drawSymbolDef } from "../symbols.js";

// Stroke color palette offered in the style controls.
const PALETTE = [
  "#1e3a8a", "#0ea5e9", "#0f766e", "#16a34a",
  "#c2410c", "#dc2626", "#6d28d9", "#334155", "#000000",
];

// Convert an internal inch value to a rounded number in the display unit.
function dispNum(inches) {
  const d = toDisplay(inches);
  return getUnitMode() === "metric" ? Math.round(d * 10) / 10 : Math.round(d * 8) / 8;
}

// ---- properties panel -------------------------------------------------------
export function refreshPanel(app) {
  const host = document.getElementById("props");
  const sel = [...app.doc.selection].map((id) => app.doc.get(id)).filter(Boolean);
  if (!sel.length) {
    host.innerHTML = `<p class="muted">Nothing selected.<br>Click a shape, or drag a box to select.</p>`;
    updateTakeoff(app);
    return;
  }
  let rows = "";
  const single = sel.length === 1 ? sel[0] : null;

  if (single) {
    const s = single;
    const m = shapeMetrics(s);
    const bb = shapeBBox(s);
    rows += `<div class="prop-row"><span>Type</span><b>${s.type}</b></div>`;
    if (m.length != null) rows += `<div class="prop-row"><span>Length</span><b>${formatFeetInches(m.length)}</b></div>`;
    if (m.perimeter != null) rows += `<div class="prop-row"><span>Perimeter</span><b>${formatFeetInches(m.perimeter)}</b></div>`;
    if (m.area != null) rows += `<div class="prop-row"><span>Area</span><b>${formatArea(m.area)}</b></div>`;
    rows += layerSelectHTML(app, sel);

    // Exact position + size — the core of designing a part precisely.
    const u = unitLabel();
    const st = displayStep();
    const dn = dispNum;
    rows += `<div class="prop-sep"></div>`;
    rows += `<label class="opt inline">X (${u})<input id="p-x" type="number" step="${st}" value="${dn(bb.min.x)}"></label>`;
    rows += `<label class="opt inline">Y (${u})<input id="p-y" type="number" step="${st}" value="${dn(bb.min.y)}"></label>`;
    if (s.type === "rect") {
      rows += `<label class="opt inline">Width (${u})<input id="p-w" type="number" min="0" step="${st}" value="${dn(bb.max.x - bb.min.x)}"></label>`;
      rows += `<label class="opt inline">Height (${u})<input id="p-h" type="number" min="0" step="${st}" value="${dn(bb.max.y - bb.min.y)}"></label>`;
      rows += `<label class="opt inline">Corner radius (${u})<input id="p-radius" type="number" min="0" step="${st}" value="${dn(s.radius || 0)}"></label>`;
    } else if (s.type === "circle") {
      rows += `<label class="opt inline">Diameter (${u})<input id="p-d" type="number" min="0" step="${st}" value="${dn(bb.max.x - bb.min.x)}"></label>`;
    } else if ((s.type === "line" || s.type === "wall") && s.pts.length === 2) {
      rows += `<label class="opt inline">Length (${u})<input id="p-len" type="number" min="0" step="${st}" value="${dn(m.length)}"></label>`;
    }

    if (["line", "rect", "circle", "polygon"].includes(s.type)) {
      rows += `<div class="prop-sep"></div>`;
      rows += `<label class="opt inline">Offset (${u})<input id="p-offset" type="number" step="${st}" value="${dn(6)}"></label>`;
      rows += `<div class="modify-grid"><button id="btn-offset">Offset copy</button></div>`;
    }

    // Fill a closed shape with evenly spaced members — joists, studs,
    // balusters, deck boards — counted in the materials list.
    if (shapeClosed(s)) {
      rows += `<div class="prop-sep"></div><div class="style-label">Framing layout</div>`;
      rows += `<label class="opt inline">Preset<select id="p-frame-preset">
        <option value="16,1.5">Joists / studs 16″ o.c.</option>
        <option value="24,1.5">Joists / studs 24″ o.c.</option>
        <option value="12,1.5">Joists 12″ o.c.</option>
        <option value="5.5,1.5">Balusters (4″ gap)</option>
        <option value="5.75,5.5">Deck boards (¼″ gap)</option>
      </select></label>`;
      rows += `<label class="opt inline">Direction<select id="p-frame-dir">
        <option value="v">↕ run vertical</option>
        <option value="h">↔ run horizontal</option>
      </select></label>`;
      rows += `<div class="modify-grid"><button id="btn-frame">Fill with members</button></div>`;
    }

    if (s.type !== "dimension" && s.type !== "text") {
      rows += `<div class="prop-sep"></div>`;
      rows += `<label class="opt inline">3D height (${u})<input id="p-height" type="number" min="0" step="${st}" value="${dn(shapeHeight(s))}"></label>`;
      rows += `<label class="opt inline">Base elev. (${u})<input id="p-elev" type="number" step="${st}" value="${dn(shapeElevation(s))}"></label>`;
    }
  } else {
    rows += `<div class="prop-row"><span>Selected</span><b>${sel.length} shapes</b></div>`;
    rows += layerSelectHTML(app, sel);
  }

  // Build step (1, 2, 3… — 0/blank means "always shown"). Works for any
  // selection; drives the step-playback control in the status bar.
  const commonStep = sel.every((x) => (x.step || 0) === (sel[0].step || 0)) ? (sel[0].step || 0) : "";
  rows += `<label class="opt inline">Build step<input id="p-step" type="number" min="0" step="1" value="${commonStep}" placeholder="—"></label>`;

  // Existing / reference geometry — context to draw against, never counted.
  const allRef = sel.every((x) => x.existing);
  rows += `<label class="opt" title="Draw it greyed out as context (an existing house wall, patio, property line). Still snaps, but is never counted in materials or takeoff.">` +
    `<input id="p-existing" type="checkbox" ${allRef ? "checked" : ""}> Existing (reference only)</label>`;

  const hasGroup = sel.some((s) => s.group);
  const anyLocked = sel.some((s) => s.locked);
  rows += styleHTML(sel);
  rows += modifyHTML(sel.length, hasGroup, anyLocked);
  host.innerHTML = rows;

  // ---- single-shape numeric binds ----
  if (single) {
    const s = single;
    // fn always receives inches (display units are converted here).
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onchange = () => { app.doc.snapshot(); fn(fromDisplay(parseFloat(el.value) || 0)); app._save(); refreshPanel(app); };
    };
    bind("p-x", (val) => setPosition(app.doc, s.id, val, shapeBBox(s).min.y));
    bind("p-y", (val) => setPosition(app.doc, s.id, shapeBBox(s).min.x, val));
    bind("p-w", (val) => setRectSize(s, Math.max(0.1, val), shapeBBox(s).max.y - shapeBBox(s).min.y));
    bind("p-h", (val) => setRectSize(s, shapeBBox(s).max.x - shapeBBox(s).min.x, Math.max(0.1, val)));
    bind("p-d", (val) => setCircleDiameter(s, Math.max(0.1, val)));
    bind("p-len", (val) => setSegmentLength(s, Math.max(0.1, val)));
    bind("p-radius", (val) => { s.radius = Math.max(0, val); });
    const hEl = document.getElementById("p-height");
    const eEl = document.getElementById("p-elev");
    if (hEl) hEl.onchange = () => { s.height = Math.max(0, fromDisplay(parseFloat(hEl.value) || 0)); app._save(); };
    if (eEl) eEl.onchange = () => { s.elevation = fromDisplay(parseFloat(eEl.value) || 0); app._save(); };
    const frameBtn = document.getElementById("btn-frame");
    if (frameBtn) frameBtn.onclick = () => {
      const [spacing, thickness] = document.getElementById("p-frame-preset").value.split(",").map(Number);
      const dir = document.getElementById("p-frame-dir").value;
      const members = generateFraming(s, { spacing, thickness, dir, layer: app.doc.activeLayer });
      if (!members.length) { app._toast("Nothing to fill"); return; }
      app.commit(() => {
        const ids = [];
        for (const m of members) { app.doc.add(m); ids.push(m.id); }
        app.doc.selection = new Set(ids);
      });
      app._toast(`Placed ${members.length} members`);
    };

    const offBtn = document.getElementById("btn-offset");
    if (offBtn) offBtn.onclick = () => {
      const d = fromDisplay(parseFloat(document.getElementById("p-offset").value) || 0);
      if (!d) return;
      const ns = offsetShape(s, d);
      if (!ns) { app._toast("Can't offset by that amount"); return; }
      app.commit(() => { app.doc.add(ns); app.doc.selection = new Set([ns.id]); });
    };
  }

  const stepEl = document.getElementById("p-step");
  if (stepEl) stepEl.onchange = () => app.commit(() => sel.forEach((x) => {
    const n = parseInt(stepEl.value, 10);
    if (!n || n <= 0) delete x.step; else x.step = n;
  }));

  // Marking something "existing" also locks it — it's context, not work — and
  // unmarking releases it again.
  const refEl = document.getElementById("p-existing");
  if (refEl) refEl.onchange = () => app.commit(() => sel.forEach((x) => {
    if (refEl.checked) { x.existing = true; x.locked = true; }
    else { delete x.existing; delete x.locked; }
  }));

  bindLayerSelect(app, sel);
  bindStyle(app, sel);
  bindModify(app);
  updateTakeoff(app);
}

function layerSelectHTML(app, sel) {
  const common = sel.every((s) => s.layer === sel[0].layer) ? sel[0].layer : "";
  const opts = app.doc.layers
    .map((l) => `<option value="${l.id}" ${l.id === common ? "selected" : ""}>${l.name}</option>`)
    .join("");
  return `<label class="opt inline">Layer<select id="p-layer">${common ? "" : `<option value="" selected>—</option>`}${opts}</select></label>`;
}
function bindLayerSelect(app, sel) {
  const el = document.getElementById("p-layer");
  if (el) el.onchange = () => { if (el.value) app.commit(() => sel.forEach((s) => (s.layer = el.value))); };
}

// Color / fill / weight / line-style controls (single or multi selection).
function styleHTML(sel) {
  const s0 = sel[0];
  const anyClosed = sel.some((s) => shapeClosed(s));
  let html = `<div class="prop-sep"></div><div class="style-label">Style</div>`;
  html += `<div class="swatches">`;
  html += `<button class="sw bylayer ${sel.every((s) => !s.color) ? "on" : ""}" data-color="" title="By layer">L</button>`;
  for (const c of PALETTE) {
    const on = sel.every((s) => s.color === c) ? "on" : "";
    html += `<button class="sw ${on}" data-color="${c}" style="background:${c}" title="${c}"></button>`;
  }
  html += `<input type="color" id="p-color" class="sw-custom" value="${s0.color || "#1e3a8a"}" title="Custom color">`;
  html += `</div>`;
  const wsel = (val) => (Number(s0.weight || 1) === val ? "selected" : "");
  html += `<label class="opt inline">Weight<select id="p-weight">
    <option value="0.5" ${wsel(0.5)}>Thin</option>
    <option value="1" ${wsel(1)}>Medium</option>
    <option value="2" ${wsel(2)}>Thick</option>
    <option value="3" ${wsel(3)}>Heavy</option></select></label>`;
  const dsel = (val) => ((s0.dash || "solid") === val ? "selected" : "");
  html += `<label class="opt inline">Line<select id="p-dash">
    <option value="solid" ${dsel("solid")}>Solid</option>
    <option value="dashed" ${dsel("dashed")}>Dashed</option>
    <option value="dotted" ${dsel("dotted")}>Dotted</option></select></label>`;
  if (anyClosed) {
    const cur = s0.fill === false ? "none" : s0.fill === "solid" ? "solid" : "light";
    const fsel = (val) => (cur === val ? "selected" : "");
    html += `<label class="opt inline">Fill<select id="p-fill">
      <option value="none" ${fsel("none")}>None</option>
      <option value="light" ${fsel("light")}>Light</option>
      <option value="solid" ${fsel("solid")}>Solid</option></select></label>`;
  }
  // 3D material (drives the textured render).
  const curMat = sel.every((s) => (s.material || "auto") === (s0.material || "auto")) ? (s0.material || "auto") : "auto";
  const matOpts = MATERIALS.map((m) => `<option value="${m.id}" ${m.id === curMat ? "selected" : ""}>${m.name}</option>`).join("");
  html += `<label class="opt inline">Material<select id="p-material">${matOpts}</select></label>`;
  return html;
}
function bindStyle(app, sel) {
  const host = document.getElementById("props");
  host.querySelectorAll(".sw[data-color]").forEach((b) => {
    b.onclick = () => app.commit(() => {
      const c = b.dataset.color;
      sel.forEach((s) => { if (c) s.color = c; else delete s.color; });
    });
  });
  const col = document.getElementById("p-color");
  if (col) col.onchange = () => app.commit(() => sel.forEach((s) => (s.color = col.value)));
  const wt = document.getElementById("p-weight");
  if (wt) wt.onchange = () => app.commit(() => sel.forEach((s) => (s.weight = parseFloat(wt.value))));
  const dash = document.getElementById("p-dash");
  if (dash) dash.onchange = () => app.commit(() => sel.forEach((s) => (s.dash = dash.value)));
  const fill = document.getElementById("p-fill");
  if (fill) fill.onchange = () => app.commit(() => sel.forEach((s) => {
    s.fill = fill.value === "none" ? false : fill.value === "solid" ? "solid" : true;
  }));
  const mat = document.getElementById("p-material");
  if (mat) mat.onchange = () => app.commit(() => sel.forEach((s) => {
    if (mat.value === "auto") delete s.material; else s.material = mat.value;
  }));
}

function modifyHTML(count, hasGroup, anyLocked) {
  let html =
    `<div class="prop-sep"></div>` +
    `<div class="modify-grid">` +
    `<button data-mod="dup">Duplicate</button>` +
    `<button data-mod="mirror-h">Mirror ↔</button>` +
    `<button data-mod="rot-ccw">Rotate ⟲</button>` +
    `<button data-mod="mirror-v">Mirror ↕</button>` +
    `<button data-mod="rot-cw">Rotate ⟳</button>` +
    `<button data-mod="del">Delete</button>` +
    `</div>` +
    `<label class="opt inline">Rotate by°<input id="p-rot" type="number" step="1" value="0"></label>`;
  html += `<div class="modify-grid">`;
  html += `<button data-mod="lock">${anyLocked ? "🔓 Unlock" : "🔒 Lock"}</button>`;
  if (count > 1) html += `<button data-mod="group">Group</button>`;
  if (hasGroup) html += `<button data-mod="ungroup">Ungroup</button>`;
  html += `</div>`;
  if (count > 1) {
    html += `<div class="prop-sep"></div><div class="style-label">Align</div>`;
    html += `<div class="align-grid">` +
      `<button data-align="left">⤙ Left</button>` +
      `<button data-align="hcenter">⋮ Center</button>` +
      `<button data-align="right">Right ⤚</button>` +
      `<button data-align="top">⤒ Top</button>` +
      `<button data-align="vmiddle">⋯ Middle</button>` +
      `<button data-align="bottom">Bottom ⤓</button>` +
      `</div>`;
    html += `<div class="align-grid">` +
      `<button data-dist="h">Distribute →</button>` +
      `<button data-dist="v">Distribute ↓</button>` +
      `</div>`;
  }
  return html;
}

function bindModify(app) {
  const host = document.getElementById("props");
  host.querySelectorAll("[data-mod]").forEach((btn) => {
    btn.onclick = () => {
      switch (btn.dataset.mod) {
        case "dup": app._duplicate(); break;
        case "rot-cw": app._rotate(90); break;
        case "rot-ccw": app._rotate(-90); break;
        case "mirror-h": app._mirror("h"); break;
        case "mirror-v": app._mirror("v"); break;
        case "group": app._group(); break;
        case "ungroup": app._ungroup(); break;
        case "lock": app._toggleLock(); break;
        case "del": { const ids = app._editableIds(); if (ids.length) app.commit(() => app.doc.remove(ids)); break; }
      }
    };
  });
  host.querySelectorAll("[data-align]").forEach((btn) => {
    btn.onclick = () => app.commit(() => alignSelection(app.doc, app._editableIds(), btn.dataset.align));
  });
  host.querySelectorAll("[data-dist]").forEach((btn) => {
    btn.onclick = () => app.commit(() => distributeSelection(app.doc, app._editableIds(), btn.dataset.dist));
  });
  const rot = document.getElementById("p-rot");
  if (rot) rot.onchange = () => { const d = parseFloat(rot.value) || 0; if (d) app._rotate(d); };
}

// ---- layers -----------------------------------------------------------------
export function buildLayers(app) {
  const host = document.getElementById("layers");
  host.innerHTML = "";
  app.doc.layers.forEach((layer) => {
    const row = document.createElement("div");
    row.className = "layer-row";

    const vis = document.createElement("input");
    vis.type = "checkbox";
    vis.checked = layer.visible;
    vis.title = "Visible";
    vis.onchange = () => { layer.visible = vis.checked; app._save(); };

    // color swatch doubles as a color picker
    const swatch = document.createElement("input");
    swatch.type = "color";
    swatch.className = "swatch-input";
    swatch.value = layer.color;
    swatch.title = "Layer color";
    swatch.onchange = () => { layer.color = swatch.value; app._save(); };

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "activeLayer";
    radio.checked = app.doc.activeLayer === layer.id;
    radio.title = "Draw on this layer";
    radio.onchange = () => (app.doc.activeLayer = layer.id);

    const name = document.createElement("span");
    name.textContent = layer.name;
    name.className = "layer-name";
    name.title = "Double-click to rename";
    name.ondblclick = async () => {
      const n = await app._prompt("Layer name", layer.name);
      if (n && n.trim()) { layer.name = n.trim(); buildLayers(app); refreshPanel(app); app._save(); }
    };

    const del = document.createElement("button");
    del.className = "layer-del";
    del.textContent = "×";
    del.title = "Delete layer";
    del.onclick = () => deleteLayer(app, layer.id);

    row.append(vis, swatch, name, radio, del);
    host.appendChild(row);
  });

  const add = document.createElement("button");
  add.className = "layer-add";
  add.textContent = "＋ Add layer";
  add.onclick = () => addLayer(app);
  host.appendChild(add);
}

async function addLayer(app) {
  const n = await app._prompt("New layer name", `Layer ${app.doc.layers.length + 1}`);
  if (!n || !n.trim()) return;
  const id = `layer_${Date.now().toString(36)}`;
  const palette = ["#0891b2", "#be123c", "#4d7c0f", "#a16207", "#7c3aed"];
  const color = palette[app.doc.layers.length % palette.length];
  app.doc.layers.push({ id, name: n.trim(), color, visible: true });
  app.doc.activeLayer = id;
  buildLayers(app);
  app._save();
}

async function deleteLayer(app, id) {
  if (app.doc.layers.length <= 1) { app._alert("Can’t delete", "Keep at least one layer."); return; }
  const used = app.doc.shapes.some((s) => s.layer === id);
  const fallback = app.doc.layers.find((l) => l.id !== id).id;
  if (used && !(await app._confirm("Delete this layer?", "Its shapes move to another layer."))) return;
  app.commit(() => {
    app.doc.shapes.forEach((s) => { if (s.layer === id) s.layer = fallback; });
    app.doc.layers = app.doc.layers.filter((l) => l.id !== id);
    if (app.doc.activeLayer === id) app.doc.activeLayer = fallback;
  });
  buildLayers(app);
}

// ---- shape library ----------------------------------------------------------
// Each tile previews the symbol by drawing its definition; selecting it
// activates a stamp tool.
export function buildShapeLibrary(app, filter = "") {
  const host = document.getElementById("shape-lib");
  host.innerHTML = "";
  const q = filter.trim().toLowerCase();
  const groups = symbolsByCategory();
  for (const [cat, syms] of groups) {
    const matches = syms.filter(
      (s) => !q || s.name.toLowerCase().includes(q) || cat.toLowerCase().includes(q)
    );
    if (!matches.length) continue;
    const h = document.createElement("div");
    h.className = "cat-title";
    h.textContent = cat;
    host.appendChild(h);
    const grid = document.createElement("div");
    grid.className = "sym-grid";
    for (const sym of matches) {
      const btn = document.createElement("button");
      btn.className = "sym-btn";
      btn.dataset.sym = sym.id;
      btn.title = sym.name;
      const cv = document.createElement("canvas");
      cv.width = 84;
      cv.height = 60;
      drawSymbolPreview(cv, sym);
      const cap = document.createElement("small");
      cap.textContent = sym.name;
      btn.append(cv, cap);
      btn.onclick = () => app.setTool(`sym:${sym.id}`);
      grid.appendChild(btn);
    }
    host.appendChild(grid);
  }
  if (!host.children.length) {
    host.innerHTML = `<p class="muted" style="padding:6px 2px">No shapes match “${filter}”.</p>`;
  }
}

function drawSymbolPreview(cv, sym) {
  const ctx = cv.getContext("2d");
  const pad = 12;
  const aspect = sym.w / sym.h;
  let w = cv.width - pad * 2;
  let h = w / aspect;
  if (h > cv.height - pad * 2) {
    h = cv.height - pad * 2;
    w = h * aspect;
  }
  const box = { x: (cv.width - w) / 2, y: (cv.height - h) / 2, w, h };
  ctx.lineWidth = 1.4;
  ctx.lineJoin = "round";
  drawSymbolDef(ctx, sym, box, "#1e293b", "rgba(37,99,235,0.12)");
}

// ---- takeoff ----------------------------------------------------------------
// A running takeoff summary — the seed of the estimate feature.
export function updateTakeoff(app) {
  const host = document.getElementById("takeoff");
  if (!host) return;
  let wallLen = 0, lineLen = 0, area = 0, objects = 0, notes = 0;
  for (const s of app.doc.shapes) {
    if (s.existing) continue; // reference geometry isn't part of the build
    const m = shapeMetrics(s);
    if (s.type === "wall") wallLen += m.length || 0;
    else if (s.type === "line") lineLen += m.length || 0;
    if (shapeClosed(s)) area += m.area || 0;
    if (s.type === "symbol") objects++;
    if (s.type === "text") notes++;
  }
  host.innerHTML =
    `<div class="prop-row"><span>Wall length</span><b>${formatFeetInches(wallLen)}</b></div>` +
    `<div class="prop-row"><span>Line length</span><b>${formatFeetInches(lineLen)}</b></div>` +
    `<div class="prop-row"><span>Enclosed area</span><b>${formatArea(area)}</b></div>` +
    `<div class="prop-row"><span>Objects</span><b>${objects}</b></div>` +
    `<div class="prop-row"><span>Text notes</span><b>${notes}</b></div>`;
}

// ---- settings / hints / chrome ---------------------------------------------
// Refresh unit-dependent labels and input values in the settings panel.
export function refreshUnitsUI(app) {
  const u = unitLabel();
  const gsLabel = document.getElementById("grid-step-label");
  const wtLabel = document.getElementById("wall-thick-label");
  const gs = document.getElementById("grid-step");
  const wt = document.getElementById("wall-thick");
  if (gsLabel) gsLabel.textContent = `Grid step (${u})`;
  if (wtLabel) wtLabel.textContent = `Wall thickness (${u})`;
  if (gs) { gs.step = displayStep(); gs.value = dispNum(app.snap.gridStep); }
  if (wt) { wt.step = displayStep(); wt.value = dispNum(app.wallThickness); }
}

export function setHint(name) {
  const hints = {
    select: "Click to select · drag to move · drag a handle to edit · drag empty space to marquee",
    line: "Click points · double-click or Enter to finish · Esc to cancel · Shift = ortho",
    wall: "Click points to run walls · double-click or Enter to finish · Shift = ortho",
    rect: "Click one corner, then the opposite corner · Shift = square",
    circle: "Click the center, then click to set the radius",
    arc: "Click the start, then the end, then a point on the curve",
    measure: "Click two points to measure · click again to start a new measurement",
    polygon: "Click points · click the start point to close · Enter to finish",
    dimension: "Click two points to place a dimension",
    text: "Click to place a text note",
  };
  let msg = hints[name];
  if (!msg && name && name.startsWith("sym:")) {
    const sym = SYMBOLS.find((s) => s.id === name.slice(4));
    msg = sym ? `Click to place: ${sym.name}` : "Click to place shape";
  }
  document.getElementById("hint").textContent = msg || "";
}

// Make each side-panel section header collapse its contents, persisted.
export function setupPanelCollapse() {
  let collapsed = [];
  try { collapsed = JSON.parse(localStorage.getItem("draftstudio.collapsed") || "[]"); } catch (e) {}
  document.querySelectorAll(".panel section > h3").forEach((h) => {
    const key = h.textContent.trim();
    const section = h.parentElement;
    if (collapsed.includes(key)) section.classList.add("collapsed");
    h.classList.add("collapsible");
    h.onclick = () => {
      section.classList.toggle("collapsed");
      const now = [...document.querySelectorAll(".panel section.collapsed > h3")].map((x) => x.textContent.trim());
      try { localStorage.setItem("draftstudio.collapsed", JSON.stringify(now)); } catch (e) {}
    };
  });
}
