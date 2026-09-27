"""Build a Draft Studio drawing (the JSON the CAD app loads) from Python.

    from cadjson import Drawing
    d = Drawing("Smith Deck — Plan", view="plan")        # or view="elevation"
    d.layer("walls", "Existing", "#94a3b8")
    d.rect((0, 0), (120, 6), layer="walls", existing=True, material="drywall", fill="light", height=96)
    d.rect((10, 40), (13.5, 43.5), layer="structure", step=1, material="pt", fill="solid",
           elevation=0, height=96, label="4×4 × 8 ft post (PT)")
    d.poly([(0, 0), (40, -20), (40, 0)], layer="glass", material="glass", height=1)   # closed for you
    d.dim((0, 60), (120, 60))
    d.text(0, 70, "Note in plain words", size=6)
    d.save("/home/user/CAD-/examples/smith-deck-plan.json")

Units are inches. Plan: +y is toward the front/viewer. Elevation: canvas y is height and
UP IS NEGATIVE — use d.up(h) to turn a height into a y value.
"""
import json


class Drawing:
    def __init__(self, name, view="plan"):
        assert view in ("plan", "elevation", "iso")
        self.doc = {"version": 1, "name": name, "viewMode": view, "layers": [],
                    "activeLayer": None, "shapes": []}
        self._n = 0

    # heights in elevation drawings: 0 = grade, up is negative y
    @staticmethod
    def up(h):
        return -h

    def layer(self, lid, name, color, visible=True):
        self.doc["layers"].append({"id": lid, "name": name, "color": color, "visible": visible})
        self.doc["activeLayer"] = self.doc["activeLayer"] or lid
        return lid

    def _add(self, type_, pts, **props):
        self._n += 1
        if props.get("existing"):
            props.setdefault("locked", True)
        shape = {"id": f"s{self._n}", "type": type_,
                 "pts": [{"x": round(x, 3), "y": round(y, 3)} for x, y in pts], **props}
        self.doc["shapes"].append(shape)
        return shape

    def rect(self, a, b, **p):
        return self._add("rect", [a, b], **p)

    def poly(self, pts, **p):
        # closed=True is what makes a polygon a solid; without it the 3D view drops it
        return self._add("polygon", pts, closed=True, **p)

    def line(self, a, b, **p):
        return self._add("line", [a, b], **p)

    def dim(self, a, b, layer="dims"):
        return self._add("dimension", [a, b], layer=layer)

    def text(self, x, y, s, size=6, layer="detail", **p):
        return self._add("text", [(x, y)], layer=layer, text=s, size=size, **p)

    def save(self, path):
        ids = {l["id"] for l in self.doc["layers"]}
        missing = {s["layer"] for s in self.doc["shapes"]} - ids
        if missing:
            raise ValueError(f"shapes use undeclared layers: {sorted(missing)}")
        with open(path, "w") as f:
            json.dump(self.doc, f, indent=2, ensure_ascii=False)
        return path
