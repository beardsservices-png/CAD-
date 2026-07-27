// main.js — the application core: canvas + render loop, snapping, tool
// management, selection commands, and file/cloud/3D orchestration.
// Input handling lives in app/pointer.js and app/keyboard.js; the side panel
// UI lives in app/panel.js; dialogs in app/dialogs.js.
import { v, formatFeetInches, setUnitMode, getUnitMode, fromDisplay } from "./geometry.js";
import { Viewport } from "./viewport.js";
import { Document, makeShape, cloneShape, shapePoints, shapeClosed } from "./model.js";
import { resolveSnap } from "./snap.js";
import { renderShapes } from "./render.js";
import { createTool } from "./tools.js";
import { View3D } from "./view3d.js";
import { rotateSelection, mirrorSelection, duplicateShapes } from "./transforms.js";
import * as cloud from "./cloud.js";
import { toSVG } from "./svg.js";
import { toSTL, toOBJ } from "./exporters.js";
import { buildMaterialsList, buildHardwareSuggestions, materialsText } from "./materials.js";
import { installPointer } from "./app/pointer.js";
import { installKeyboard, hideDimInput } from "./app/keyboard.js";
import * as panel from "./app/panel.js";
import { showModal, promptDialog, confirmDialog, alertDialog, toast } from "./app/dialogs.js";

const theme = {
  gridMinor: "#eef2f7",
  gridMajor: "#d7e0ea",
  axis: "#c2ccd8",
  selection: "#2563eb",
  labelBg: "rgba(30,41,59,0.92)",
  labelText: "#ffffff",
  dimBg: "#1e293b",
  dimText: "#ffffff",
  areaBg: "rgba(5,150,105,0.94)",
  areaText: "#ffffff",
  symbol: "#c2410c",
  reference: "#94a3b8",
  rulerBg: "rgba(248,250,252,0.96)",
  rulerText: "#64748b",
  snap: {
    endpoint: "#16a34a",
    midpoint: "#0891b2",
    grid: "#94a3b8",
    align: "#a855f7",
  },
};

const STORAGE_KEY = "draftstudio.autosave.v1";

class App {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.vp = new Viewport(this.canvas);
    this.doc = new Document();
    this.wallThickness = 3.5;
    this.snap = { grid: true, gridStep: 1, endpoint: true, align: true, ortho: false, angleLock: false, tolPx: 12 };
    this.activeToolName = "select";
    this.tool = createTool(this, "select");
    this.mouseWorld = v(0, 0);
    this.mouseScreen = v(0, 0);
    this.lastSnap = null;
    this.pointers = new Map();
    this.gesture = null;
    this.panning = false;
    this.spaceDown = false;
    this.projectId = null; // current cloud project id, if saved
    this.cloudOn = false;
    this.hoverId = null;
    this._dragging = false;
    this.dimBuffer = null; // typed-dimension entry while drawing

