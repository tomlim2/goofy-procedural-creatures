// 진입점. 시드를 정하고, 그리드를 굽고, 시계를 돌린다.

import { createScene } from "./scene/index.js";
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
  // 라벨부터 갱신한다. 빌드가 어떤 이유로든 실패해도 클릭이 접수됐다는
  // 사실은 화면에 보여야 한다.
  seedLabel.textContent = formatSeed(seed);
  window.history.replaceState(null, "", `#${seed.toString(36)}`);
  const specs = makeGrid(seed, columns * rows, columns);
  scene.build(specs, columns);
  statusLabel.textContent = `${specs.length} ALIVE`;
}

function reseed() {
  seed = (Math.random() * 0xffffffff) >>> 0;
  render();
}

document.getElementById("reseed").addEventListener("click", reseed);

// 재생성 토글. 기본은 STILL — 형태는 NEW SEED를 눌러야만 바뀐다.
// LIVE를 켜면 레퍼런스 영상처럼 슬롯이 각자의 시계로 교체된다.
let live = false;
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
  // 예외가 나도 루프는 살린다. rAF 루프가 죽으면 라벨만 바뀌고 캔버스가
  // 멈춰서 "버튼이 안 눌린다"로 보인다.
  try {
    scene.resize();
    scene.update((performance.now() - start) / 1000);
  } catch (error) {
    statusLabel.textContent = "ERROR";
    console.error(error);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
