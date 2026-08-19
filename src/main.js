// 진입점. 시드를 정하고, 그리드를 굽고, 시계를 돌린다.

import { createScene } from "./scene/index.js";
import { makeGrid } from "./character/index.js";
import { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS } from "./motion/index.js";
import { formatSeed, seedFromString } from "./rng.js";
import { addOption, randomSeed, runLoop } from "./ui.js";
import { createControls } from "./control.js";
import { exportPng } from "./export.js";

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
// 부팅 중에는 굽지 않는다 — 주소의 값을 컨트롤에 다 넣고 맨 끝에서 한 번만 굽는다 (안 그러면 9×6을 세 번 굽는다)
let booted = false;

function readSeedFromHash() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return null;
  const parsed = parseInt(raw, 36);
  return Number.isFinite(parsed) ? parsed >>> 0 : seedFromString(raw);
}

function render() {
  if (!booted) return;
  // 라벨부터 갱신한다. 빌드가 어떤 이유로든 실패해도 클릭이 접수됐다는
  // 사실은 화면에 보여야 한다.
  seedLabel.textContent = formatSeed(seed);
  syncUrl();
  const specs = makeGrid(seed, columns * rows, columns, only);
  scene.build(specs, columns);
  statusLabel.textContent = `${specs.length} ALIVE`;
}

// 디버그 URL — 지금 화면을 주소에 싣는다. 컨트롤은 쿼리(control.js가 만든다), 시드는 예전대로 해시다.
// 버튼으로 만든 화면을 그대로 주소로 옮길 수 있고, 그 주소로 들어오면 같은 화면이 선다:
//   ?grid=1x1&species=cat&pose=bind&ink=still&action=wave#01dkuwa
function syncUrl() {
  if (!booted) return;
  const search = controls.query();
  window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}#${seed.toString(36)}`);
}

function reseed() {
  seed = randomSeed();
  render();
}

document.getElementById("reseed").addEventListener("click", reseed);

// PNG 내보내기 — 지금 화면 그대로에 서명만 얹는다 (왼쪽 밑 시드, 오른쪽 밑 이름).
// scene.draw()를 먼저 부르고 **같은 태스크에서** 읽는다 — WebGL 그리기 버퍼는 프레임이 끝나면 비워진다 (src/export.js)
const exportButton = document.getElementById("exportPng");
if (exportButton) {
  exportButton.addEventListener("click", () => {
    const label = formatSeed(seed);
    scene.draw();
    exportPng(canvas, { seed: label, mark: "MENAGERIE", name: `menagerie-${label}.png` });
  });
}

// 행위 강제. AUTO는 각자 시계의 예약대로(idle + 이따금 행위, 층끼리 겹침), IDLE은 모든 층 idle,
// 행위를 고르면 그 층만 강제하고 다른 층은 idle (팔 행위는 사람·도깨비, 네발 행위는 고양이·개, 몸 행위는 전원).
// 행위 하나(인사·경례·점프·긁기…)가 어떻게 보이는지 판단할 때 쓴다.
// 목록은 컨트롤러보다 **먼저** 채운다 — 주소에서 온 값을 넣을 때 옵션에 있는지 본다 (ui.js bindSelect).
// 메인 화면에는 이 카드가 없다 (디버그 화면만) — 없으면 그냥 안 채운다.
const actionSel = document.getElementById("actionSel");
if (actionSel) {
  addOption(actionSel, "idle", "IDLE — 행위 없음");
  for (const [name, def] of Object.entries(ACTIONS)) addOption(actionSel, name, `${name.toUpperCase()} — ${def.label}`);
  // 기본 상태 — SLEEP은 네발을 엎드려 재운다 (사람·도깨비는 잠 자세가 없어 idle), WALK는 걷기 (전 종족, 팔 행위는 예약대로)
  addOption(actionSel, "sleep", "SLEEP — 잠 (네발)");
  addOption(actionSel, "sit", "SIT — 앉기 (네발)");
  addOption(actionSel, "walk", "WALK — 걷기 (집↔밖 왕복)");
  // 몸 행위 — 두발·네발 공통 (강제하면 쉬었다 반복)
  for (const [name, def] of Object.entries(BODY_ACTIONS)) addOption(actionSel, name, `${name.toUpperCase()} — ${def.label} (몸)`);
  // 네발 행위 — 고양이·개에게만 먹는다 (두발은 idle)
  for (const [name, def] of Object.entries(QUAD_ACTIONS)) addOption(actionSel, name, `${name.toUpperCase()} — ${def.label} (네발)`);
}

