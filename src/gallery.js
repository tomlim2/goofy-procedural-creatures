// 파츠 갤러리 — 슬롯 하나의 모든 값을 같은 개체에 나란히 그린다. 종족·시드는 고정, 슬롯값만 바꾼다.
// census가 분포(숫자)라면 이건 형태(그림)다. 파츠 하나를 판단할 때 쓴다.
// 종족 forbid로 실제 판에는 안 나오는 값도 그린다 — 여긴 카탈로그지 추첨이 아니다.
//   gallery.html?slot=legs&species=human&seed=0z0y9qe&fix=legLength:short
// fix= 는 다른 슬롯 하나를 고정한다 — "짧은 다리에서 다리 유형 전부" 같은 조합을 볼 때.

import * as THREE from "three";
import { createScene } from "./scene/index.js";
import { makeCreature, SLOTS, SPECIES } from "./character/index.js";
import { formatSeed } from "./rng.js";

const CELL_W = 1.0;    // scene/index.js와 같은 셀 크기 (라벨 위치 계산용)
const CELL_H = 1.35;

const canvas = document.getElementById("stage");
const labelsBox = document.getElementById("labels");
const slotSel = document.getElementById("slotSel");
const speciesSel = document.getElementById("speciesSel");
const seedLabel = document.getElementById("seed");
const poseSeg = document.getElementById("poseSeg");
const statusLabel = document.getElementById("status");
const fixSlotSel = document.getElementById("fixSlot");
const fixValueSel = document.getElementById("fixValue");

const params = new URLSearchParams(window.location.search);
let slot = SLOTS[params.get("slot")] ? params.get("slot") : "legs";
let species = SPECIES.some((s) => s.name === params.get("species")) ? params.get("species") : "human";
let seed = params.get("seed") ? parseInt(params.get("seed"), 36) >>> 0 : (Math.random() * 0xffffffff) >>> 0;
let bind = true;
// 고정 슬롯 하나 { slot, value } — URL의 fix=slot:value
let fix = (() => {
  const [slotName, value] = (params.get("fix") || "").split(":");
  return SLOTS[slotName] && SLOTS[slotName].includes(value) ? { slot: slotName, value } : null;
})();

// FIX 드롭다운. 슬롯을 고르면 그 슬롯의 값 목록이 뜬다. "—"는 고정 없음.
function fillFixSelects() {
  fixSlotSel.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "—";
  fixSlotSel.appendChild(none);
  for (const name of Object.keys(SLOTS)) {
    if (name === slot) continue;
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    fixSlotSel.appendChild(option);
  }
  fixSlotSel.value = fix ? fix.slot : "";
  fixValueSel.innerHTML = "";
  fixValueSel.disabled = !fix;
  if (fix) {
    for (const value of SLOTS[fix.slot]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      fixValueSel.appendChild(option);
    }
    fixValueSel.value = fix.value;
  }
}

for (const name of Object.keys(SLOTS)) {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = `${name} (${SLOTS[name].length})`;
  slotSel.appendChild(option);
}
for (const s of SPECIES) {
  const option = document.createElement("option");
  option.value = s.name;
  option.textContent = s.name.toUpperCase();
  speciesSel.appendChild(option);
}

const scene = createScene(canvas);
let cells = [];   // [{ x, y, value }] 월드 좌표 — 라벨을 투영해 붙인다

function build() {
  slotSel.value = slot;
  speciesSel.value = species;
  seedLabel.textContent = formatSeed(seed);
  if (fix && fix.slot === slot) fix = null;   // 보고 있는 슬롯은 고정할 수 없다
  fillFixSelects();
  const fixed = fix ? { [fix.slot]: fix.value } : {};
  window.history.replaceState(null, "", `?slot=${slot}&species=${species}&seed=${seed.toString(36)}${fix ? `&fix=${fix.slot}:${fix.value}` : ""}`);

  const base = makeCreature(seed, species);
  const values = SLOTS[slot];
  const specs = values.map((value) => ({ ...base, parts: { ...base.parts, ...fixed, [slot]: value } }));
  // 열 수는 캔버스 비율에 맞춘다 — 한 줄로 늘어놓으면 개체가 너무 작다
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const cols = Math.max(1, Math.min(values.length, Math.round(Math.sqrt(values.length * aspect * (CELL_H / CELL_W)))));
  const rows = Math.ceil(values.length / cols);
  scene.build(specs, cols);
  scene.setBind(bind);

  const width = cols * CELL_W;
  const height = rows * CELL_H;
  cells = values.map((value, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return { value, x: -width / 2 + CELL_W * (col + 0.5), y: height / 2 - CELL_H * (row + 1) + 0.16 - 0.12 };
  });
  labelsBox.innerHTML = "";
  for (const cell of cells) {
    const el = document.createElement("span");
    el.textContent = cell.value;
    labelsBox.appendChild(el);
  }
  statusLabel.textContent = `${species.toUpperCase()} · ${slot} × ${values.length}`;
}

// 셀 밑에 라벨. 카메라 투영으로 위치를 잡는다 — 창 크기가 바뀌어도 따라간다.
const v = new THREE.Vector3();
function placeLabels() {
  const spans = labelsBox.children;
  for (let i = 0; i < cells.length; i += 1) {
    v.set(cells[i].x, cells[i].y, 0).project(scene.camera);
    spans[i].style.left = `${(v.x * 0.5 + 0.5) * canvas.clientWidth}px`;
    spans[i].style.top = `${(-v.y * 0.5 + 0.5) * canvas.clientHeight}px`;
  }
}

slotSel.addEventListener("change", () => { slot = slotSel.value; build(); });
speciesSel.addEventListener("change", () => { species = speciesSel.value; build(); });
document.getElementById("reseed").addEventListener("click", () => { seed = (Math.random() * 0xffffffff) >>> 0; build(); });
fixSlotSel.addEventListener("change", () => {
  const name = fixSlotSel.value;
  fix = name ? { slot: name, value: SLOTS[name][0] } : null;
  build();
});
fixValueSel.addEventListener("change", () => { if (fix) { fix = { slot: fix.slot, value: fixValueSel.value }; build(); } });
poseSeg.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-pose]");
  if (!button) return;
  for (const node of poseSeg.querySelectorAll("button")) node.classList.remove("on");
  button.classList.add("on");
  bind = button.dataset.pose === "bind";
  scene.setBind(bind);
});
window.addEventListener("keydown", (event) => {
  if (event.key === "r" || event.key === "R") document.getElementById("reseed").click();
  if (event.key === "b" || event.key === "B") poseSeg.querySelector(bind ? '[data-pose="motion"]' : '[data-pose="bind"]').click();
});
window.addEventListener("resize", () => scene.resize());

build();
scene.resize();

const start = performance.now();
function frame() {
  try {
    scene.resize();
    scene.update((performance.now() - start) / 1000);
    placeLabels();
  } catch (error) {
    statusLabel.textContent = "ERROR";
    console.error(error);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
