"""Customer plan set: branded landscape sheets of SVG drawings, printed to PDF.

The drawings are yours to draw per job with `Svg` (inches in, viewBox does the scaling).
Everything around them — BHS header, "Prepared for", notes panel, legend, title block,
fonts, PDF — is here so every customer gets the same-looking set.

    from plansheet import Svg, Sheet, build, H, STONE_FILL, SIDING_FILL, CEDAR, GLASS, NEW_WOOD
    s = Svg(-30, -170, 185, 215)          # viewBox in inches: x0, y0, width, height
    s.rect(0, H(37), 3.5, H(94), CEDAR)    # H() = height -> y for elevations (up is negative)
    s.dim(5, 12, 47, 12, '42"')
    build(
        customer={"name": "Jesse & Doree Giles", "address": "…street, city, AR"},
        project="Phase 3 — Porch Enclosure",
        sheets=[Sheet("Long Side", "Seen from outside", s.svg(), ["Plain-language note", "…"])],
        out_pdf="/home/user/<job>/Giles_Porch_Plans.pdf",
    )

Rules the builder holds to: no prices, no framing/glass-cut sizes (those are Brian's), and
the title block always says "Dimensions govern — drawing not to scale".
Customer address is printed on the sheet — generate into a scratch/job folder, never
commit a per-job sheet script or PDF to a public repo.
"""
import base64, datetime, html, os, re, subprocess, urllib.request
from dataclasses import dataclass, field

NAVY, BLUE, GRAY, LIGHT = "#1B3A6B", "#2E6DA4", "#4A4A4A", "#F4F4F4"
CEDAR, NEW_WOOD, GLASS, STONE, EXIST = "#B45309", "#E9B98A", "#CDEAF5", "#E7D3BE", "#E5E7EB"
STONE_FILL, SIDING_FILL = "url(#stone)", "url(#siding)"

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.expanduser("~/.cache/bhs-plansheet")
LOGO_CANDIDATES = [
    "/home/user/BHSmobileapp/frontend/public/bhs-logo.webp",
    os.path.join(HERE, "..", "..", "..", "..", "..", "BHSmobileapp", "frontend", "public", "bhs-logo.webp"),
]
LOGO_URL = "https://raw.githubusercontent.com/beardsservices-png/beardsservices-site/main/brand/bhs-mark.png"
FONTS_CSS = ("https://fonts.googleapis.com/css2?family=Bebas+Neue"
             "&family=Lato:ital,wght@0,400;0,700;1,400&display=swap")
CHROMIUM = "/opt/pw-browsers/chromium"


def H(h):
    """Height above grade -> SVG y, for elevation views."""
    return -h


class Svg:
    """Minimal drafting canvas. All coordinates in inches."""

    def __init__(self, x0, y0, w, h):
        self.vb = (x0, y0, w, h)
        self.out = [_patterns()]

    def rect(self, x1, y1, x2, y2, fill="none", stroke=NAVY, sw=0.45, dash=None):
        x, y = min(x1, x2), min(y1, y2)
        self.out.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{abs(x2-x1):.2f}" height="{abs(y2-y1):.2f}" '
                        f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{_dash(dash)}/>')

    def poly(self, pts, fill="none", stroke=NAVY, sw=0.45, dash=None):
        p = " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)
        self.out.append(f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{_dash(dash)}/>')

    def line(self, x1, y1, x2, y2, stroke=NAVY, sw=0.35, dash=None):
        self.out.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" '
                        f'stroke="{stroke}" stroke-width="{sw}"{_dash(dash)}/>')

    def text(self, x, y, s, size=3.2, anchor="middle", color=GRAY, weight=400, rot=0, italic=False):
        t = f' transform="rotate({rot} {x:.2f} {y:.2f})"' if rot else ""
        it = ' font-style="italic"' if italic else ""
        self.out.append(f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" text-anchor="{anchor}" fill="{color}" '
                        f'font-weight="{weight}"{it}{t}>{html.escape(s)}</text>')

    def window(self, x1, y1, x2, y2):
        """Glass unit in elevation: frame, inner sash line, one glint."""
        lo, hi = max(y1, y2), min(y1, y2)
        self.rect(x1, lo, x2, hi, GLASS, BLUE, 0.45)
        self.rect(x1 + 1.8, lo - 1.8, x2 - 1.8, hi + 1.8, "none", BLUE, 0.25)
        self.line(x1 + 8, lo - 10, x1 + 18, lo - 10 - (lo - hi) * 0.35, "#FFFFFF", 0.6)

    def dim(self, x1, y1, x2, y2, label, off=0, size=3.4):
        """Dimension between two points (horizontal or vertical), label centred."""
        c = BLUE
        if abs(y1 - y2) < 1e-6:
            y = y1 + off
            self.line(x1, y, x2, y, c, 0.3)
            for x in (x1, x2):
                self.line(x, y - 2, x, y + 2, c, 0.3)
                self.line(x - 1.2, y + 1.2, x + 1.2, y - 1.2, c, 0.45)
            self.text((x1 + x2) / 2, y - 1.4, label, size, color=c, weight=700)
        else:
            x = x1 + off
            self.line(x, y1, x, y2, c, 0.3)
            for y in (y1, y2):
                self.line(x - 2, y, x + 2, y, c, 0.3)
                self.line(x - 1.2, y + 1.2, x + 1.2, y - 1.2, c, 0.45)
            self.text(x - 1.6, (y1 + y2) / 2, label, size, color=c, weight=700, rot=-90)

    def callout(self, x, y, tx, ty, s, size=2.9, anchor="start"):
        """Leader from a point on the drawing to a label."""
        self.line(x, y, tx, ty, GRAY, 0.25)
        self.out.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="0.7" fill="{GRAY}"/>')
        if s:
            self.text(tx + (1 if anchor == "start" else -1 if anchor == "end" else 0), ty + 1, s, size, anchor, GRAY)

    def svg(self):
        x0, y0, w, h = self.vb
        return (f'<svg viewBox="{x0} {y0} {w} {h}" xmlns="http://www.w3.org/2000/svg" '
                f'font-family="Lato, Arial, sans-serif" preserveAspectRatio="xMidYMid meet">'
                + "".join(self.out) + "</svg>")


