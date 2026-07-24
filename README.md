# Draft Studio

A personal, browser-based, general-purpose **design & drafting** tool — draw
anything to real-world scale, from a shape library of structural, architectural,
site, and furniture symbols. Inspired by the core drawing experience of apps
like Arcsite, minus the residential floor-plan clutter, and built to grow the
shape library and an estimate takeoff over time.

Everything runs in the browser. No account, no install, works on desktop and on
an iPad/tablet with touch.

## Running it

```bash
npm start          # zero-dependency Node server, defaults to port 8080
# then open http://localhost:8080
```

The server (`server.js`) serves the app *and* provides a small storage API. It
has no npm dependencies. (A plain static server like `python3 -m http.server`
also works for the drawing UI, but without cloud project storage.)

## Deploying (Railway / Render / Fly / any host)

- **Railway:** New Project → Deploy from GitHub repo → pick this repo. Railway
  auto-detects Node from `package.json`, runs `npm start`, and binds to the
  `PORT` it provides. No build step, no config needed.
- **Persistent storage:** add a Volume and mount it (e.g. at `/data`), then set
  the env var `DATA_DIR=/data`. Drawings saved from the app land there and
  survive redeploys, shared across every device that opens the site. Without a
  volume the app still runs — it just falls back to a local folder and the
  Cloud Projects UI hides itself if no API is reachable.

### Storage API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Check API + report storage dir |
| GET | `/api/drawings` | List saved projects (id, name, updatedAt) |
| POST | `/api/drawings` | Create a project → returns new id |
| GET | `/api/drawings/:id` | Load a project |
| PUT | `/api/drawings/:id` | Update a project |
| DELETE | `/api/drawings/:id` | Delete a project |

## What it does today

- **Infinite grid canvas** at real-world scale (world units are inches).
- **Pan / zoom** — mouse wheel to zoom, space-drag or middle-drag to pan,
  two-finger pinch/pan on touch.
- **Drawing tools:** Line, Wall (real thickness), Rectangle, Circle/Ellipse,
  3-point Arc, Polygon, Dimension, Text notes, and a Measure tape.
- **Units** — switch the whole app between Imperial (ft/in) and Metric (mm/cm/m);
  labels, takeoff, grid, and all numeric fields update together.
- **Groups** — group shapes so they select and move as one unit (Ctrl/⌘+G,
  ungroup with Shift).
- **Shape Library** — a searchable palette of ~95 symbols across 17 categories,
  all at real dimensions: Geometric, **Lumber**, **Sheet Goods**,
  **Masonry & Concrete**, **Roofing**, **Siding**, **Decking & Stairs**,
  **Fencing**, **Hardware** (brackets, ties, post bases, fasteners),
  **Electrical**, **HVAC**, **Plumbing**, Structural, Architectural,
  Site & Landscape, Furniture, Annotation. Symbols are pure data
  (`src/symbols.js`), so adding more is trivial; each can carry a default color
  (PT green, concrete grey, brick red, etc.).
- **Collapsible panels** — click any side-panel section header to fold it; hit
  **Tab** (or the Panel button) to hide the whole sidebar for a clean canvas.
- **Exact dimensions & position** — select any shape and type its precise
  X/Y, Width × Height, Diameter, or Length (to 1/8″). Arrow keys nudge by the
  grid step (Shift = ×12). Design parts to spec, not by eyeballing.
- **Styling** — per-shape stroke color (palette, custom, or by-layer), fill
  (none / light / solid), line weight, and line style (solid / dashed / dotted).
- **Editing tools** — Duplicate, Rotate (±90° or a typed angle), Mirror ↔/↕,
  Copy/Paste, Align (6 edges) & Distribute, Offset (parallel copy), Lock/Unlock,
  drag-to-move and vertex handles.
- **Live dimensions** — length + angle while drawing, segment lengths, area and
  perimeter on closed shapes, square footage.
- **Snapping** — grid, endpoint/midpoint, and ortho lock (or hold Shift).
- **Layers** — add / rename / recolor / delete, reassign selected shapes, plus
  visibility and active-layer control.
- **3D Preview** — one click extrudes your plan into an orbitable 3D model
  (drag to orbit, scroll to zoom) with **view presets** (Top/Front/Right/Left/
  Iso) and an orientation gizmo (Up / N / E). Walls become solid boxes at their
  thickness; closed shapes and symbols become prisms; circles become cylinders.
  Every shape carries a `height`/`elevation`, editable in Properties — so 2D
  and 3D are the *same* model.
- **Materials & textured render** — assign a Material (Wood, Plywood,
  Pressure-treated, Metal, Concrete, Brick, Drywall, Glass, Shingle) to any
  shape and the 3D view renders it with procedural grain/coursing/speckle,
  gradient shading, and a soft ground shadow — so a "plywood shelf" looks like
  one. Library materials (lumber, CMU, brick, metal roof…) are auto-detected.
- **Rounded corners** — give any rectangle a corner radius (great for curbs and
  rounded parts); renders in 2D, SVG, and the 3D extrusion.
- **Material hatch fills** — filled shapes with a material show a 2D hatch
  (brick coursing, wood grain, concrete speckle, glass streaks) so the flat
  plan reads like a real construction drawing.
- **Export** — vector **SVG**, **PNG**, a `.json` project, or a 3D **mesh**:
  **STL** for 3D printing and **OBJ** for games / Blender (both in millimeters,
  from the 3D overlay).
- **Cloud projects** — when deployed with a storage volume, save/open drawings
  on the server, shared across devices.
- **Undo / redo**, autosave to the browser.
- **Takeoff panel** — running totals of length, area, and object counts.

## Keyboard

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| V | Select | D | Dimension |
| L | Line | T | Text |
| W | Wall | Esc | Cancel current tool |
| R | Rectangle | Enter | Finish line/wall |
| C | Circle | Del | Delete selection |
| A | Arc | Arrows | Nudge selection (Shift = ×12) |
| M | Measure | Ctrl/⌘+G | Group (Shift = ungroup) |
| P | Polygon | Ctrl/⌘+Z | Undo (Shift = redo) |
| Shift (drag) | Ortho lock | Ctrl/⌘+S | Save (cloud if available) |
| Ctrl/⌘+D | Duplicate | Ctrl/⌘+C / V | Copy / Paste |
| [ / ] | Rotate −90° / +90° | Ctrl/⌘+A | Select all |

## Structure

```
index.html         layout + panels
styles/main.css    UI styling
src/geometry.js    vector math, feet-inch formatting, snapping math
src/viewport.js    camera (pan/zoom) + grid rendering
src/model.js       document, shapes, layers, undo/redo, persistence
src/snap.js        cursor snap resolution
src/symbols.js     the shape/symbol library (data-driven)
src/view3d.js      software 3D renderer (extrudes the plan into a massing model)
src/transforms.js  precise editing: duplicate, rotate, mirror, align, resize
src/render.js      shape + dimension + selection rendering
src/tools.js       interactive tools (select/line/wall/rect/circle/arc/poly/dim/text/stamps)
src/svg.js         vector SVG export
src/cloud.js       client for the server storage API
server.js          static server + JSON storage API
src/main.js        app wiring, input, file I/O
```

## Roadmap

- Keep growing the **shape library** (more categories and symbols; custom/user
  symbols).
- **Rotation** and scaling handles for placed symbols.
- **Copy / paste**, grouping, and dimension edit-in-place.
- **Estimate export** that feeds the takeoff into a priced materials list.
