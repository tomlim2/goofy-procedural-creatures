// Pixel diff — the gate that sees what drawdiff cannot: the picture. drawdiff compares sketches (the triangles a part hands to the GPU) and is
// blind to the scene and the shaders — the paper, the sheet pass, a mesh's opacity, the parallax. This page renders the same boards with the
// working tree and with a base tree (serve.mjs serves a git ref under /base/, HEAD by default) on the same GPU, in the bind pose with the boil
// pinned, and counts the pixels that differ per creature. A refactor of the scene or a shader has to come out at 0; a change shows exactly where
// the picture moved. The two trees share nothing but three.js: each is its own module graph, each draws on its own canvas.
// Docs: guidelines/determinism.md § how to check
//   pixeldiff.html?seed=0z0y9qe&boards=4&tol=4

import { createScene, CELL_W, CELL_H } from "./scene/index.js";
import { makeGrid } from "./character/index.js";
import { formatSeed } from "./rng.js";
import { randomSeed } from "./ui.js";

const COLS = 7, ROWS = 5;
const params = new URLSearchParams(window.location.search);
let seed0 = params.get("seed") ? parseInt(params.get("seed"), 36) >>> 0 : randomSeed();
const BOARDS = Math.max(1, Math.min(20, Number(params.get("boards")) || 4));
const TOL = Math.max(0, Number(params.get("tol")) || 4);   // a channel has to move by more than this (0–255) for a pixel to count

const stage = document.getElementById("stage");
const report = document.getElementById("report");
const statusLabel = document.getElementById("status");
const seedLabel = document.getElementById("seed");
const boardSeg = document.getElementById("boardSeg");
const viewSeg = document.getElementById("viewSeg");

// The base tree — loaded by hand so a server without one (not a git checkout) says so instead of a blank page
let baseMod = null;
let baseInfo = { ref: "?", commit: "?" };
try {
  baseMod = {
    createScene: (await import("../base/src/scene/index.js")).createScene,
    makeGrid: (await import("../base/src/character/index.js")).makeGrid
  };
  baseInfo = await (await fetch("./base/base.json")).json();
} catch (error) {
  statusLabel.textContent = "NO BASE";
  report.textContent = "The base tree is not served (/base/ is missing). Start the server inside a git checkout:\n  node serve.mjs [port] [ref]   — the ref is HEAD by default";
  throw error;
}

const tree = createScene(document.getElementById("tree"));
const base = baseMod.createScene(document.getElementById("base"));
for (const s of [tree, base]) {
  s.setBind(true);   // the bind pose — no clock, no action
  s.setBoil(false);  // frame 0 pinned
}

function boardSeed(i) {
  return (seed0 + Math.imul(i, 0x9e3779b9)) >>> 0;
}

// Draws one board with one tree and reads its pixels back (bottom row first, as WebGL hands them over) — in the same task as the render,
// before the drawing buffer is cleared (src/export.js)
function renderBoard(scene, grid, seed) {
  const specs = grid(seed, COLS * ROWS, COLS, null);
  scene.resize();
  scene.build(specs, COLS);
  scene.update(0);
  const renderer = scene.renderer, gl = renderer.getContext();
  const W = renderer.domElement.width, H = renderer.domElement.height;
  const pixels = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return { specs, pixels, W, H, cam: scene.camera };
}

// The cells in pixels, from the camera's frame — the same lattice the scene lays out (slotPosition): cell i at column i % COLS, row ⌊i / COLS⌋
function cellRects(cam, W, H) {
  const width = COLS * CELL_W, height = ROWS * CELL_H;
  const sx = W / (cam.right - cam.left), sy = H / (cam.top - cam.bottom);
  const clampX = (v) => Math.max(0, Math.min(W, v)), clampY = (v) => Math.max(0, Math.min(H, v));
  const rects = [];
  for (let i = 0; i < COLS * ROWS; i += 1) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x0 = -width / 2 + CELL_W * col, y1 = height / 2 - CELL_H * row;
    rects.push({
      x0: clampX(Math.floor((x0 - cam.left) * sx)), x1: clampX(Math.ceil((x0 + CELL_W - cam.left) * sx)),
      y0: clampY(Math.floor((y1 - CELL_H - cam.bottom) * sy)), y1: clampY(Math.ceil((y1 - cam.bottom) * sy))
    });
  }
  return rects;
}

// Compares two boards pixel by pixel — the count per cell, the count outside every cell, and the mask (1 where they differ)
function compare(a, b) {
  const { W, H } = a;
  const mask = new Uint8Array(W * H);
  const rects = cellRects(a.cam, W, H);
  const cellOf = new Int16Array(W * H).fill(-1);
  rects.forEach((r, i) => {
    for (let y = r.y0; y < r.y1; y += 1) for (let x = r.x0; x < r.x1; x += 1) cellOf[y * W + x] = i;
  });
  const perCell = new Array(rects.length).fill(0);
  let outside = 0, total = 0;
  const pa = a.pixels, pb = b.pixels;
  for (let i = 0, p = 0; i < W * H; i += 1, p += 4) {
    if (Math.abs(pa[p] - pb[p]) > TOL || Math.abs(pa[p + 1] - pb[p + 1]) > TOL || Math.abs(pa[p + 2] - pb[p + 2]) > TOL) {
      mask[i] = 1;
      total += 1;
      const c = cellOf[i];
      if (c >= 0) perCell[c] += 1;
      else outside += 1;
    }
  }
  return { mask, perCell, outside, total, rects };
}