// 화면 컨트롤 — 값·주소·그 값으로 하는 일이 이 표 하나다 (control.js). 버튼에는 기능이 없다.
// initial은 HTML에서 `.on`이 붙어 있는 버튼(ACTION은 첫 옵션)과 같아야 한다.
const controls = createControls({
  // 그리드. 1×1은 한 마리를 화면에 꽉 채운다 — 파츠 하나를 눈으로 볼 때
  grid: {
    el: document.getElementById("countSeg"), initial: "7x5", rebuild: true,
    apply: (value) => { [columns, rows] = value.split("x").map(Number); }
  },
  // 포즈. MOTION은 시계가 리그를 움직이고, BIND는 리그를 바인드 포즈에 고정한다.
  pose: {
    el: document.getElementById("poseSeg"), initial: "motion",
    apply: (value) => scene.setBind(value === "bind")
  },
  // 잉크. BOIL은 선이 끓고(보일 3벌 순환), STILL은 0번 프레임 고정. 포즈와 별개 축.
  ink: {
    el: document.getElementById("inkSeg"), initial: "boil",
    apply: (value) => scene.setBoil(value === "boil")
  },
  // 재생성. 기본은 STILL — 형태는 NEW SEED를 눌러야만 바뀐다.
  // LIVE를 켜면 레퍼런스 영상처럼 슬롯이 각자의 시계로 교체된다.
  live: {
    el: document.getElementById("liveSeg"), initial: "off",
    apply: (value) => scene.setRegen(value === "on")
  },
  // 종족 프리뷰. ALL은 고정 레인, 나머지는 그 종족만 — 색·파츠 분포를 판단할 때
  species: {
    el: document.getElementById("speciesSeg"), initial: "all", rebuild: true,
    apply: (value) => { only = value === "all" ? null : value; }
  },
  action: {
    el: actionSel, kind: "select", initial: "",
    apply: (value) => scene.setAction(value || null)
  }
}, (def) => (def.rebuild ? render() : syncUrl()));

// 단축키 — R 시드 · B 포즈 · I 잉크 · S 재생성. 버튼과 같은 경로(set)를 탄다
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "r") reseed();
  if (key === "b") controls.set("pose", controls.value("pose") === "bind" ? "motion" : "bind");
  if (key === "i") controls.set("ink", controls.value("ink") === "boil" ? "still" : "boil");
  if (key === "s") controls.set("live", controls.value("live") === "on" ? "off" : "on");
});

// 주소창에 시드 해시를 붙여 넣는 경우. 같은 문서 안의 해시 변경은 리로드가 없어서 이걸 안 걸면
// 주소만 바뀌고 판은 그대로다. syncUrl이 쓴 해시로도 불리므로 값이 같으면 넘어간다
window.addEventListener("hashchange", () => {
  const fromHash = readSeedFromHash();
  if (fromHash === null || fromHash === seed) return;
  seed = fromHash;
  render();
});

window.addEventListener("resize", () => scene.resize());

// 주소의 값을 화면에 넣고 나서 한 번 굽는다
controls.read(new URLSearchParams(window.location.search));
booted = true;
render();
scene.resize();

runLoop((t) => {
  scene.resize();
  scene.update(t);
}, () => { statusLabel.textContent = "ERROR"; });
