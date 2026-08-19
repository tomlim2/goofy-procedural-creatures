// Minimal static server. ES modules need an http origin, so opening
// index.html from the filesystem will not work.
//
//   node serve.mjs [port]

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.argv[2]) || 7300;

// The moment the server came up. Appended to every module URL.
// no-store alone does not clear the browser's ES module map, so an edited file
// can still run the previous module. Changing the URL itself is what works.
const BUILD = Date.now().toString(36);
const versioned = (spec) => (spec.includes("?") ? spec : `${spec}?v=${BUILD}`);

// Only relative import specifiers get it. The importmap's bare specifier ("three") is left alone.
const rewriteJs = (text) =>
  text.replace(/(["'])(\.\.?\/[^"']+?\.m?js)(["'])/g, (_, a, spec, b) => `${a}${versioned(spec)}${b}`);

const rewriteHtml = (text) =>
  text
    .replace(/(\ssrc=")(\.\.?\/[^"]+?\.m?js)(")/g, (_, a, spec, b) => `${a}${versioned(spec)}${b}`)
    .replace(/(\shref=")(\.\.?\/[^"]+?\.css)(")/g, (_, a, spec, b) => `${a}${versioned(spec)}${b}`);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const path = join(ROOT, normalize(requested).replace(/^(\.\.[/\\])+/, ""));
  if (!path.startsWith(ROOT)) {
    response.writeHead(403).end("forbidden");
    return;
  }
  try {
    const body = await readFile(path);
    const ext = extname(path);
    let out = body;
    if (ext === ".js" || ext === ".mjs") out = Buffer.from(rewriteJs(body.toString("utf8")), "utf8");
    if (ext === ".html") out = Buffer.from(rewriteHtml(body.toString("utf8")), "utf8");

    response.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(out);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
}).listen(PORT, () => {
  console.log(`menagerie → http://127.0.0.1:${PORT}`);
});
