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

// 재생성 토글. LIVE면 슬롯이 각자의 시계로 교체되고(레퍼런스 동작),
// STILL이면 판이 고정돼 시드가 곧 화면이다.
let live = true;
const liveButtons = document.getElementById("liveSeg");
liveButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-live]");
  if (!button) return;
  for (const node of liveButtons.querySelectorAll("button")) node.classList.remove("on");
  button.classList.add("on");
  live = button.dataset.live === "on";
  scene.setRegen(live);
});

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
  if (event.key === "s" || event.key === "S") {
    const target = liveButtons.querySelector(live ? '[data-live="off"]' : '[data-live="on"]');
    target.click();
  }
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
