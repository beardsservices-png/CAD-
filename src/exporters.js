// exporters.js — turn the 3D mesh into STL (3D printing) and OBJ (games/Blender).
// Triangles come in as [ [p0,p1,p2], ... ] with points {x,y,z} in inches
// (z up). We export in millimeters so slicers/engines get real-world size.
const MM = 25.4;

function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function normalize(a) {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}
const n = (x) => (Math.round(x * 1000) / 1000);

// ASCII STL.
export function toSTL(tris, name = "model") {
  const lines = [`solid ${name}`];
  for (const [a, b, c] of tris) {
    const nrm = normalize(cross(sub(b, a), sub(c, a)));
    lines.push(` facet normal ${n(nrm.x)} ${n(nrm.y)} ${n(nrm.z)}`);
    lines.push("  outer loop");
    for (const p of [a, b, c]) lines.push(`   vertex ${n(p.x * MM)} ${n(p.y * MM)} ${n(p.z * MM)}`);
    lines.push("  endloop");
    lines.push(" endfacet");
  }
  lines.push(`endsolid ${name}`);
  return lines.join("\n");
}

// Wavefront OBJ (vertices + triangular faces).
export function toOBJ(tris, name = "model") {
  const lines = [`# ${name} — exported from Draft Studio (millimeters)`, `o ${name}`];
  let idx = 1;
  const faces = [];
  for (const t of tris) {
    for (const p of t) lines.push(`v ${n(p.x * MM)} ${n(p.y * MM)} ${n(p.z * MM)}`);
    faces.push(`f ${idx} ${idx + 1} ${idx + 2}`);
    idx += 3;
  }
  return lines.concat(faces).join("\n");
}