DEFAULT_LEGEND = [(CEDAR, NAVY, "Existing cedar posts"), (NEW_WOOD, NAVY, "New framing, cedar-trimmed"),
                  (GLASS, BLUE, "Glass"), (STONE, NAVY, "Existing stone / masonry"), (EXIST, NAVY, "Existing house")]


@dataclass
class Sheet:
    title: str
    subtitle: str
    svg: str
    notes: list
    legend: list = field(default_factory=lambda: list(DEFAULT_LEGEND))


def build(customer, project, sheets, out_pdf, date=None, html_out=None):
    """Write the plan set to out_pdf (and the HTML beside it). Returns the PDF path."""
    date = date or datetime.date.today().strftime("%m/%d/%Y")
    logo = _logo_data_uri()
    n = len(sheets)
    body = "".join(_page(i + 1, n, sh, customer, project, date, logo) for i, sh in enumerate(sheets))
    doc = (f'<!doctype html><html><head><meta charset="utf-8"><title>{html.escape(project)} — Plans</title>'
           f'<style>{_fonts_css()}{CSS}</style></head><body>{body}</body></html>')
    html_out = html_out or os.path.splitext(out_pdf)[0] + ".html"
    with open(html_out, "w") as f:
        f.write(doc)
    _print_pdf(html_out, out_pdf)
    return out_pdf


# ----------------------------------------------------------------------------- internals
def _dash(d):
    return f' stroke-dasharray="{d}"' if d else ""


def _patterns():
    return ('<defs><pattern id="stone" width="8" height="4" patternUnits="userSpaceOnUse">'
            f'<rect width="8" height="4" fill="{STONE}"/><path d="M0 4H8M4 0V2M0 2H8M1 2V4" stroke="#C4A78A" stroke-width="0.25"/>'
            '</pattern><pattern id="siding" width="4" height="4" patternUnits="userSpaceOnUse">'
            f'<rect width="4" height="4" fill="{EXIST}"/><path d="M0 4H4" stroke="#C9CDD3" stroke-width="0.3"/></pattern></defs>')


def _fetch(url, ua=True):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 Chrome/120 Safari/537.36"} if ua else {})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def _logo_data_uri():
    for p in LOGO_CANDIDATES:
        if os.path.exists(p):
            return "data:image/webp;base64," + base64.b64encode(open(p, "rb").read()).decode()
    try:
        return "data:image/png;base64," + base64.b64encode(_fetch(LOGO_URL)).decode()
    except Exception:
        return ""


def _fonts_css():
    """Google Fonts inlined as base64 — headless Chromium does not load them from the CDN."""
    os.makedirs(CACHE, exist_ok=True)
    cached = os.path.join(CACHE, "fonts.css")
    if os.path.exists(cached):
        return open(cached).read()
    try:
        css = _fetch(FONTS_CSS).decode()
        out = []
        for sub, block in re.findall(r"/\* (\S+) \*/\s*(@font-face \{.*?\})", css, re.S):
            if sub != "latin":
                continue
            url = re.search(r"url\((.*?)\)", block).group(1)
            out.append(block.replace(url, "data:font/woff2;base64," + base64.b64encode(_fetch(url)).decode()))
        css = "\n".join(out)
        open(cached, "w").write(css)
        return css
    except Exception:
        return ""  # falls back to Arial; still a clean document


