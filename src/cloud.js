// cloud.js — client for the server storage API (/api/drawings).
//
// The app stays fully functional as a static site; these calls only succeed
// when a backend with a DATA_DIR volume is present (feature-detected via
// isAvailable()). Everything is plain fetch, no dependencies.
//
// When the server has a DRAWINGS_KEY, it answers 401 until the key is sent.
// The key is asked for once per device and kept in localStorage.

const KEY_STORE = "draftStudio.key";

function savedKey() {
  try { return localStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; }
}

function saveKey(k) {
  try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch (e) {}
}

// fetch with the key attached; on 401 ask for the key once and retry.
async function api(url, opts = {}) {
  const send = () => fetch(url, { cache: "no-store", ...opts, headers: { ...(opts.headers || {}), "X-Studio-Key": savedKey() } });
  let r = await send();
  if (r.status === 401) {
    saveKey("");
    const k = window.prompt("Projects password for Draft Studio:");
    if (!k) return r;
    saveKey(k.trim());
    r = await send();
    if (r.status === 401) saveKey("");
  }
  return r;
}

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
  const r = await api("/api/drawings");
  if (!r.ok) throw new Error("Could not list projects");
  return r.json();
}

export async function load(id) {
  const r = await api(`/api/drawings/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error("Could not open project");
  return r.json();
}

// Create a new project; resolves to its metadata (including the new id).
export async function create(name, doc) {
  const r = await api("/api/drawings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, doc }),
  });
  if (!r.ok) throw new Error("Could not save project");
  return r.json();
}

// Update an existing project by id.
export async function update(id, name, doc) {
  const r = await api(`/api/drawings/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, doc }),
  });
  if (!r.ok) throw new Error("Could not save project");
  return r.json();
}

export async function remove(id) {
  const r = await api(`/api/drawings/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Could not delete project");
  return r.json();
}
