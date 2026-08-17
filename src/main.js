// 진입점. 시드를 정하고, 그리드를 굽고, 시계를 돌린다.

import { createScene } from "./scene/index.js";
import { makeGrid } from "./character/index.js";
import { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS } from "./motion/index.js";
import { formatSeed, seedFromString } from "./rng.js";
import { bindSeg, addOption, randomSeed, runLoop } from "./ui.js";

const canvas = document.getElementById("stage");
const seedLabel = document.getElementById("seed");
const statusLabel = document.getElementById("status");

const scene = createScene(canvas);
// 디버그 손잡이 — 콘솔에서 window.menagerie.scene.creatures() 로 개체 리그를 들여다본다
window.menagerie = { scene };

let columns = 7;
let rows = 5;
// 종족 프리뷰. null이면 고정 레인, 종족명이면 그 종족만.
let only = null;
let seed = readSeedFromHash() ?? randomSeed();

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
  seed = randomSeed();
  render();
}

document.getElementById("reseed").addEventListener("click", reseed);

// 재생성 토글. 기본은 STILL — 형태는 NEW SEED를 눌러야만 바뀐다.
// LIVE를 켜면 레퍼런스 영상처럼 슬롯이 각자의 시계로 교체된다.
const live = bindSeg(document.getElementById("liveSeg"), "live", (value) => scene.setRegen(value === "on"));

bindSeg(document.getElementById("countSeg"), "grid", (value) => {
  [columns, rows] = value.split("x").map(Number);
  render();
});

// 포즈. MOTION은 시계가 리그를 움직이고, BIND는 리그를 바인드 포즈에 고정한다.
const pose = bindSeg(document.getElementById("poseSeg"), "pose", (value) => scene.setBind(value === "bind"));

// 잉크. BOIL은 선이 끓고(보일 3벌 순환), STILL은 0번 프레임 고정. 포즈와 별개 축.
const ink = bindSeg(document.getElementById("inkSeg"), "ink", (value) => scene.setBoil(value === "boil"));

// 행위 강제. AUTO는 각자 시계의 예약대로(idle + 이따금 행위, 층끼리 겹침), IDLE은 모든 층 idle,
// 행위를 고르면 그 층만 강제하고 다른 층은 idle (팔 행위는 사람·도깨비, 네발 행위는 고양이·개, 몸 행위는 전원).
// 행위 하나(인사·경례·점프·긁기…)가 어떻게 보이는지 판단할 때 쓴다.
const actionSel = document.getElementById("actionSel");
addOption(actionSel, "idle", "IDLE — 행위 없음");
for (const [name, def] of Object.entries(ACTIONS)) addOption(actionSel, name, `${name.toUpperCase()} — ${def.label}`);
// 기본 상태 — SLEEP은 네발을 엎드려 재운다 (사람·도깨비는 잠 자세가 없어 idle), WALK는 걷기 (전 종족, 팔 행위는 예약대로)
addOption(actionSel, "sleep", "SLEEP — 잠 (네발)");
addOption(actionSel, "walk", "WALK — 걷기 (집↔밖 왕복)");
// 몸 행위 — 두발·네발 공통 (강제하면 쉬었다 반복)
for (const [name, def] of Object.entries(BODY_ACTIONS)) addOption(actionSel, name, `${name.toUpperCase()} — ${def.label} (몸)`);
// 네발 행위 — 고양이·개에게만 먹는다 (두발은 idle)
for (const [name, def] of Object.entries(QUAD_ACTIONS)) addOption(actionSel, name, `${name.toUpperCase()} — ${def.label} (네발)`);
actionSel.addEventListener("change", () => scene.setAction(actionSel.value || null));

bindSeg(document.getElementById("speciesSeg"), "species", (value) => {
  only = value === "all" ? null : value;
  render();
});

// 단축키 — R 시드 · B 포즈 · I 잉크 · S 재생성. 버튼과 같은 경로(set)를 탄다
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "r") reseed();
  if (key === "b") pose.set(pose.value() === "bind" ? "motion" : "bind");
  if (key === "i") ink.set(ink.value() === "boil" ? "still" : "boil");
  if (key === "s") live.set(live.value() === "on" ? "off" : "on");
});

window.addEventListener("resize", () => scene.resize());

render();
scene.resize();

runLoop((t) => {
  scene.resize();
  scene.update(t);
}, () => { statusLabel.textContent = "ERROR"; });