def _print_pdf(html_path, pdf_path):
    js = f"""
import {{ chromium }} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({{executablePath:'{CHROMIUM}'}}).catch(()=>chromium.launch());
const p = await b.newPage({{viewport:{{width:1056,height:816}}}});
await p.goto('file://{os.path.abspath(html_path)}'); await p.waitForTimeout(800);
await p.pdf({{path:'{os.path.abspath(pdf_path)}', width:'11in', height:'8.5in', printBackground:true}});
const els = await p.$$('.sheet');
for (let i=0;i<els.length;i++) await els[i].screenshot({{path:'{os.path.splitext(os.path.abspath(pdf_path))[0]}-sheet'+(i+1)+'.png'}});
await b.close();
"""
    subprocess.run(["node", "--input-type=module", "-e", js], check=True)


def _page(n, total, sh, customer, project, date, logo):
    items = "".join(f"<li>{html.escape(t)}</li>" for t in sh.notes)
    legend = "".join(f'<div><span style="background:{f};border-color:{b}"></span>{html.escape(t)}</div>'
                     for f, b, t in sh.legend)
    img = f'<img src="{logo}" alt="Beard\'s Home Services">' if logo else ""
    return f"""
<section class="sheet">
  <header>{img}
    <div class="biz"><div class="name">Beard's Home Services</div>
      <div>Mountain Home, AR &nbsp;|&nbsp; Baxter County &amp; Twin Lakes Area</div>
      <div>870-321-1072 &nbsp;|&nbsp; brianb@beardsservices.com</div></div>
    <div class="client"><div class="lbl">Prepared for</div><div class="cname">{html.escape(customer['name'])}</div>
      <div>{html.escape(customer.get('address', ''))}</div></div>
  </header>
  <div class="body">
    <div class="drawing">{sh.svg}</div>
    <aside><h2>{html.escape(sh.title)}</h2><div class="sub">{html.escape(sh.subtitle)}</div>
      <ul>{items}</ul><div class="legend">{legend}</div></aside>
  </div>
  <footer><div><b>{html.escape(project)}</b></div><div>Dimensions govern — drawing not to scale</div>
    <div>{date}</div><div class="sheetno">Sheet {n} of {total}</div></footer>
</section>"""


CSS = f"""
@page {{ size: 11in 8.5in; margin: 0; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: Lato, Arial, sans-serif; color: {GRAY}; }}
.sheet {{ width: 11in; height: 8.5in; padding: 0.35in 0.4in; display: flex; flex-direction: column;
  page-break-after: always; position: relative; }}
.sheet::before {{ content: ""; position: absolute; inset: 0.2in; border: 2px solid {NAVY}; pointer-events: none; }}
header {{ display: flex; align-items: center; gap: 0.2in; border-bottom: 4px solid {NAVY}; padding: 0.05in 0.1in 0.1in; }}
header img {{ height: 0.75in; }}
.biz {{ font-size: 9pt; line-height: 1.35; flex: 1; }}
.biz .name {{ font-family: 'Bebas Neue', Arial, sans-serif; font-size: 22pt; color: {NAVY}; letter-spacing: 0.5px; line-height: 1; }}
.client {{ text-align: right; font-size: 9pt; line-height: 1.35; }}
.client .lbl {{ text-transform: uppercase; font-size: 7pt; letter-spacing: 1px; color: {BLUE}; font-weight: 700; }}
.client .cname {{ font-weight: 700; color: #1A1A1A; font-size: 11pt; }}
.body {{ flex: 1; display: flex; gap: 0.2in; padding: 0.12in 0.1in; min-height: 0; }}
.drawing {{ flex: 1; display: flex; }}
.drawing svg {{ width: 100%; height: 100%; }}
aside {{ width: 2.6in; background: {LIGHT}; padding: 0.15in 0.18in; font-size: 9pt; line-height: 1.4; }}
aside h2 {{ font-family: 'Bebas Neue', Arial, sans-serif; font-weight: 400; font-size: 24pt; color: {NAVY}; margin: 0; line-height: 1; }}
aside .sub {{ color: {BLUE}; font-size: 8.5pt; margin-bottom: 0.1in; font-style: italic; }}
aside ul {{ padding-left: 1.1em; margin: 0 0 0.15in; }}
aside li {{ margin-bottom: 0.07in; }}
.legend div {{ display: flex; align-items: center; gap: 6px; font-size: 8pt; margin-bottom: 3px; }}
.legend span {{ width: 16px; height: 10px; border: 1px solid {NAVY}; display: inline-block; }}
footer {{ display: grid; grid-template-columns: 2fr 2fr 1fr 1fr; border-top: 2px solid {NAVY}; font-size: 8.5pt; }}
footer div {{ padding: 0.06in 0.1in; border-right: 1px solid #C9CDD3; }}
footer div:last-child {{ border-right: 0; }}
footer b {{ color: {NAVY}; font-family: 'Bebas Neue', Arial, sans-serif; font-weight: 400; font-size: 13pt; letter-spacing: 0.5px; }}
.sheetno {{ background: {NAVY}; color: #fff; font-weight: 700; text-align: center; }}
"""
