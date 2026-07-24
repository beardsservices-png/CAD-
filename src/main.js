// main.js — application orchestrator: wiring, input, render loop, file I/O.
import {
  v, dist, formatFeetInches, formatArea,
  setUnitMode, getUnitMode, toDisplay, fromDisplay, unitLabel, displayStep, roundDisplay,
} from "./geometry.js";
import { Viewport } from "./viewport.js";
import { Document, shapeMetrics, shapeClosed, makeShape } from "./model.js";
import { resolveSnap } from "./snap.js";
import { renderShapes } from "./render.js";
import { createTool } from "./tools.js";
import { symbolsByCategory, SYMBOLS, drawSymbolDef } from "./symbols.js";
import { View3D } from "./view3d.js";
import { shapeHeight, shapeElevation, cloneShape, shapeBBox } from "./model.js";
import {
  rotateSelection,
  mirrorSelection,
  duplicateShapes,
  setRectSize,
  setCircleDiameter,
  setSegmentLength,
  translateShapes,
  setPosition,
  alignSelection,
  distributeSelection,
} from "./transforms.js";
import * as cloud from "./cloud.js";
import { toSVG } from "./svg.js";

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
  snap: {
    endpoint: "#16a34a",
    midpoint: "#0891b2",
    grid: "#94a3b8",
  },
};

const STORAGE_KEY = "draftstudio.autosave.v1";

// Round to 1/8" precision for display in numeric fields.
const round3 = (n) => Math.round((n || 0) * 8) / 8;

// Stroke color palette offered in the style controls.
const PALETTE = [
  "#1e3a8a", "#0ea5e9", "#0f766e", "#16a34a",
  "#c2410c", "#dc2626", "#6d28d9", "#334155", "#000000",
];

class App {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.vp = new Viewport(this.canvas);
    this.doc = new Document();
    this.wallThickness = 3.5;
    this.snap = { grid: true, gridStep: 1, endpoint: true, ortho: false, angleLock: false, tolPx: 12 };
    this.activeToolName = "select";
    this.tool = createTool(this, "select");
    this.mouseWorld = v(0, 0);
    this.lastSnap = null;
    this.pointers = new Map();
    this.gesture = null;
    this.panning = false;
    this.spaceDown = false;
    this.projectId = null; // current cloud project id, if saved
    this.cloudOn = false;

    this._initCanvas();
    this._bindPointer();
    this._bindWheel();
    this._bindKeys();
    this._buildUI();
    this._restore();
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
    renderShapes(ctx, this.doc, this.vp, theme);
    if (this.tool.draw) this.tool.draw(ctx, this.vp, theme);
    this._drawSnapIndicator(ctx);
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

  // ---- input helpers ----
  _screenPt(ev) {
    const r = this.canvas.getBoundingClientRect();
    return v(ev.clientX - r.left, ev.clientY - r.top);
  }

  _snapped(screenPt) {
    const world = this.vp.screenToWorld(screenPt);
    const exclude = this.activeToolName === "select" ? this.doc.selection : new Set();
    const res = resolveSnap(world, this.doc, this.vp, this.snap, exclude);
    this.lastSnap = res;
    return { snap: res.point, world };
  }

