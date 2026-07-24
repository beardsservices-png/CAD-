# Draft Studio

A personal, browser-based, general-purpose **design & drafting** tool — draw
anything to real-world scale, from a shape library of structural, architectural,
site, and furniture symbols. Inspired by the core drawing experience of apps
like Arcsite, minus the residential floor-plan clutter, and built to grow the
shape library and an estimate takeoff over time.

Everything runs in the browser. No account, no install, works on desktop and on
an iPad/tablet with touch.

## Running it

It's a static site — any web server works. From the project folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(ES modules need to be served over http, not opened as a `file://` path.)

## Deploying (Railway / Render / Fly / any host)

The app ships with a tiny zero-dependency Node server (`server.js`) so any
process-based host can run it:

- **Railway:** New Project → Deploy from GitHub repo → pick this repo. Railway
  auto-detects Node from `package.json`, runs `npm start`, and binds to the
  `PORT` it provides. No build step, no config needed.
- Locally the same command works: `npm start` (defaults to port 8080).

## What it does today

- **Infinite grid canvas** at real-world scale (world units are inches).
- **Pan / zoom** — mouse wheel to zoom, space-drag or middle-drag to pan,
  two-finger pinch/pan on touch.
- **Drawing tools:** Line, Wall (real thickness), Rectangle, Circle/Ellipse,
  Polygon, Dimension, Text notes.
- **Shape Library** — a searchable, categorized palette of symbols (Geometric,
  Structural, Architectural, Site & Landscape, Furniture, Annotation). Symbols
  are pure data (`src/symbols.js`), so adding more is trivial.
- **Exact dimensions** — select any shape and type its precise Width × Height,
  Diameter, or Length (to 1/8″). Design parts to spec, not by eyeballing.
- **Editing tools** — Duplicate, Rotate (±90° or a typed angle), Mirror ↔/↕,
  Copy/Paste, plus drag-to-move and vertex handles.
- **Live dimensions** — length + angle while drawing, segment lengths, area and
  perimeter on closed shapes, square footage.
- **Snapping** — grid, endpoint/midpoint, and ortho lock (or hold Shift).
- **Select / move / edit** — drag shapes, drag vertex handles, marquee-select,
  delete.
- **3D Preview** — one click extrudes your plan into an orbitable 3D massing
  model (drag to orbit, scroll to zoom). Every shape carries a `height` and
  `elevation`, editable in Properties — so 2D and 3D are the *same* model.
- **Layers** — Walls, Structure, Objects, Detail, Dimensions (toggle + active).
- **Undo / redo**, autosave to the browser, save/open `.json`, export PNG.
- **Takeoff panel** — running totals of length, area, and object counts —
  the seed of the estimating feature.

## Keyboard

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| V | Select | D | Dimension |
| L | Line | T | Text |
| W | Wall | Esc | Cancel current tool |
| R | Rectangle | Enter | Finish line/wall |
| C | Circle | Del | Delete selection |
| P | Polygon | Ctrl/⌘+Z | Undo (Shift = redo) |
| Shift (drag) | Ortho lock | Ctrl/⌘+S | Save file |
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
src/transforms.js  precise editing: duplicate, rotate, mirror, exact resizing
src/render.js      shape + dimension + selection rendering
src/tools.js       interactive tools (select/line/wall/rect/circle/poly/dim/text/stamps)
src/main.js        app wiring, input, file I/O
```

## Roadmap

- Keep growing the **shape library** (more categories and symbols; custom/user
  symbols).
- **Rotation** and scaling handles for placed symbols.
- **Copy / paste**, grouping, and dimension edit-in-place.
- **Estimate export** that feeds the takeoff into a priced materials list.
