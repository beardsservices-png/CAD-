// app/pointer.js — canvas pointer input: draw/select dispatch, pan, pinch
// gestures, wheel (touchpad-aware), context hover, and auto-pan at edges.
import { v, dist } from "../geometry.js";
import { shapePoints } from "../model.js";
import { positionDimInput } from "./keyboard.js";

export function installPointer(app) {
  bindPointer(app);
  bindWheel(app);
}

function screenPt(app, ev) {
  const r = app.canvas.getBoundingClientRect();
  return v(ev.clientX - r.left, ev.clientY - r.top);
}

function bindPointer(app) {
  const c = app.canvas;
  c.addEventListener("pointerdown", (ev) => {
    c.setPointerCapture(ev.pointerId);
    app.pointers.set(ev.pointerId, screenPt(app, ev));

    // two-finger gesture (pan+zoom) on touch
    if (app.pointers.size === 2) {
      beginGesture(app);
      app.tool.cancel && app.tool.cancel();
      return;
    }

    // pan with middle button or space held
    if (ev.button === 1 || app.spaceDown) {
      app.panning = true;
      app.panLast = screenPt(app, ev);
      return;
    }
    if (ev.button !== 0) return;

    app._dragging = true;
    const sp = screenPt(app, ev);
    const { snap, world } = app._snapped(sp);
    app.tool.onDown && app.tool.onDown(snap, ev, world);
  });

  c.addEventListener("pointermove", (ev) => {
    if (app.pointers.has(ev.pointerId)) app.pointers.set(ev.pointerId, screenPt(app, ev));

    if (app.gesture && app.pointers.size >= 2) {
      updateGesture(app);
      return;
    }
    const sp = screenPt(app, ev);
    app.mouseScreen = sp;
    if (app.panning) {
      app.vp.panBy(sp.x - app.panLast.x, sp.y - app.panLast.y);
      app.panLast = sp;
      return;
    }
    const { snap, world } = app._snapped(sp);
    app.mouseWorld = world;
    updateHover(app, world);
    autoPan(app, sp);
    app.tool.onMove && app.tool.onMove(snap, ev, world);
    if (app.dimBuffer != null) positionDimInput(app);
    app._updateStatus();
  });

  const end = (ev) => {
    app.pointers.delete(ev.pointerId);
    if (app.pointers.size < 2) app.gesture = null;
    app._dragging = false;
    if (app.panning) {
      app.panning = false;
      return;
    }
    const sp = screenPt(app, ev);
    const { snap, world } = app._snapped(sp);
    app.tool.onUp && app.tool.onUp(snap, ev, world);
    app._save();
  };
  c.addEventListener("pointerup", end);
  c.addEventListener("pointercancel", (ev) => { app.pointers.delete(ev.pointerId); app._dragging = false; });
  c.addEventListener("pointerleave", () => { app.hoverId = null; });

  c.addEventListener("dblclick", async (ev) => {
    // Double-click a text shape to edit it in place.
    if (app.activeToolName === "select") {
      const world = app.vp.screenToWorld(screenPt(app, ev));
      const hit = app.doc.hitTest(world, 12 / app.vp.scale);
      if (hit && hit.type === "text") {
        const t = await app._prompt("Edit text", hit.text || "");
        if (t != null) app.commit(() => (hit.text = t.trim()));
        return;
      }
    }
    app.tool.onDblClick && app.tool.onDblClick();
  });
}

// ---- two-finger touch gesture ----------------------------------------------
function beginGesture(app) {
  const pts = [...app.pointers.values()];
  app.gesture = {
    startDist: dist(pts[0], pts[1]),
    startScale: app.vp.scale,
    center: v((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2),
  };
}
function updateGesture(app) {
  const pts = [...app.pointers.values()];
  const nd = dist(pts[0], pts[1]);
  const nc = v((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
  app.vp.panBy(nc.x - app.gesture.center.x, nc.y - app.gesture.center.y);
  app.gesture.center = nc;
  if (app.gesture.startDist > 0) {
    const target = app.gesture.startScale * (nd / app.gesture.startDist);
    app.vp.zoomAt(nc, target / app.vp.scale);
    app.gesture.startDist = nd;
    app.gesture.startScale = app.vp.scale;
  }
}

// ---- wheel: touchpad-aware -------------------------------------------------
// Touchpad two-finger scroll = pan (both axes). Pinch arrives as ctrl+wheel =
// zoom. A real mouse wheel (coarse line/page deltas, or big deltaY with no
// deltaX) still zooms directly.
function bindWheel(app) {
  app.canvas.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      const sp = screenPt(app, ev);
      const pinch = ev.ctrlKey || ev.metaKey;
      const mouseWheel = ev.deltaMode !== 0 || (Math.abs(ev.deltaY) >= 90 && ev.deltaX === 0);
      if (pinch) {
        app.vp.zoomAt(sp, Math.pow(1.0035, -ev.deltaY));
      } else if (mouseWheel) {
        app.vp.zoomAt(sp, Math.pow(1.0015, -ev.deltaY));
      } else {
        app.vp.panBy(-ev.deltaX, -ev.deltaY);
      }
    },
    { passive: false }
  );
}

// ---- context-aware hover ----------------------------------------------------
function updateHover(app, world) {
  if (app.activeToolName !== "select" || app._dragging) { app.hoverId = null; return; }
  const tol = 8 / app.vp.scale;
  let overHandle = false;
  for (const id of app.doc.selection) {
    const s = app.doc.get(id);
    if (!s || s.locked) continue;
    if (shapePoints(s).some((p) => dist(world, p) <= tol)) { overHandle = true; break; }
  }
  const hit = app.doc.hitTest(world, tol);
  app.hoverId = hit ? hit.id : null;
  app.canvas.style.cursor = overHandle ? "grab" : hit ? "move" : "default";
}

// ---- auto-pan near screen edges while drawing -------------------------------
function autoPan(app, sp) {
  const t = app.tool;
  const drawing = app.activeToolName !== "select" && t &&
    ((t.pts && t.pts.length) || t.p0 || t.start || t.a);
  if (!drawing) return;
  const m = 28, speed = 12;
  let dx = 0, dy = 0;
  if (sp.x < m) dx = speed; else if (sp.x > app.vp.width - m) dx = -speed;
  if (sp.y < m) dy = speed; else if (sp.y > app.vp.height - m) dy = -speed;
  if (dx || dy) app.vp.panBy(dx, dy);
}