  _bindPointer() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (ev) => {
      c.setPointerCapture(ev.pointerId);
      this.pointers.set(ev.pointerId, this._screenPt(ev));

      // two-finger gesture (pan+zoom) on touch
      if (this.pointers.size === 2) {
        this._beginGesture();
        this.tool.cancel && this.tool.cancel();
        return;
      }

      // pan with middle button or space held
      if (ev.button === 1 || this.spaceDown) {
        this.panning = true;
        this.panLast = this._screenPt(ev);
        return;
      }
      if (ev.button !== 0) return;

      const sp = this._screenPt(ev);
      const { snap, world } = this._snapped(sp);
      this.tool.onDown && this.tool.onDown(snap, ev, world);
    });

    c.addEventListener("pointermove", (ev) => {
      if (this.pointers.has(ev.pointerId)) this.pointers.set(ev.pointerId, this._screenPt(ev));

      if (this.gesture && this.pointers.size >= 2) {
        this._updateGesture();
        return;
      }
      const sp = this._screenPt(ev);
      if (this.panning) {
        const dx = sp.x - this.panLast.x;
        const dy = sp.y - this.panLast.y;
        this.vp.panBy(dx, dy);
        this.panLast = sp;
        return;
      }
      const { snap, world } = this._snapped(sp);
      this.mouseWorld = world;
      this.tool.onMove && this.tool.onMove(snap, ev, world);
      this._updateStatus();
    });

    const end = (ev) => {
      this.pointers.delete(ev.pointerId);
      if (this.pointers.size < 2) this.gesture = null;
      if (this.panning) {
        this.panning = false;
        return;
      }
      const sp = this._screenPt(ev);
      const { snap, world } = this._snapped(sp);
      this.tool.onUp && this.tool.onUp(snap, ev, world);
      this._save();
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", (ev) => this.pointers.delete(ev.pointerId));
    c.addEventListener("dblclick", async (ev) => {
      // Double-click a text shape to edit it in place.
      if (this.activeToolName === "select") {
        const world = this.vp.screenToWorld(this._screenPt(ev));
        const hit = this.doc.hitTest(world, 12 / this.vp.scale);
        if (hit && hit.type === "text") {
          const t = await this._prompt("Edit text", hit.text || "");
          if (t != null) this.commit(() => (hit.text = t.trim()));
          return;
        }
      }
      this.tool.onDblClick && this.tool.onDblClick();
    });
  }

  _beginGesture() {
    const pts = [...this.pointers.values()];
    this.gesture = {
      startDist: dist(pts[0], pts[1]),
      startScale: this.vp.scale,
      center: v((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2),
    };
  }
  _updateGesture() {
    const pts = [...this.pointers.values()];
    const nd = dist(pts[0], pts[1]);
    const nc = v((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
    // pan by centroid movement
    this.vp.panBy(nc.x - this.gesture.center.x, nc.y - this.gesture.center.y);
    this.gesture.center = nc;
    // zoom by pinch ratio
    if (this.gesture.startDist > 0) {
      const target = this.gesture.startScale * (nd / this.gesture.startDist);
      this.vp.zoomAt(nc, target / this.vp.scale);
      this.gesture.startDist = nd;
      this.gesture.startScale = this.vp.scale;
    }
  }

  _bindWheel() {
    this.canvas.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const sp = this._screenPt(ev);
        if (ev.ctrlKey || ev.metaKey || !ev.shiftKey) {
          const factor = Math.pow(1.0015, -ev.deltaY);
          this.vp.zoomAt(sp, factor);
        } else {
          this.vp.panBy(-ev.deltaX, -ev.deltaY);
        }
      },
      { passive: false }
    );
  }

  _bindKeys() {
    const map = {
      v: "select", l: "line", w: "wall", r: "rect", c: "circle",
      p: "polygon", d: "dimension", t: "text", a: "arc", m: "measure",
    };
    window.addEventListener("keydown", (ev) => {
      if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") return;
      if (ev.code === "Space") { this.spaceDown = true; this.canvas.style.cursor = "grab"; return; }
      if (ev.key === "Tab") { ev.preventDefault(); this._togglePanel(); return; }
      const meta = ev.ctrlKey || ev.metaKey;
      if (meta && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        if (ev.shiftKey) this.doc.redo(); else this.doc.undo();
        this.refreshPanel(); this._save(); return;
      }
      if (meta && ev.key.toLowerCase() === "s") { ev.preventDefault(); if (this.cloudOn) this._cloudSave(); else this._saveFile(); return; }
      if (meta && ev.key.toLowerCase() === "a") {
        ev.preventDefault();
        this.doc.shapes.forEach((s) => this.doc.selection.add(s.id));
        this.refreshPanel(); return;
      }
      if (meta && ev.key.toLowerCase() === "g") { ev.preventDefault(); if (ev.shiftKey) this._ungroup(); else this._group(); return; }
      if (meta && ev.key.toLowerCase() === "d") { ev.preventDefault(); this._duplicate(); return; }
      if (meta && ev.key.toLowerCase() === "c") { ev.preventDefault(); this._copy(); return; }
      if (meta && ev.key.toLowerCase() === "v") { ev.preventDefault(); this._paste(); return; }
      if (!meta && (ev.key === "[" || ev.key === "]")) {
        if (this.doc.selection.size) { ev.preventDefault(); this._rotate(ev.key === "[" ? -90 : 90); }
        return;
      }
      if (ev.key.startsWith("Arrow") && this.doc.selection.size) {
        ev.preventDefault();
        const step = ev.shiftKey ? this.snap.gridStep * 12 : this.snap.gridStep || 1;
        const dx = ev.key === "ArrowRight" ? step : ev.key === "ArrowLeft" ? -step : 0;
        const dy = ev.key === "ArrowDown" ? step : ev.key === "ArrowUp" ? -step : 0;
        this.commit(() => translateShapes(this.doc, [...this.doc.selection], dx, dy));
        return;
      }
      if (ev.key === "Escape") { this.tool.cancel && this.tool.cancel(); return; }
      if (ev.key === "Enter") { this.tool.onEnter && this.tool.onEnter(); this._save(); return; }
      if (ev.key === "Delete" || ev.key === "Backspace") {
        if (this.doc.selection.size) {
          ev.preventDefault();
          this.commit(() => this.doc.remove([...this.doc.selection]));
          this.refreshPanel();
        }
        return;
      }
      const t = map[ev.key.toLowerCase()];
      if (t) this.setTool(t);
    });
    window.addEventListener("keyup", (ev) => {
      if (ev.code === "Space") { this.spaceDown = false; this.panning = false; this.canvas.style.cursor = ""; }
    });
  }

  // ---- tool + commit ----
  setTool(name) {
    if (this.tool && this.tool.cancel) this.tool.cancel();
    this.activeToolName = name;
    this.tool = createTool(this, name);
    document.querySelectorAll(".tool-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === name);
    });
    document.querySelectorAll(".sym-btn").forEach((b) => {
      b.classList.toggle("active", `sym:${b.dataset.sym}` === name);
    });
    this.canvas.style.cursor = name === "select" ? "default" : "crosshair";
    this._setHint(name);
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
  _rotate(deg) {
    if (!this.doc.selection.size) return;
    this.commit(() => rotateSelection(this.doc, this._selIds(), deg));
  }
  _mirror(axis) {
    if (!this.doc.selection.size) return;
    this.commit(() => mirrorSelection(this.doc, this._selIds(), axis));
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

  // ---- UI ----
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
    this._setupCloud();
    this._setup3D();
    this._setupPanels();

    // snap toggles
    const bind = (id, key) => {
      const el = document.getElementById(id);
      el.checked = this.snap[key];
      el.onchange = () => (this.snap[key] = el.checked);
    };
    bind("snap-grid", "grid");
    bind("snap-endpoint", "endpoint");
    bind("snap-ortho", "ortho");

    const gridStep = document.getElementById("grid-step");
    gridStep.onchange = () => (this.snap.gridStep = Math.max(0.01, fromDisplay(parseFloat(gridStep.value) || 1)));

    const wt = document.getElementById("wall-thick");
    wt.onchange = () => (this.wallThickness = Math.max(0.1, fromDisplay(parseFloat(wt.value) || 3.5)));

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

  // Build the categorized shape/symbol palette. Each tile previews the symbol
  // by drawing its definition, and selecting it activates a stamp tool.
  _buildShapeLibrary(filter = "") {
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
        this._drawSymbolPreview(cv, sym);
        const cap = document.createElement("small");
        cap.textContent = sym.name;
        btn.append(cv, cap);
        btn.onclick = () => this.setTool(`sym:${sym.id}`);
        grid.appendChild(btn);
      }
      host.appendChild(grid);
    }
    if (!host.children.length) {
      host.innerHTML = `<p class="muted" style="padding:6px 2px">No shapes match “${filter}”.</p>`;
    }
  }

  // ---- 3D preview -----------------------------------------------------------
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

  // Make each side-panel section header collapse its contents, persisted.
  _setupPanels() {
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

  _togglePanel() {
    document.body.classList.toggle("hide-panel");
    // canvas width changed — keep the backing store crisp
    this.vp.resize();
    this.ctx.setTransform(this.vp.dpr, 0, 0, this.vp.dpr, 0, 0);
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

  _toast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // ---- non-blocking modal dialogs (replace native prompt/confirm/alert) ----
  // These never freeze the page and always let the user escape (Esc / backdrop).
  _modal({ title, message = "", input = false, value = "", placeholder = "", ok = "OK", cancel = "Cancel" }) {
    return new Promise((resolve) => {
      const back = document.createElement("div");
      back.className = "app-modal";
      const card = document.createElement("div");
      card.className = "app-modal-card";
      const h = document.createElement("div");
      h.className = "app-modal-title";
      h.textContent = title;
      card.appendChild(h);
      if (message) {
        const p = document.createElement("div");
        p.className = "app-modal-msg";
        p.textContent = message;
        card.appendChild(p);
      }
      let field = null;
      if (input) {
        field = document.createElement("input");
        field.className = "app-modal-input";
        field.type = "text";
        field.value = value;
        field.placeholder = placeholder;
        card.appendChild(field);
      }
      const actions = document.createElement("div");
      actions.className = "app-modal-actions";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "ghost";
      cancelBtn.textContent = cancel;
      const okBtn = document.createElement("button");
      okBtn.className = "ghost primary";
      okBtn.textContent = ok;
      if (cancel === null) cancelBtn.style.display = "none";
      actions.append(cancelBtn, okBtn);
      card.appendChild(actions);
      back.appendChild(card);
      document.body.appendChild(back);
      if (field) setTimeout(() => { field.focus(); field.select(); }, 0);

      const finish = (result) => {
        window.removeEventListener("keydown", onKey, true);
        back.remove();
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(input ? null : false); }
        else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); finish(input ? (field ? field.value : "") : true); }
      };
      window.addEventListener("keydown", onKey, true);
      okBtn.onclick = () => finish(input ? (field ? field.value : "") : true);
      cancelBtn.onclick = () => finish(input ? null : false);
      back.onclick = (e) => { if (e.target === back) finish(input ? null : false); };
    });
  }
  _prompt(title, value = "", placeholder = "") {
    return this._modal({ title, input: true, value, placeholder });
  }
  _confirm(title, message = "") {
    return this._modal({ title, message, ok: "OK", cancel: "Cancel" });
  }
  _alert(title, message = "") {
    return this._modal({ title, message, ok: "OK", cancel: null });
  }

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

  _drawSymbolPreview(cv, sym) {
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

  _buildLayers() {
    const host = document.getElementById("layers");
    host.innerHTML = "";
    this.doc.layers.forEach((layer) => {
      const row = document.createElement("div");
      row.className = "layer-row";

      const vis = document.createElement("input");
      vis.type = "checkbox";
      vis.checked = layer.visible;
      vis.title = "Visible";
      vis.onchange = () => { layer.visible = vis.checked; this._save(); };

      // color swatch doubles as a color picker
      const swatch = document.createElement("input");
      swatch.type = "color";
      swatch.className = "swatch-input";
      swatch.value = layer.color;
      swatch.title = "Layer color";
      swatch.onchange = () => { layer.color = swatch.value; this._save(); };

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "activeLayer";
      radio.checked = this.doc.activeLayer === layer.id;
      radio.title = "Draw on this layer";
      radio.onchange = () => (this.doc.activeLayer = layer.id);

      const name = document.createElement("span");
      name.textContent = layer.name;
      name.className = "layer-name";
      name.title = "Double-click to rename";
      name.ondblclick = async () => {
        const n = await this._prompt("Layer name", layer.name);
        if (n && n.trim()) { layer.name = n.trim(); this._buildLayers(); this.refreshPanel(); this._save(); }
      };

      const del = document.createElement("button");
      del.className = "layer-del";
      del.textContent = "×";
      del.title = "Delete layer";
      del.onclick = () => this._deleteLayer(layer.id);

      row.append(vis, swatch, name, radio, del);
      host.appendChild(row);
    });

    const add = document.createElement("button");
    add.className = "layer-add";
    add.textContent = "＋ Add layer";
    add.onclick = () => this._addLayer();
    host.appendChild(add);
  }

  async _addLayer() {
    const n = await this._prompt("New layer name", `Layer ${this.doc.layers.length + 1}`);
    if (!n || !n.trim()) return;
    const id = `layer_${Date.now().toString(36)}`;
    const palette = ["#0891b2", "#be123c", "#4d7c0f", "#a16207", "#7c3aed"];
    const color = palette[this.doc.layers.length % palette.length];
    this.doc.layers.push({ id, name: n.trim(), color, visible: true });
    this.doc.activeLayer = id;
    this._buildLayers();
    this._save();
  }

  async _deleteLayer(id) {
    if (this.doc.layers.length <= 1) { this._alert("Can’t delete", "Keep at least one layer."); return; }
    const used = this.doc.shapes.some((s) => s.layer === id);
    const fallback = this.doc.layers.find((l) => l.id !== id).id;
    if (used && !(await this._confirm("Delete this layer?", "Its shapes move to another layer."))) return;
    this.commit(() => {
      this.doc.shapes.forEach((s) => { if (s.layer === id) s.layer = fallback; });
      this.doc.layers = this.doc.layers.filter((l) => l.id !== id);
      if (this.doc.activeLayer === id) this.doc.activeLayer = fallback;
    });
    this._buildLayers();
  }

  refreshPanel() {
    const host = document.getElementById("props");
    const sel = [...this.doc.selection].map((id) => this.doc.get(id)).filter(Boolean);
    if (!sel.length) {
      host.innerHTML = `<p class="muted">Nothing selected.<br>Click a shape, or drag a box to select.</p>`;
      this._updateTakeoff();
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
      rows += this._layerSelectHTML(sel);

      // Exact position + size — the core of designing a part precisely.
      const u = unitLabel();
      const st = displayStep();
      const dn = (inches) => this._dispNum(inches);
      rows += `<div class="prop-sep"></div>`;
      rows += `<label class="opt inline">X (${u})<input id="p-x" type="number" step="${st}" value="${dn(bb.min.x)}"></label>`;
      rows += `<label class="opt inline">Y (${u})<input id="p-y" type="number" step="${st}" value="${dn(bb.min.y)}"></label>`;
      if (s.type === "rect") {
        rows += `<label class="opt inline">Width (${u})<input id="p-w" type="number" min="0" step="${st}" value="${dn(bb.max.x - bb.min.x)}"></label>`;
        rows += `<label class="opt inline">Height (${u})<input id="p-h" type="number" min="0" step="${st}" value="${dn(bb.max.y - bb.min.y)}"></label>`;
      } else if (s.type === "circle") {
        rows += `<label class="opt inline">Diameter (${u})<input id="p-d" type="number" min="0" step="${st}" value="${dn(bb.max.x - bb.min.x)}"></label>`;
      } else if ((s.type === "line" || s.type === "wall") && s.pts.length === 2) {
        rows += `<label class="opt inline">Length (${u})<input id="p-len" type="number" min="0" step="${st}" value="${dn(m.length)}"></label>`;
      }

      if (s.type !== "dimension" && s.type !== "text") {
        rows += `<div class="prop-sep"></div>`;
        rows += `<label class="opt inline">3D height (${u})<input id="p-height" type="number" min="0" step="${st}" value="${dn(shapeHeight(s))}"></label>`;
        rows += `<label class="opt inline">Base elev. (${u})<input id="p-elev" type="number" step="${st}" value="${dn(shapeElevation(s))}"></label>`;
      }
    } else {
      rows += `<div class="prop-row"><span>Selected</span><b>${sel.length} shapes</b></div>`;
      rows += this._layerSelectHTML(sel);
    }

    const hasGroup = sel.some((s) => s.group);
    rows += this._styleHTML(sel);
    rows += this._modifyHTML(sel.length, hasGroup);
    host.innerHTML = rows;

    // ---- single-shape numeric binds ----
    if (single) {
      const s = single;
      // fn always receives inches (display units are converted here).
      const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.onchange = () => { this.doc.snapshot(); fn(fromDisplay(parseFloat(el.value) || 0)); this._save(); this.refreshPanel(); };
      };
      bind("p-x", (val) => setPosition(this.doc, s.id, val, shapeBBox(s).min.y));
      bind("p-y", (val) => setPosition(this.doc, s.id, shapeBBox(s).min.x, val));
      bind("p-w", (val) => setRectSize(s, Math.max(0.1, val), shapeBBox(s).max.y - shapeBBox(s).min.y));
      bind("p-h", (val) => setRectSize(s, shapeBBox(s).max.x - shapeBBox(s).min.x, Math.max(0.1, val)));
      bind("p-d", (val) => setCircleDiameter(s, Math.max(0.1, val)));
      bind("p-len", (val) => setSegmentLength(s, Math.max(0.1, val)));
      const hEl = document.getElementById("p-height");
      const eEl = document.getElementById("p-elev");
      if (hEl) hEl.onchange = () => { s.height = Math.max(0, fromDisplay(parseFloat(hEl.value) || 0)); this._save(); };
      if (eEl) eEl.onchange = () => { s.elevation = fromDisplay(parseFloat(eEl.value) || 0); this._save(); };
    }

    this._bindLayerSelect(sel);
    this._bindStyle(sel);
    this._bindModify();
    this._updateTakeoff();
  }

  // Refresh unit-dependent labels and input values in the settings panel.
  _refreshUnitsUI() {
    const u = unitLabel();
    const gsLabel = document.getElementById("grid-step-label");
    const wtLabel = document.getElementById("wall-thick-label");
    const gs = document.getElementById("grid-step");
    const wt = document.getElementById("wall-thick");
    if (gsLabel) gsLabel.textContent = `Grid step (${u})`;
    if (wtLabel) wtLabel.textContent = `Wall thickness (${u})`;
    if (gs) { gs.step = displayStep(); gs.value = this._dispNum(this.snap.gridStep); }
    if (wt) { wt.step = displayStep(); wt.value = this._dispNum(this.wallThickness); }
  }

  // Convert an internal inch value to a rounded number in the display unit.
  _dispNum(inches) {
    const d = toDisplay(inches);
    return getUnitMode() === "metric" ? Math.round(d * 10) / 10 : Math.round(d * 8) / 8;
  }

  _layerSelectHTML(sel) {
    const common = sel.every((s) => s.layer === sel[0].layer) ? sel[0].layer : "";
    const opts = this.doc.layers
      .map((l) => `<option value="${l.id}" ${l.id === common ? "selected" : ""}>${l.name}</option>`)
      .join("");
    return `<label class="opt inline">Layer<select id="p-layer">${common ? "" : `<option value="" selected>—</option>`}${opts}</select></label>`;
  }
  _bindLayerSelect(sel) {
    const el = document.getElementById("p-layer");
    if (el) el.onchange = () => { if (el.value) this.commit(() => sel.forEach((s) => (s.layer = el.value))); };
  }

  // Color / fill / weight / line-style controls (single or multi selection).
  _styleHTML(sel) {
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
    return html;
  }
  _bindStyle(sel) {
    const host = document.getElementById("props");
    host.querySelectorAll(".sw[data-color]").forEach((b) => {
      b.onclick = () => this.commit(() => {
        const c = b.dataset.color;
        sel.forEach((s) => { if (c) s.color = c; else delete s.color; });
      });
    });
    const col = document.getElementById("p-color");
    if (col) col.onchange = () => this.commit(() => sel.forEach((s) => (s.color = col.value)));
    const wt = document.getElementById("p-weight");
    if (wt) wt.onchange = () => this.commit(() => sel.forEach((s) => (s.weight = parseFloat(wt.value))));
    const dash = document.getElementById("p-dash");
    if (dash) dash.onchange = () => this.commit(() => sel.forEach((s) => (s.dash = dash.value)));
    const fill = document.getElementById("p-fill");
    if (fill) fill.onchange = () => this.commit(() => sel.forEach((s) => {
      s.fill = fill.value === "none" ? false : fill.value === "solid" ? "solid" : true;
    }));
  }

  _modifyHTML(count, hasGroup) {
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
    if (count > 1 || hasGroup) {
      html += `<div class="modify-grid">`;
      if (count > 1) html += `<button data-mod="group">Group</button>`;
      if (hasGroup) html += `<button data-mod="ungroup">Ungroup</button>`;
      html += `</div>`;
    }
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

  _bindModify() {
    const host = document.getElementById("props");
    host.querySelectorAll("[data-mod]").forEach((btn) => {
      btn.onclick = () => {
        switch (btn.dataset.mod) {
          case "dup": this._duplicate(); break;
          case "rot-cw": this._rotate(90); break;
          case "rot-ccw": this._rotate(-90); break;
          case "mirror-h": this._mirror("h"); break;
          case "mirror-v": this._mirror("v"); break;
          case "group": this._group(); break;
          case "ungroup": this._ungroup(); break;
          case "del": this.commit(() => this.doc.remove(this._selIds())); break;
        }
      };
    });
    host.querySelectorAll("[data-align]").forEach((btn) => {
      btn.onclick = () => this.commit(() => alignSelection(this.doc, this._selIds(), btn.dataset.align));
    });
    host.querySelectorAll("[data-dist]").forEach((btn) => {
      btn.onclick = () => this.commit(() => distributeSelection(this.doc, this._selIds(), btn.dataset.dist));
    });
    const rot = document.getElementById("p-rot");
    if (rot) rot.onchange = () => { const d = parseFloat(rot.value) || 0; if (d) this._rotate(d); };
  }

  // A running takeoff summary — the seed of the estimate feature.
  _updateTakeoff() {
    const host = document.getElementById("takeoff");
    if (!host) return;
    let wallLen = 0, lineLen = 0, area = 0, objects = 0, notes = 0;
    for (const s of this.doc.shapes) {
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

  _setHint(name) {
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

  _updateStatus() {
    const el = document.getElementById("coords");
    el.textContent = `X ${formatFeetInches(this.mouseWorld.x)}   Y ${formatFeetInches(this.mouseWorld.y)}`;
    document.getElementById("zoom").textContent = `${Math.round(this.vp.scale / 4 * 100)}%`;
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
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${this.doc.name || "drawing"}.draft.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  _openFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.doc = Document.fromJSON(JSON.parse(reader.result));
        this._buildLayers();
        this.refreshPanel();
        this._fit();
        this._save();
      } catch (err) { this._alert("Could not open that file", "It may be corrupted or not a Draft Studio file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  _exportPNG() {
    // Render onto an offscreen canvas at current view for a clean export.
    const link = document.createElement("a");
    link.download = `${this.doc.name || "drawing"}.png`;
    link.href = this.canvas.toDataURL("image/png");
    link.click();
  }

  _exportSVG() {
    const svg = toSVG(this.doc);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${this.doc.name || "drawing"}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
