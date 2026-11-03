---
name: site-to-plans
description: Turn Brian's site photos and field measurements into a to-scale Draft Studio drawing, a branded customer plan set (PDF, no prices), a private job notes doc, and the job's estimate in the BHS app — the drawn-job branch of estimate creation for Beard's Home Services. USE WHEN Brian sends photos and/or measurements of a job that needs drawing (deck, railing, porch enclosure, framed openings, windows, stairs, concrete landing / steps / slab / patio, pergola, fence layout, anything he'd have drawn on graph paper), or says "draw this", "put it in the CAD", "make plans for the customer", "blueprint", "elevation", "overhead view", "I need to quote this".
---

# Site to Plans

Brian gathers; you think. He reports what is physically there. You make every design,
framing, sizing and layout decision, and you ask only for measurements that are
genuinely missing — all of them in **one** message, never drip-fed.

This is the drawn-job branch of estimate creation. A toilet swap never comes here. A
deck, railing, porch enclosure, framed opening or concrete stoop does. It produces what a
price list cannot (the drawing, the customer's plan set, the record of what was decided)
and then puts the drawn scope on the job's estimate in the BHS app (step 6). Prices are
always Brian's: the price book's, or his own words.

## 1. Read everything before asking anything

- Look at every photo. Establish orientation out loud in one line ("overhead: house at
  top, front at bottom; left end butts a wall corner") before drawing.
- Pull the customer and job context: Google Drive (search the customer's last name —
  estimates, Lowe's lists, prior phases live there) and **the BHS app** (below). Read the
  customer's own texts and call summary before designing: Seger's lead asked for a back patio
  and "a sloped area" that Brian never mentioned in the chat.
- List what is **existing** (stays, drawn ghosted) vs **new** (the work).

### Reaching the BHS app

`https://bhsmobileapp-production.up.railway.app`, header `Authorization: Bearer $APP_API_TOKEN`.
If the variable is not set, tell Brian to add `APP_API_TOKEN` in this environment's settings
(environment menu in the title bar → Edit → Network secrets / environment variables); never ask
him to paste it in chat. If he pastes it anyway, keep it in a scratch file, never in a repo.

- `GET /api/search?q=<last name>&include_archived=1` → the customer, and any estimate the app
  already built from the lead (it usually has: update that one, never make a second job).
- `GET /api/leads/<id>/file` → texts, Betty's call summary, the draft.
- `GET /api/filing-cabinet/<job_id>` → the job's lines (with ids), notes, files.

### Measuring from photos (when Brian has no tape numbers)

- Scale off something of known size **in the same plane**: a storm or entry door (36 × 80 in),
  brick courses (king/queen 3 1/8 in a course, modular 2 2/3 in; king brick ~10 in a module).
  Measure in pixels with a script, not by eye; the photo's pixel size is not the size it shows at.
- A face nearer the camera has a bigger course pitch. The ratio tells you how much nearer, not
  how many inches: without the camera distance (a zoomed phone photo does not carry it) depth
  is a guess. Count bricks across the face instead if it is sharp enough; Street View captures
  from two sides help.
- Draw with the estimates, say "+/- 2 in" (more for depths) in the notes, put "estimated from
  photos" on the drawing, and list the 3–4 tape measurements that change the design. That list
  replaces the question round when Brian wants a quote now.

## 2. The one question round

Measurements Brian gave are ground truth. Ask in a single message only for what the
drawing cannot be made without. For framed openings the usual gaps are:

- each opening inside-to-inside (post face to post face / wall)
- what is at each end: post, wall, siding outside corner, nothing
- sill/cap height and clear height to the beam
- any slope above (rake/triangle height at the tall end)
- photos from each side, square on, if the ends are ambiguous

Anything you can decide, decide — and state the decision in the result, e.g. "windows
ordered ½" under the framed opening", "double 2×4 mullion so each flange gets a stud",
"jamb board on the siding side only, to keep the opening as wide as possible". Ask him to
choose between technical options only when there is no obvious or typical answer.

When he wants the quote now and has only photos, do not hold the job for this round: draw on
the photo estimates (step 1) and end with the short list of tape measurements instead.

## 3. Draw it in Draft Studio

Repo `beardsservices-png/CAD-` (public: customer **names** are fine, never addresses,
phones or emails). Live site auto-deploys from `main`.

Use `scripts/cadjson.py` to generate the drawing JSON — one plan and one elevation per
face that has anything interesting on it (openings, slopes). Conventions:

- Inches. Plan: +y toward the front. Elevation: `viewMode: "elevation"`, **up is
  negative y** (`Drawing.up(h)`).
- Existing work: `existing=True` (auto-locked, ghosted, excluded from the takeoff).
- New work gets a `label` (it drives the materials list) and a `step` (build order:
  framing → units → glass/trim).
- `height` + `elevation` on every shape so the 3D view is right.
- Polygons: always via `Drawing.poly` (it sets `closed: true`; without it sloped pieces
  vanish in 3D).
- Text size 5–7 at porch scale.

Deliver it twice:

- As an **Example**: save to `examples/<job-slug>-<view>.json`, add an entry to
  `src/examples.js` (name it "<Customer> <Job> — plan/elevation", blurb, what it teaches).
- Straight into Brian's **Projects** list, so he has nothing to tap: `POST
  https://cad-production-1828.up.railway.app/api/drawings` with `{"name": ..., "doc": <the JSON>}`
  (returns the id); later fixes go to the same entry with `PUT /api/drawings/<id>`, never a
  second POST. (The old note that a cloud session cannot reach it was wrong from Oct 2026.)

Check before shipping (a scratch `DATA_DIR`, so test saves never land anywhere real):

```bash
cd /home/user/CAD- && (PORT=8099 DATA_DIR=/tmp/cad-preview node server.js &) && sleep 1
node .claude/skills/site-to-plans/scripts/preview_example.mjs <example-id> /tmp/<slug>
```

Look at both PNGs (2D and 3D). Fix overlapping labels and anything missing in 3D.
Commit, push to `main`, and confirm the deploy by commit status (not by assuming):

```bash
curl -sS "https://api.github.com/repos/beardsservices-png/CAD-/commits/<sha>/status"
```

`success` = live. A later "Deployment failed" on an older commit, stamped the minute a
newer one went live, is Railway retiring it — not a failure.

## 4. Customer plan set (PDF)

Use `scripts/plansheet.py`. Draw each sheet with its `Svg` class (same geometry as the
CAD drawing), then `build(...)`:

- Sheets: overhead plan, then one elevation per face with work on it.
- Pass a `legend` to each `Sheet` for anything that is not a porch: the default legend
  (cedar posts, glass, stone) is the Giles job's.
- Notes in plain language: what they will see, not how it is framed.
- **Never** on the customer copy: prices, hours, framing member sizes, glass cut sizes.
- Title block carries the project/phase name; header carries customer name and
  address — so generate into a scratch folder, **never commit a per-job sheet script or
  PDF** to a public repo.

It renders sheet PNGs beside the PDF; look at every one before sending. Hand the PDF to
Brian (he emails it himself from his phone) and file it on the job (step 6).

## 5. Private job notes doc

Create (or append to) a Google Doc in Brian's Drive named
`<LastName>_<Phase>_<Job>_Design_Notes` from `templates/job-notes.md`: where everything
lives, the site as measured (his numbers, with the date), every design decision with
sizes, glass/material cut sizes, and open items. This is the running record — later
sessions add to it rather than starting over.

## 6. Put it on the estimate in the app

Write the drawn scope into the job's estimate yourself (Brian, 3 Nov 2026: he asked what I
needed to get in, gave the token, and expected it done). **Prices are his**: the price book's or
his own words, never yours.

1. **Price book first.** `POST /api/estimate/from-scope {"scope": "..."}` (read-only) maps the
   scope to catalog items and prices them. Use its catalog ids, units and quantities.
2. **Where the book has the wrong item** (it priced a 19 in raised stoop as a $9.50/sq.ft. flat
   slab, and brick step removal at an interior-wall rate), say so and ask him in the
   multiple-choice box, with options built from **his own history**: past lines for the same work
   (`GET /api/search?q=<work words>`; ask him which customer if he remembers one, e.g. "the steps
   on Louann"), `GET /api/dashboard` → `avg_hourly_rate`, `GET /api/pricing-check` → per-service
   $/hr. homewyse is the benchmark for new items, when it has a page.
3. **A lump sum he gives** is split over the measured lines (never quantity 1 for measurable
   work) and each per-unit price is saved to the price book with `POST /api/catalog`
   (`price_low = price_high`), then the lines point at those items, so the next quote starts there.
4. `PUT /api/jobs/<id>/lines {"services": [...]}` takes the **whole** list: a line left out is
   deleted. Send each existing line back with its `id`. Never send a $0 labor line without a
   `catalog_id`: the app makes a price-book item out of any un-linked labor line, at its price
   (materials and supplier lines are left alone).
5. On the job: the plan PDF and links (Drive notes, Draft Studio) via
   `POST /api/jobs/<id>/files` (multipart `file` + `title`, or JSON `{url, title}`); a dated private
   note via `POST /api/jobs/<id>/notes {text}`; `POST /api/jobs/<id>/next-step {text}` (200
   chars). Check the result with `GET /api/print/<id>`; do not mark it sent or reviewed.

### Concrete jobs (Brian, 3 Nov 2026)

- **Volume:** flat slab at 4 in = sq.ft. ÷ 81 cu.yd. A tall stoop is figured with a core of
  compacted gravel and the broken-up old steps (6 in walls and top); give the solid figure too,
  because rounding up "to cover our butts" only covers the core version. Brian rounds up.
- **Ready-mix goes ON the estimate**, the one exception to labor-only (every past concrete job
  had it: Bradford, Lenz, Cole, Welch; Travis Green in the notes), as **`service_type:
  "supplier"`** lines (*They pay the supplier* on the line sheet) — never `materials`, which
  would put the concrete into his total, the balance due and his income. A supplier line prints
  under the total in its own table and is in no figure anywhere (pinned by the app's
  `test_supplier_lines.py`). Lines: `N cu.yd.` at his per-yard figure with fiber mesh and tax
  (about $100 in Nov 2026), a short load fee (about $50), and a trip fee for the boonies
  ($25–30). Description on each: *"Estimated price, after tax. Paid to the ready-mix supplier on
  the day of delivery."* Two pours on one truck can save the second short load and trip: say so.
- **Labor includes the forms** (plywood, 2x4s, screws, about $100 at stoop size); he strips the
  sides after the top is broomed and finishes the edges, so a stoop is a 2-day job. Gravel,
  rebar, expansion strip and a handrail are the homeowner's, listed in the private notes.
- Landing 1 in below the threshold (1 1/2 max), at least 36 in deep, risers equal and at most
  7 3/4 in, treads at least 10 in; steps kept out of the garage door / vehicle path; check for
  weep holes along any brick the concrete will bury.

## 7. Report

Plain language, short: what was drawn and where to open it (already in Projects), what the
estimate now says and which prices are still his to set, the decisions made for him, what is
still unknown (with the exact measurement needed), and what he does on his phone (review the
estimate, email the PDF). Finished means on `main`; check the deploy before saying it is live.

## Gotchas learned the hard way

- An ambiguous end (post vs siding corner) is the most common wrong guess — photos from
  that side settle it; ask for them in the one question round.
- Perspective lies about slopes in photos; do not infer a beam's pitch from one picture.
- A measured opening is not a unit size: frame it (plates, jacks, mullions), then size
  units to the framed opening minus ½".
- Headless Chromium will not fetch Google Fonts; `plansheet.py` inlines them.
- Screenshot the sheet elements, not a scrolled page — scroll captures come out
  half-drawn.
- A door swing is `Drawing._add("arc", [start, through, end], ...)`. Arcs drew the long way
  round until 3 Nov 2026 (fixed in `src/geometry.js`); if one shows as three quarters of a circle
  again, that bug is back.
- Draft Studio prints every edge's length on every shape: shapes stacked on the same outline
  (gravel base under a slab, an expansion strip on its edge) double the labels. Keep those in
  the notes or the elevation, and move text off the area labels at shape centers.
