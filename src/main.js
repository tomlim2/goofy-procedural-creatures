// 진입점. 시드를 정하고, 그리드를 굽고, 시계를 돌린다.

import { createScene } from "./scene.js";
import { makeGrid } from "./creature.js";
import { formatSeed, seedFromString } from "./rng.js";

const canvas = document.getElementById("stage");
const seedLabel = document.getElementById("seed");
const statusLabel = document.getElementById("status");
const countSeg = document.getElementById("countSeg");

const scene = createScene(canvas);

let columns = 7;
let rows = 5;
let seed = readSeedFromHash() ?? (Math.random() * 0xffffffff) >>> 0;

function readSeedFromHash() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return null;
  const parsed = parseInt(raw, 36);
  return Number.isFinite(parsed) ? parsed >>> 0 : seedFromString(raw);
}

function render() {
  const specs = makeGrid(seed, columns * rows, columns);
  scene.build(specs, columns);
  seedLabel.textContent = formatSeed(seed);
  statusLabel.textContent = `${specs.length} ALIVE`;
  window.history.replaceState(null, "", `#${seed.toString(36)}`);
}

function reseed() {
  seed = (Math.random() * 0xffffffff) >>> 0;
  render();
}

document.getElementById("reseed").addEventListener("click", reseed);

countSeg.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-grid]");
  if (!button) return;
  for (const node of countSeg.querySelectorAll("button")) node.classList.remove("on");
  button.classList.add("on");
  [columns, rows] = button.dataset.grid.split("x").map(Number);
  render();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "r" || event.key === "R") reseed();
});

window.addEventListener("resize", () => scene.resize());

render();
scene.resize();

const start = performance.now();
function frame() {
  scene.resize();
  scene.update((performance.now() - start) / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
