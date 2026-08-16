// 진입점. 시드를 정하고, 그리드를 굽고, 시계를 돌린다.

import { createScene } from "./scene/index.js";
import { makeGrid } from "./character/index.js";
import { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS } from "./motion/index.js";
import { formatSeed, seedFromString } from "./rng.js";

const canvas = document.getElementById("stage");
const seedLabel = document.getElementById("seed");
const statusLabel = document.getElementById("status");
const countSeg = document.getElementById("countSeg");

const scene = createScene(canvas);

let columns = 7;
let rows = 5;
// 종족 프리뷰. null이면 고정 레인, 종족명이면 그 종족만.
let only = null;
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
  const specs = makeGrid(seed, columns * rows, columns, only);
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

// 포즈. MOTION은 시계가 리그를 움직이고, BIND는 리그를 바인드 포즈에 고정한다.
const poseSeg = document.getElementById("poseSeg");
poseSeg.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-pose]");
  if (!button) return;
  for (const node of poseSeg.querySelectorAll("button")) node.classList.remove("on");
  button.classList.add("on");
  scene.setBind(button.dataset.pose === "bind");
});

// 잉크. BOIL은 선이 끓고(보일 3벌 순환), STILL은 0번 프레임 고정. 포즈와 별개 축.
const inkSeg = document.getElementById("inkSeg");
inkSeg.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-ink]");
  if (!button) return;
  for (const node of inkSeg.querySelectorAll("button")) node.classList.remove("on");
  button.classList.add("on");
  scene.setBoil(button.dataset.ink === "boil");
});

// 행위 강제. AUTO는 각자 시계의 예약대로(idle + 이따금 행위, 층끼리 겹침), IDLE은 모든 층 idle,
// 행위를 고르면 그 층만 강제하고 다른 층은 idle (팔 행위는 사람·도깨비, 네발 행위는 고양이·개, 몸 행위는 전원).
// 행위 하나(인사·경례·점프·긁기…)가 어떻게 보이는지 판단할 때 쓴다.
const actionSel = document.getElementById("actionSel");
{
  const option = document.createElement("option");
  option.value = "idle";
  option.textContent = "IDLE — 행위 없음";
  actionSel.appendChild(option);
}
for (const [name, def] of Object.entries(ACTIONS)) {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = `${name.toUpperCase()} — ${def.label}`;
  actionSel.appendChild(option);
}
// 몸 행위 — 두발·네발 공통 (강제하면 쉬었다 반복)
for (const [name, def] of Object.entries(BODY_ACTIONS)) {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = `${name.toUpperCase()} — ${def.label} (몸)`;
  actionSel.appendChild(option);
}
// 네발 행위 — 고양이·개에게만 먹는다 (두발은 idle)
for (const [name, def] of Object.entries(QUAD_ACTIONS)) {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = `${name.toUpperCase()} — ${def.label} (네발)`;
  actionSel.appendChild(option);
}
actionSel.addEventListener("change", () => scene.setAction(actionSel.value || null));

const speciesSeg = document.getElementById("speciesSeg");
speciesSeg.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-species]");
  if (!button) return;
  for (const node of speciesSeg.querySelectorAll("button")) node.classList.remove("on");
  button.classList.add("on");
  only = button.dataset.species === "all" ? null : button.dataset.species;
  render();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "r" || event.key === "R") reseed();
  if (event.key === "b" || event.key === "B") {
    const on = poseSeg.querySelector(".on").dataset.pose;
    poseSeg.querySelector(on === "bind" ? '[data-pose="motion"]' : '[data-pose="bind"]').click();
  }
  if (event.key === "i" || event.key === "I") {
    const on = inkSeg.querySelector(".on").dataset.ink;
    inkSeg.querySelector(on === "boil" ? '[data-ink="still"]' : '[data-ink="boil"]').click();
  }
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
