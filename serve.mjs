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

// 서버가 뜬 시각. 모든 모듈 URL 뒤에 붙는다.
// no-store만으로는 브라우저의 ES module map이 비워지지 않아서, 파일을 고쳐도
// 이전 모듈이 그대로 실행되는 일이 있다. URL 자체를 바꿔야 확실하다.
const BUILD = Date.now().toString(36);
const versioned = (spec) => (spec.includes("?") ? spec : `${spec}?v=${BUILD}`);

// 상대 경로 import 지정자에만 붙인다. importmap의 bare specifier("three")는 건드리지 않는다.
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
