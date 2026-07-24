// cloud.js — client for the server storage API (/api/drawings).
//
// The app stays fully functional as a static site; these calls only succeed
// when a backend with a DATA_DIR volume is present (feature-detected via
// isAvailable()). Everything is plain fetch, no dependencies.

export async function isAvailable() {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    if (!r.ok) return false;
    const j = await r.json();
    return !!j.ok;
  } catch (e) {
    return false;
  }
}

export async function list() {
  const r = await fetch("/api/drawings", { cache: "no-store" });
  if (!r.ok) throw new Error("Could not list projects");
  return r.json();
}

export async function load(id) {
  const r = await fetch(`/api/drawings/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Could not open project");
  return r.json();
}

// Create a new project; resolves to its metadata (including the new id).
export async function create(name, doc) {
  const r = await fetch("/api/drawings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, doc }),
  });
  if (!r.ok) throw new Error("Could not save project");
  return r.json();
}

// Update an existing project by id.
export async function update(id, name, doc) {
  const r = await fetch(`/api/drawings/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, doc }),
  });
  if (!r.ok) throw new Error("Could not save project");
  return r.json();
}

export async function remove(id) {
  const r = await fetch(`/api/drawings/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Could not delete project");
  return r.json();
}
