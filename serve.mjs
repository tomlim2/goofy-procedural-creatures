// Minimal static server. ES modules need an http origin, so opening
// index.html from the filesystem will not work.
//
//   node serve.mjs [port] [ref]
//
// The port can also come from the PORT environment (a launcher assigning a free one). ref is a git ref (HEAD by default): that tree is
// extracted with `git archive` once, at start, and served under /base/ — the pixel diff page (pixeldiff.html) renders it next to the
// working tree. Outside a git checkout /base/ is simply 404.

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 7300;
const REF = process.argv[3] || "HEAD";

// The base tree — the ref's files, extracted once into a temp folder (the same way scripts/drawdiff.mjs takes its old tree)
let BASE = null;
try {
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const repoRoot = git("rev-parse --show-toplevel");
  const prefix = git("rev-parse --show-prefix").replace(/\/$/, "");
  const tmp = mkdtempSync(join(tmpdir(), "menagerie-base-"));
  execSync(`git archive ${REF} ${prefix || "."} | tar -x -C "${tmp}"`, { cwd: repoRoot, shell: "/bin/sh", stdio: "ignore" });
  BASE = join(tmp, prefix);
  await writeFile(join(BASE, "base.json"), JSON.stringify({ ref: REF, commit: git(`rev-parse --short ${REF}`) }));
} catch {
  BASE = null;
}

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
  let requested = url.pathname === "/" ? "/index.html" : url.pathname;
  // /base/… is the ref's tree; everything else the working tree
  let root = ROOT;
  if (requested.startsWith("/base/")) {
    if (!BASE) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("no base tree — not a git checkout");
      return;
    }
    root = BASE;
    requested = requested.slice("/base".length);
  }
  const path = join(root, normalize(requested).replace(/^(\.\.[/\\])+/, ""));
  if (!path.startsWith(root)) {
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
  console.log(`menagerie → http://127.0.0.1:${PORT}${BASE ? ` · base ${REF} under /base/` : ""}`);
});
