// server.js — static file server + a small JSON storage API.
//
// Static files are served with correct MIME types (ES modules must be
// text/javascript). The API persists drawings to a data directory — on Railway
// this is a mounted volume at /data, set via the DATA_DIR env var — so projects
// survive redeploys and are shared across devices.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

// Where drawings are stored. Point DATA_DIR at your Railway volume (e.g. /data).
// Falls back to a local ./.data folder for development.
let DATA_DIR = process.env.DATA_DIR || "/data";
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.accessSync(DATA_DIR, fs.constants.W_OK);
} catch (e) {
  DATA_DIR = path.join(ROOT, ".data");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.warn(`DATA_DIR not writable; using ${DATA_DIR}`);
}
console.log(`Storage directory: ${DATA_DIR}`);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

const isSafeId = (id) => /^[A-Za-z0-9_-]{1,64}$/.test(id);
const drawingPath = (id) => path.join(DATA_DIR, `${id}.json`);

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// Read a stored drawing's lightweight metadata.
function readMeta(file) {
  try {
    const obj = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
    return { id: obj.id, name: obj.name || "Untitled", updatedAt: obj.updatedAt || 0 };
  } catch (e) {
    return null;
  }
}

async function handleApi(req, res, urlPath) {
  const parts = urlPath.split("/").filter(Boolean); // ["api","drawings",":id"]
  const resource = parts[1];

  if (resource === "health") {
    return sendJSON(res, 200, { ok: true, storage: DATA_DIR });
  }

  if (resource !== "drawings") return sendJSON(res, 404, { error: "Not found" });

  const id = parts[2];

  // Collection: list all / create new
  if (!id) {
    if (req.method === "GET") {
      const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
      const list = files.map(readMeta).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
      return sendJSON(res, 200, list);
    }
    if (req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      const newId = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const record = { id: newId, name: (body.name || "Untitled").slice(0, 120), updatedAt: Date.now(), doc: body.doc || {} };
      fs.writeFileSync(drawingPath(newId), JSON.stringify(record));
      return sendJSON(res, 201, { id: record.id, name: record.name, updatedAt: record.updatedAt });
    }
    return sendJSON(res, 405, { error: "Method not allowed" });
  }

  // Item: get / update / delete
  if (!isSafeId(id)) return sendJSON(res, 400, { error: "Bad id" });
  const file = drawingPath(id);

  if (req.method === "GET") {
    if (!fs.existsSync(file)) return sendJSON(res, 404, { error: "Not found" });
    return sendJSON(res, 200, JSON.parse(fs.readFileSync(file, "utf8")));
  }
  if (req.method === "PUT") {
    const body = JSON.parse(await readBody(req));
    const record = { id, name: (body.name || "Untitled").slice(0, 120), updatedAt: Date.now(), doc: body.doc || {} };
    fs.writeFileSync(file, JSON.stringify(record));
    return sendJSON(res, 200, { id: record.id, name: record.name, updatedAt: record.updatedAt });
  }
  if (req.method === "DELETE") {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return sendJSON(res, 200, { ok: true });
  }
  return sendJSON(res, 405, { error: "Method not allowed" });
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);

  if (urlPath.startsWith("/api/")) {
    handleApi(req, res, urlPath).catch((err) => {
      sendJSON(res, 400, { error: err.message || "Bad request" });
    });
    return;
  }

  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Draft Studio running on port ${PORT}`);
});