// The stage — the tree's board, the base's, or the diff: the base dimmed with every differing pixel in red. WebGL rows come bottom first, so flip
function show(result, view) {
  const { W, H } = result.tree;
  stage.width = W;
  stage.height = H;
  const ctx = stage.getContext("2d");
  const img = ctx.createImageData(W, H);
  const src = view === "base" ? result.base.pixels : result.tree.pixels;
  const d = img.data, mask = result.diff.mask;
  for (let y = 0; y < H; y += 1) {
    const srcRow = (H - 1 - y) * W;
    for (let x = 0; x < W; x += 1) {
      const s = (srcRow + x) * 4, t = (y * W + x) * 4;
      if (view === "diff") {
        if (mask[srcRow + x]) { d[t] = 200; d[t + 1] = 40; d[t + 2] = 30; }
        else { d[t] = 180 + src[s] * 0.3; d[t + 1] = 180 + src[s + 1] * 0.3; d[t + 2] = 180 + src[s + 2] * 0.3; }
      } else {
        d[t] = src[s]; d[t + 1] = src[s + 1]; d[t + 2] = src[s + 2];
      }
      d[t + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

let results = [];
let shown = 0;
let view = "diff";

function run() {
  seedLabel.textContent = formatSeed(seed0);
  window.history.replaceState(null, "", `?seed=${seed0.toString(36)}&boards=${BOARDS}&tol=${TOL}`);
  results = [];
  statusLabel.textContent = "drawing…";
  report.textContent = "drawing…";
  let i = 0;
  const step = () => {
    const seed = boardSeed(i);
    const t = renderBoard(tree, makeGrid, seed);
    const b = renderBoard(base, baseMod.makeGrid, seed);
    if (t.W !== b.W || t.H !== b.H) throw new Error(`the two boards differ in size: ${t.W}×${t.H} vs ${b.W}×${b.H}`);
    results.push({ seed, tree: t, base: b, diff: compare(t, b) });
    i += 1;
    report.textContent = `drawing… ${i}/${BOARDS}`;
    if (i < BOARDS) setTimeout(step, 0);   // a timer, not requestAnimationFrame — a background tab stops animation frames and the run would never finish
    else finish();
  };
  setTimeout(step, 0);
}

function finish() {
  const W = results[0].tree.W, H = results[0].tree.H;
  const lines = [`base ${baseInfo.ref} (${baseInfo.commit}) · ${BOARDS} boards × ${COLS * ROWS} · tol ${TOL} · ${W}×${H} px per board`];
  let changed = 0, total = 0;
  const perBoard = [];
  results.forEach((r, k) => {
    total += r.diff.total;
    const cells = [];
    r.diff.perCell.forEach((n, i) => {
      if (n === 0) return;
      changed += 1;
      const spec = r.tree.specs[i], other = r.base.specs[i];
      const rect = r.diff.rects[i];
      const area = Math.max(1, (rect.x1 - rect.x0) * (rect.y1 - rect.y0));
      const specNote = JSON.stringify(spec) === JSON.stringify(other) ? "" : " · spec differs";
      cells.push(`  ${spec.species} ${spec.seed.toString(36)} [${i}] ${n} px (${(n / area * 100).toFixed(2)}% of the cell)${specNote}`);
    });
    perBoard.push({ k, lines: [`board ${k + 1} ${formatSeed(r.seed)} — ${r.diff.total} px${r.diff.outside ? ` (${r.diff.outside} outside the cells)` : ""}`, ...cells] });
  });
  lines.push(changed ? `changed: ${changed} creatures · ${total} px` : `changed: 0 — the picture did not move`, "");
  for (const b of perBoard) lines.push(...b.lines);
  report.textContent = lines.join("\n");
  statusLabel.textContent = changed ? `${changed} changed` : "0 — identical";
  // The board buttons — the one with the most change shown first
  boardSeg.innerHTML = "";
  results.forEach((r, k) => {
    const button = document.createElement("button");
    button.textContent = String(k + 1);
    button.dataset.board = String(k);
    boardSeg.appendChild(button);
  });
  shown = results.reduce((best, r, k) => (r.diff.total > results[best].diff.total ? k : best), 0);
  refresh();
}

function refresh() {
  for (const b of boardSeg.querySelectorAll("button")) b.classList.toggle("on", Number(b.dataset.board) === shown);
  for (const b of viewSeg.querySelectorAll("button")) b.classList.toggle("on", b.dataset.view === view);
  if (results[shown]) show(results[shown], view);
}

boardSeg.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  shown = Number(b.dataset.board);
  refresh();
});
viewSeg.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  view = b.dataset.view;
  refresh();
});
function reseed() {
  seed0 = randomSeed();
  run();
}
document.getElementById("reseed").addEventListener("click", reseed);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey) reseed();
});

run();