    this._initCanvas();
    installPointer(this);
    installKeyboard(this);
    this._buildUI();
    this._restore();
    if (this._syncViewMode) this._syncViewMode();
    this._loop();
  }

  _initCanvas() {
    const resize = () => {
      this.vp.resize();
      this.ctx.setTransform(this.vp.dpr, 0, 0, this.vp.dpr, 0, 0);
    };
    window.addEventListener("resize", resize);
    this.vp.resize();
    this.vp.centerOrigin();
    this.ctx.setTransform(this.vp.dpr, 0, 0, this.vp.dpr, 0, 0);
  }

  // ---- rendering ----
  _loop() {
    const frame = () => {
      this._render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  _render() {
    const ctx = this.ctx;
    ctx.setTransform(this.vp.dpr, 0, 0, this.vp.dpr, 0, 0);
    ctx.clearRect(0, 0, this.vp.width, this.vp.height);
    this.vp.drawGrid(ctx, theme);
    this._drawHover(ctx);
    renderShapes(ctx, this.doc, this.vp, theme);
    if (this.tool.draw) this.tool.draw(ctx, this.vp, theme);
    this._drawGuides(ctx);
    this._drawSnapIndicator(ctx);
    this.vp.drawRulers(ctx, theme, this.mouseScreen);
  }

  // Subtle highlight of the shape under the cursor (Select tool).
  _drawHover(ctx) {
    if (this.activeToolName !== "select" || !this.hoverId) return;
    if (this.doc.selection.has(this.hoverId)) return;
    const s = this.doc.get(this.hoverId);
    if (!s) return;
    const pts = shapePoints(s);
    ctx.save();
    ctx.strokeStyle = "rgba(37,99,235,0.5)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => { const sp = this.vp.worldToScreen(p); i ? ctx.lineTo(sp.x, sp.y) : ctx.moveTo(sp.x, sp.y); });
    if (shapeClosed(s) || s.type === "symbol") ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Magnetic alignment guide lines from the current snap.
  _drawGuides(ctx) {
    const g = this.lastSnap && this.lastSnap.guides;
    if (!g || !g.length || this.activeToolName === "select" && !this._dragging) return;
    ctx.save();
    ctx.strokeStyle = theme.snap.align;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    for (const gd of g) {
      const a = this.vp.worldToScreen(gd.from);
      const b = this.vp.worldToScreen(gd.to);
      // extend slightly past the cursor for a "guide" feel
      const ex = b.x + (b.x - a.x) * 0.06;
      const ey = b.y + (b.y - a.y) * 0.06;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = theme.snap.align;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash([5, 4]);
    }
    ctx.restore();
  }

  _drawSnapIndicator(ctx) {
    if (!this.lastSnap || !this.lastSnap.type || this.activeToolName === "select") return;
    const s = this.vp.worldToScreen(this.lastSnap.point);
    const color = theme.snap[this.lastSnap.type] || theme.snap.grid;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    if (this.lastSnap.type === "endpoint") {
      ctx.strokeRect(s.x - 5, s.y - 5, 10, 10);
    } else if (this.lastSnap.type === "midpoint") {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 6);
      ctx.lineTo(s.x + 6, s.y + 5);
      ctx.lineTo(s.x - 6, s.y + 5);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- snapping + status (used by app/pointer.js) ----
  _snapped(screenPt) {
    const world = this.vp.screenToWorld(screenPt);
    const exclude = this.activeToolName === "select" ? this.doc.selection : new Set();
    const res = resolveSnap(world, this.doc, this.vp, this.snap, exclude);
    this.lastSnap = res;
    return { snap: res.point, world };
  }

  _updateStatus() {
    const el = document.getElementById("coords");
    el.textContent = `X ${formatFeetInches(this.mouseWorld.x)}   Y ${formatFeetInches(this.mouseWorld.y)}`;
    document.getElementById("zoom").textContent = `${Math.round(this.vp.scale / 4 * 100)}%`;
  }

  // ---- tool + commit ----
  setTool(name) {
    if (this.tool && this.tool.cancel) this.tool.cancel();
    this.dimBuffer = null; hideDimInput();
    this.hoverId = null;
    this.activeToolName = name;
    this.tool = createTool(this, name);
    document.querySelectorAll(".tool-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === name);
    });
    document.querySelectorAll(".sym-btn").forEach((b) => {
      b.classList.toggle("active", `sym:${b.dataset.sym}` === name);
    });
    this.canvas.style.cursor = name === "select" ? "default" : "crosshair";
    panel.setHint(name);
  }

  commit(fn) {
    this.doc.snapshot();
    fn();
    this._save();
    this.refreshPanel();
  }

  // ---- selection editing ----
  _selIds() {
    return [...this.doc.selection];
  }
  // Selected ids that aren't locked — the ones edits are allowed to change.
  _editableIds() {
    return this._selIds().filter((id) => { const s = this.doc.get(id); return s && !s.locked; });
  }
  _rotate(deg) {
    if (!this._editableIds().length) return;
    this.commit(() => rotateSelection(this.doc, this._editableIds(), deg));
  }
  _mirror(axis) {
    if (!this._editableIds().length) return;
    this.commit(() => mirrorSelection(this.doc, this._editableIds(), axis));
  }
  _duplicate() {
    if (!this.doc.selection.size) return;
    this.commit(() => {
      const ids = duplicateShapes(this.doc, this._selIds(), 12, 12);
      this.doc.selection = new Set(ids);
    });
  }
  _group() {
    const ids = this._selIds();
    if (ids.length < 2) return;
    const gid = `g_${Date.now().toString(36)}`;
    this.commit(() => ids.forEach((id) => { const s = this.doc.get(id); if (s) s.group = gid; }));
  }
  _ungroup() {
    const ids = this._selIds();
    if (!ids.length) return;
    this.commit(() => ids.forEach((id) => { const s = this.doc.get(id); if (s) delete s.group; }));
  }
  // Toggle lock: if any selected is locked, unlock all; else lock all.
  _toggleLock() {
    const sel = this._selIds().map((id) => this.doc.get(id)).filter(Boolean);
    if (!sel.length) return;
    const unlock = sel.some((s) => s.locked);
    this.commit(() => sel.forEach((s) => { if (unlock) delete s.locked; else s.locked = true; }));
  }
  _copy() {
    this.clipboard = this._selIds().map((id) => cloneShape(this.doc.get(id))).filter(Boolean);
  }
  _paste() {
    if (!this.clipboard || !this.clipboard.length) return;
    this.commit(() => {
      const ids = [];
      for (const s of this.clipboard) {
        const c = cloneShape(s);
        c.pts = c.pts.map((p) => v(p.x + 12, p.y + 12));
        this.doc.add(c);
        ids.push(c.id);
      }
      this.doc.selection = new Set(ids);
    });
  }

  // ---- panel delegates (implementation in app/panel.js) ----
  refreshPanel() { panel.refreshPanel(this); this._updateStepUI(); }
  _buildLayers() { panel.buildLayers(this); }
  _buildShapeLibrary(filter = "") { panel.buildShapeLibrary(this, filter); }
  _refreshUnitsUI() { panel.refreshUnitsUI(this); }

  // ---- dialog delegates (implementation in app/dialogs.js) ----
  _modal(opts) { return showModal(opts); }
  _prompt(title, value = "", placeholder = "") { return promptDialog(title, value, placeholder); }
  _confirm(title, message = "") { return confirmDialog(title, message); }
  _alert(title, message = "") { return alertDialog(title, message); }
  _toast(msg) { toast(msg); }

  // Place a text note using the in-app modal, then return to Select so the
  // Text tool can't re-trap the user on the next click.
  async _promptText(sp) {
    const t = await this._prompt("Text / note", "", "Type a note…");
    if (t != null && t.trim()) {
      this.commit(() =>
        this.doc.add(makeShape("text", { layer: "detail", pts: [{ ...sp }], text: t.trim(), size: 12 }))
      );
    }
    this.setTool("select");
  }

  // ---- UI wiring ----
  _buildUI() {
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.setTool(btn.dataset.tool));
    });
    // file actions
    document.getElementById("btn-new").onclick = async () => {
      if (await this._confirm("Start a new drawing?", "Unsaved local changes will be cleared.")) {
        this.doc = new Document();
        this.projectId = null;
        this._save();
        this._syncViewMode();
        this._buildLayers();
        this.refreshPanel();
        this._setProjectName();
      }
    };
    document.getElementById("btn-save").onclick = () => this._saveFile();
    document.getElementById("btn-open").onclick = () => document.getElementById("file-input").click();
    document.getElementById("file-input").onchange = (e) => this._openFile(e);
    document.getElementById("btn-png").onclick = () => this._exportPNG();
    document.getElementById("btn-svg").onclick = () => this._exportSVG();
    document.getElementById("btn-fit").onclick = () => this._fit();
    document.getElementById("btn-undo").onclick = () => { this.doc.undo(); this.refreshPanel(); this._save(); };
    document.getElementById("btn-redo").onclick = () => { this.doc.redo(); this.refreshPanel(); this._save(); };
    document.getElementById("btn-panel").onclick = () => this._togglePanel();
    document.getElementById("btn-materials").onclick = () => this._openMaterials();
    document.getElementById("btn-materials-close").onclick = () =>
      document.getElementById("materials-modal").classList.add("hidden");
    document.getElementById("btn-materials-copy").onclick = () => this._copyMaterials();
    document.getElementById("step-prev").onclick = () => this._stepBy(-1);
    document.getElementById("step-next").onclick = () => this._stepBy(1);
    this._setupCloud();
    this._setup3D();
    panel.setupPanelCollapse();

    // snap toggles
    const bind = (id, key) => {
      const el = document.getElementById(id);
      el.checked = this.snap[key];
      el.onchange = () => (this.snap[key] = el.checked);
    };
    bind("snap-grid", "grid");
    bind("snap-endpoint", "endpoint");
    bind("snap-align", "align");
    bind("snap-ortho", "ortho");

    const gridStep = document.getElementById("grid-step");
    gridStep.onchange = () => (this.snap.gridStep = Math.max(0.01, fromDisplay(parseFloat(gridStep.value) || 1)));

    const wt = document.getElementById("wall-thick");
    wt.onchange = () => (this.wallThickness = Math.max(0.1, fromDisplay(parseFloat(wt.value) || 3.5)));

    // drawing view mode (saved with the document)
    const viewSel = document.getElementById("view-mode");
    viewSel.onchange = () => {
      this.doc.viewMode = viewSel.value;
      this._save();
      if (this.view3dOpen) { this.view3d.fit(); this.view3d.render(); }
      this._toast(viewSel.value === "elevation" ? "Elevation view — canvas Y is height" : "Plan view — looking down");
    };
    this._syncViewMode = () => { viewSel.value = this.doc.viewMode || "plan"; };
    this._syncViewMode();

    // units toggle (persisted separately from the document)
    const unitSel = document.getElementById("unit-mode");
    try { const su = localStorage.getItem("draftstudio.unit"); if (su) setUnitMode(su); } catch (e) {}
    unitSel.value = getUnitMode();
    unitSel.onchange = () => {
      setUnitMode(unitSel.value);
      try { localStorage.setItem("draftstudio.unit", unitSel.value); } catch (e) {}
      this._refreshUnitsUI();
      this.refreshPanel();
    };
    this._refreshUnitsUI();

    const search = document.getElementById("shape-search");
    if (search) search.oninput = () => this._buildShapeLibrary(search.value);

    this._buildLayers();
    this._buildShapeLibrary();
    this.refreshPanel();
    this.setTool("select");
  }

  _togglePanel() {
    document.body.classList.toggle("hide-panel");
    // canvas width changed — keep the backing store crisp
    this.vp.resize();
    this.ctx.setTransform(this.vp.dpr, 0, 0, this.vp.dpr, 0, 0);
  }

  // ---- materials list ----
  _openMaterials() {
    // Populate the step filter from whatever steps exist in the drawing.
    const sel = document.getElementById("mat-step");
    const max = this._maxStep();
    const keep = sel.value;
    sel.innerHTML = `<option value="">All steps</option>` +
      Array.from({ length: max }, (_, i) => `<option value="${i + 1}">Step ${i + 1}</option>`).join("");
    sel.value = keep && Number(keep) <= max ? keep : "";
    sel.hidden = !max;
    sel.parentElement.style.display = max ? "" : "none";
    sel.onchange = () => this._renderMaterials();
    this._renderMaterials();
    document.getElementById("materials-modal").classList.remove("hidden");
  }

  _renderMaterials() {
    const stepVal = document.getElementById("mat-step").value;
    const onlyStep = stepVal ? Number(stepVal) : null;
    const rows = buildMaterialsList(this.doc, onlyStep);
    // Hardware is whole-project advice, so only show it on the full list.
    const hw = onlyStep ? [] : buildHardwareSuggestions(this.doc);
    const host = document.getElementById("materials-list");
    host.innerHTML = "";
    const makeTable = (items) => {
      const table = document.createElement("table");
      table.className = "mat-table";
      const head = table.insertRow();
      for (const t of ["Qty", "Item", "Size / notes"]) {
        const th = document.createElement("th");
        th.textContent = t;
        head.appendChild(th);
      }
      for (const r of items) {
        const tr = table.insertRow();
        tr.insertCell().textContent = r.qty;
        tr.insertCell().textContent = r.item;
        tr.insertCell().textContent = r.detail;
      }
      return table;
    };
    if (!rows.length) {
      host.innerHTML = `<div class="projects-empty">Nothing to count for this step yet.</div>`;
    } else {
      host.appendChild(makeTable(rows));
      if (hw.length) {
        const h = document.createElement("div");
        h.className = "style-label";
        h.style.margin = "14px 8px 4px";
        h.textContent = "Suggested hardware";
        host.appendChild(h);
        host.appendChild(makeTable(hw));
        const note = document.createElement("p");
        note.className = "muted";
        note.style.margin = "8px";
        note.textContent = "Estimates from the drawing (posts, beams, footings, decking) — verify sizes and counts against local code.";
        host.appendChild(note);
      }
    }
  }

  async _copyMaterials() {
    const stepVal = document.getElementById("mat-step").value;
    const onlyStep = stepVal ? Number(stepVal) : null;
    const text = materialsText(
      this.doc,
      buildMaterialsList(this.doc, onlyStep),
      onlyStep ? [] : buildHardwareSuggestions(this.doc)
    );
    try {
      await navigator.clipboard.writeText(text);
      this._toast("Materials list copied");
    } catch (e) {
      // clipboard blocked (e.g. http) — fall back to a download
      this._download(text, "materials.txt", "text/plain");
    }
  }

  // ---- build-step playback ----
  _maxStep() {
    return this.doc.shapes.reduce((mx, s) => Math.max(mx, s.step || 0), 0);
  }
  _stepBy(d) {
    const max = this._maxStep();
    if (!max) return;
    let cur = this.doc.stepFilter === Infinity ? max + 1 : this.doc.stepFilter;
    cur += d;
    this.doc.stepFilter = cur > max ? Infinity : Math.max(1, cur);
    this._updateStepUI();
    if (this.view3dOpen) this.view3d.render();
  }
  _updateStepUI() {
    const ctl = document.getElementById("step-ctl");
    if (!ctl) return;
    const max = this._maxStep();
    ctl.hidden = !max;
    if (!max) { this.doc.stepFilter = Infinity; return; }
    if (this.doc.stepFilter !== Infinity && this.doc.stepFilter > max) this.doc.stepFilter = Infinity;
    document.getElementById("step-label").textContent =
      this.doc.stepFilter === Infinity ? `All (${max})` : `${this.doc.stepFilter} / ${max}`;
  }

  // ---- 3D preview ----
  _setup3D() {
    const canvas3d = document.getElementById("canvas3d");
    this.view3d = new View3D(canvas3d);
    this.overlay = document.getElementById("view3d");
    this.view3dOpen = false;

    document.getElementById("btn-3d").onclick = () => this._open3D();
    document.getElementById("btn-3d-close").onclick = () => this._close3D();
    document.getElementById("btn-3d-fit").onclick = () => {
      this.view3d.fit();
      this.view3d.render();
    };
    document.querySelectorAll("[data-view]").forEach((btn) => {
      btn.onclick = () => { this.view3d.setView(btn.dataset.view); this.view3d.render(); };
    });
    document.getElementById("btn-export-stl").onclick = () => this._exportMesh("stl");
    document.getElementById("btn-export-obj").onclick = () => this._exportMesh("obj");

    let last = null;
    canvas3d.addEventListener("pointerdown", (ev) => {
      canvas3d.setPointerCapture(ev.pointerId);
      last = { x: ev.clientX, y: ev.clientY };
    });
    canvas3d.addEventListener("pointermove", (ev) => {
      if (!last) return;
      this.view3d.orbit(ev.clientX - last.x, ev.clientY - last.y);
      last = { x: ev.clientX, y: ev.clientY };
      this.view3d.render();
    });
    const stop = () => (last = null);
    canvas3d.addEventListener("pointerup", stop);
    canvas3d.addEventListener("pointercancel", stop);
    canvas3d.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        this.view3d.zoom(Math.pow(1.0015, -ev.deltaY));
        this.view3d.render();
      },
      { passive: false }
    );
    window.addEventListener("resize", () => {
      if (this.view3dOpen) {
        this.view3d.resize();
        this.view3d.render();
      }
    });
  }

  _open3D() {
    this.overlay.classList.remove("hidden");
    this.view3dOpen = true;
    this.view3d.setDoc(this.doc);
    this.view3d.resize();
    this.view3d.fit();
    this.view3d.render();
  }
  _close3D() {
    this.overlay.classList.add("hidden");
    this.view3dOpen = false;
  }

  // ---- cloud storage (server /api backed by the DATA_DIR volume) ----
  async _setupCloud() {
    this.cloudOn = await cloud.isAvailable();
    const projBtn = document.getElementById("btn-projects");
    const saveBtn = document.getElementById("btn-cloud-save");
    if (!this.cloudOn) return; // static-only host: cloud UI stays hidden
    projBtn.hidden = false;
    saveBtn.hidden = false;
    projBtn.onclick = () => this._openProjects();
    saveBtn.onclick = () => this._cloudSave();
    document.getElementById("btn-projects-close").onclick = () =>
      document.getElementById("projects-modal").classList.add("hidden");
    document.getElementById("btn-save-as").onclick = () => this._cloudSaveAs();
    this._setProjectName();
  }

  _setProjectName() {
    const el = document.getElementById("project-name");
    if (el) el.textContent = this.projectId ? this.doc.name || "Untitled" : "";
  }

  // Save to the current cloud project, or create one if none yet.
  async _cloudSave() {
    if (!this.cloudOn) return;
    try {
      if (!this.projectId) return this._cloudSaveAs();
      await cloud.update(this.projectId, this.doc.name, this.doc.toJSON());
      this._toast("Saved to cloud");
    } catch (e) {
      this._alert("Save failed", e.message || "");
    }
  }

  async _cloudSaveAs() {
    if (!this.cloudOn) return;
    const name = await this._prompt("Project name", this.doc.name && this.doc.name !== "Untitled" ? this.doc.name : "", "Untitled");
    if (name == null) return;
    this.doc.name = name.trim() || "Untitled";
    try {
      const meta = await cloud.create(this.doc.name, this.doc.toJSON());
      this.projectId = meta.id;
      this._setProjectName();
      this._toast("Saved to cloud");
      const modal = document.getElementById("projects-modal");
      if (!modal.classList.contains("hidden")) this._renderProjectList();
    } catch (e) {
      this._alert("Save failed", e.message || "");
    }
  }

  async _openProjects() {
    const modal = document.getElementById("projects-modal");
    modal.classList.remove("hidden");
    document.getElementById("storage-note").textContent = "Saved on the server volume";
    this._renderProjectList();
  }

  async _renderProjectList() {
    const host = document.getElementById("projects-list");
    host.innerHTML = `<div class="projects-empty">Loading…</div>`;
    let items = [];
    try {
      items = await cloud.list();
    } catch (e) {
      host.innerHTML = `<div class="projects-empty">${e.message}</div>`;
      return;
    }
    if (!items.length) {
      host.innerHTML = `<div class="projects-empty">No saved projects yet.<br>Use “Save current as new”.</div>`;
      return;
    }
    host.innerHTML = "";
    for (const it of items) {
      const row = document.createElement("div");
      row.className = "project-row";
      const when = it.updatedAt ? new Date(it.updatedAt).toLocaleString() : "";
      const main = document.createElement("div");
      main.className = "p-main";
      main.innerHTML = `<div class="p-name"></div><div class="p-date">${when}${this.projectId === it.id ? " · open" : ""}</div>`;
      main.querySelector(".p-name").textContent = it.name || "Untitled";
      const open = document.createElement("button");
      open.textContent = "Open";
      open.onclick = () => this._openProject(it.id);
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.className = "danger";
      del.onclick = () => this._deleteProject(it.id, it.name);
      row.append(main, open, del);
      host.appendChild(row);
    }
  }

  async _openProject(id) {
    try {
      const rec = await cloud.load(id);
      this.doc = Document.fromJSON(rec.doc || {});
      this.doc.name = rec.name || "Untitled";
      this.projectId = rec.id;
      this._syncViewMode();
      this._buildLayers();
      this.refreshPanel();
      this._fit();
      this._save();
      this._setProjectName();
      document.getElementById("projects-modal").classList.add("hidden");
    } catch (e) {
      this._alert("Could not open project", e.message || "");
    }
  }

  async _deleteProject(id, name) {
    if (!(await this._confirm(`Delete “${name || "Untitled"}”?`, "This cannot be undone."))) return;
    try {
      await cloud.remove(id);
      if (this.projectId === id) {
        this.projectId = null;
        this._setProjectName();
      }
      this._renderProjectList();
    } catch (e) {
      this._alert("Delete failed", e.message || "");
    }
  }

  // ---- view helpers ----
  _fit() {
    if (!this.doc.shapes.length) { this.vp.centerOrigin(); return; }
    let min = v(Infinity, Infinity), max = v(-Infinity, -Infinity);
    for (const s of this.doc.shapes) {
      for (const p of s.pts) {
        min = v(Math.min(min.x, p.x), Math.min(min.y, p.y));
        max = v(Math.max(max.x, p.x), Math.max(max.y, p.y));
      }
    }
    const pad = 40;
    const w = max.x - min.x || 120, h = max.y - min.y || 120;
    const sx = (this.vp.width - pad * 2) / w;
    const sy = (this.vp.height - pad * 2) / h;
    this.vp.scale = Math.max(0.05, Math.min(50, Math.min(sx, sy)));
    const cx = (min.x + max.x) / 2, cy = (min.y + max.y) / 2;
    this.vp.offsetX = this.vp.width / 2 - cx * this.vp.scale;
    this.vp.offsetY = this.vp.height / 2 - cy * this.vp.scale;
  }

  // ---- persistence ----
  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.doc.toJSON()));
    } catch (e) { /* storage full / disabled — ignore */ }
  }
  _restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.doc = Document.fromJSON(JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }
  _saveFile() {
    const data = JSON.stringify(this.doc.toJSON(), null, 2);
    this._download(data, `${this.doc.name || "drawing"}.draft.json`, "application/json");
  }
  _openFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.doc = Document.fromJSON(JSON.parse(reader.result));
        this._syncViewMode();
        this._buildLayers();
        this.refreshPanel();
        this._fit();
        this._save();
      } catch (err) { this._alert("Could not open that file", "It may be corrupted or not a Draft Studio file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ---- exports ----
  _exportPNG() {
    const link = document.createElement("a");
    link.download = `${this.doc.name || "drawing"}.png`;
    link.href = this.canvas.toDataURL("image/png");
    link.click();
  }

  _exportSVG() {
    const svg = toSVG(this.doc);
    this._download(svg, `${this.doc.name || "drawing"}.svg`, "image/svg+xml");
  }

  // Export the 3D mesh for printing (STL) or games/Blender (OBJ). Millimeters.
  _exportMesh(kind) {
    this.view3d.setDoc(this.doc);
    const tris = this.view3d.meshTriangles();
    if (!tris.length) { this._toast("Nothing with height to export"); return; }
    const name = (this.doc.name || "model").replace(/[^a-z0-9_-]+/gi, "_");
    if (kind === "stl") this._download(toSTL(tris, name), `${name}.stl`, "model/stl");
    else this._download(toOBJ(tris, name), `${name}.obj`, "text/plain");
    this._toast(`Exported ${tris.length} triangles (mm)`);
  }

  _download(text, filename, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
