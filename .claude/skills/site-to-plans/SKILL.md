---
name: site-to-plans
description: Turn Brian's site photos and field measurements into a to-scale Draft Studio drawing, a branded customer plan set (PDF, no prices), and a private job notes doc — the drawn-job branch of estimate creation for Beard's Home Services. USE WHEN Brian sends photos and/or measurements of a job that needs drawing (deck, railing, porch enclosure, framed openings, windows, stairs, pergola, fence layout, anything he'd have drawn on graph paper), or says "draw this", "put it in the CAD", "make plans for the customer", "blueprint", "elevation", "overhead view".
---

# Site to Plans

Brian gathers; you think. He reports what is physically there. You make every design,
framing, sizing and layout decision, and you ask only for measurements that are
genuinely missing — all of them in **one** message, never drip-fed.

This is the drawn-job branch of estimate creation. A toilet swap never comes here. A
deck, railing, porch enclosure or framed opening does. The estimate itself (lines,
prices, hours) still goes through the BHS app; this skill produces what a price list
cannot: the drawing, the customer's plan set, and the record of what was decided.

## 1. Read everything before asking anything

- Look at every photo. Establish orientation out loud in one line ("overhead: house at
  top, front at bottom; left end butts a wall corner") before drawing.
- Pull the customer and job context: Google Drive (search the customer's last name —
  estimates, Lowe's lists, prior phases live there) and the BHS app job if reachable.
- List what is **existing** (stays, drawn ghosted) vs **new** (the work).

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
"jamb board on the siding side only, to keep the opening as wide as possible". Never
ask him to choose between technical options.

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

Deliver as an **Example**: save to `examples/<job-slug>-<view>.json`, add an entry to
`src/examples.js` (name it "<Customer> <Job> — plan/elevation", blurb, what it teaches).
Cloud sessions cannot write to Brian's Projects list (Railway is behind the egress
proxy); he opens the example and taps **Cloud Save**.

Check before shipping:

```bash
cd /home/user/CAD- && (PORT=8099 node server.js &) && sleep 1
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
- Notes in plain language: what they will see, not how it is framed.
- **Never** on the customer copy: prices, hours, framing member sizes, glass cut sizes.
- Title block carries the project/phase name; header carries customer name and
  address — so generate into a scratch folder, **never commit a per-job sheet script or
  PDF** to a public repo.

It renders sheet PNGs beside the PDF; look at every one before sending. Hand the PDF to
Brian (he emails it himself from his phone).

## 5. Private job notes doc

Create (or append to) a Google Doc in Brian's Drive named
`<LastName>_<Phase>_<Job>_Design_Notes` from `templates/job-notes.md`: where everything
lives, the site as measured (his numbers, with the date), every design decision with
sizes, glass/material cut sizes, and open items. This is the running record — later
sessions add to it rather than starting over.

## 6. Hand back to the estimate

Everything drawn has a price-list shape. Give Brian (or the app's scope → estimate step)
a plain scope written from the drawing: counts, linear/square footage, units, what is
removed, what is supplied. The BHS app prices it from the catalog — this skill never
sets a price.

## 7. Report

Plain language, short: what was drawn and where to open it, the decisions made for him,
what is still unknown (with the exact measurement needed), and what he needs to do on
his phone (open example → Cloud Save; email the PDF).

## Gotchas learned the hard way

- An ambiguous end (post vs siding corner) is the most common wrong guess — photos from
  that side settle it; ask for them in the one question round.
- Perspective lies about slopes in photos; do not infer a beam's pitch from one picture.
- A measured opening is not a unit size: frame it (plates, jacks, mullions), then size
  units to the framed opening minus ½".
- Headless Chromium will not fetch Google Fonts; `plansheet.py` inlines them.
- Screenshot the sheet elements, not a scrolled page — scroll captures come out
  half-drawn.
