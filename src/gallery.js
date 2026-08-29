// Parts gallery — draws every value of one slot on the same individual, side by side. Species and seed are held fixed; only the slot value changes.
// Where census is distribution (numbers), this is form (the picture). Used to judge a single part.
// It also draws values a species forbids, which never appear on a real board — this is a catalog, not a draw.
//   gallery.html?slot=legs&species=human&seed=0z0y9qe&fix=legLength:short
// fix= pins one other slot — for combinations like "every leg type on short legs".

import * as THREE from "three";
import { createScene, CELL_W, CELL_H } from "./scene/index.js";
import { makeCreature, SLOTS, SPECIES, ghostPalette, ghostOutline } from "./character/index.js";
import { formatSeed } from "./rng.js";
import { bindSeg, addOption, randomSeed, runLoop } from "./ui.js";

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
let seed = params.get("seed") ? parseInt(params.get("seed"), 36) >>> 0 : randomSeed();
let bind = true;
// values=a,b — only the values of that slot to look at (for putting a few up large). Values not in the slot are ignored; if none is left, all of them
const only = (params.get("values") || "").split(",").filter(Boolean);
// One pinned slot { slot, value } — fix=slot:value in the URL
let fix = (() => {
  const [slotName, value] = (params.get("fix") || "").split(":");
  return SLOTS[slotName] && SLOTS[slotName].includes(value) ? { slot: slotName, value } : null;
})();

// The FIX dropdowns. Pick a slot and its value list appears. "—" means nothing pinned.
function fillFixSelects() {
  fixSlotSel.innerHTML = "";
  addOption(fixSlotSel, "", "—");
  for (const name of Object.keys(SLOTS)) if (name !== slot) addOption(fixSlotSel, name, name);
  fixSlotSel.value = fix ? fix.slot : "";
  fixValueSel.innerHTML = "";
  fixValueSel.disabled = !fix;
  if (fix) {
    for (const value of SLOTS[fix.slot]) addOption(fixValueSel, value, value);
    fixValueSel.value = fix.value;
  }
}

for (const name of Object.keys(SLOTS)) addOption(slotSel, name, `${name} (${SLOTS[name].length})`);
for (const s of SPECIES) addOption(speciesSel, s.name, s.name.toUpperCase());

const scene = createScene(canvas);
let cells = [];   // [{ x, y, value }] in world coordinates — labels are projected onto them

function build() {
  slotSel.value = slot;
  speciesSel.value = species;
  seedLabel.textContent = formatSeed(seed);
  if (fix && fix.slot === slot) fix = null;   // the slot being looked at cannot be pinned
  fillFixSelects();
  const fixed = fix ? { [fix.slot]: fix.value } : {};
  const picked = SLOTS[slot].filter((value) => only.includes(value));
  const values = picked.length ? picked : SLOTS[slot];
  window.history.replaceState(null, "", `?slot=${slot}&species=${species}&seed=${seed.toString(36)}${fix ? `&fix=${fix.slot}:${fix.value}` : ""}${picked.length ? `&values=${picked.join(",")}` : ""}`);

  const base = makeCreature(seed, species);
  // Swapping a part is enough for every slot but one: `ghost` collapses the whole palette and breaks every
  // line, and those are decided when the spec is built. Re-derive them from the pre-ghost palette the spec
  // carries, or the row would draw three identical creatures in whatever the base individual happened to be
  const specs = values.map((value) => {
    const parts = { ...base.parts, ...fixed, [slot]: value };
    return {
      ...base, parts,
      palette: ghostPalette(base.palette0 || base.palette, parts.ghost, base.proportions.wobbleSeed),
      outline: ghostOutline(parts.ghost)
    };
  });
  // Column count follows the canvas aspect — laid out in a single row the individuals come out too small
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

// Labels under the cells. Positioned by camera projection — they follow when the window resizes.
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
document.getElementById("reseed").addEventListener("click", () => { seed = randomSeed(); build(); });
fixSlotSel.addEventListener("change", () => {
  const name = fixSlotSel.value;
  fix = name ? { slot: name, value: SLOTS[name][0] } : null;
  build();
});
fixValueSel.addEventListener("change", () => { if (fix) { fix = { slot: fix.slot, value: fixValueSel.value }; build(); } });
const pose = bindSeg(poseSeg, "pose", (value) => {
  bind = value === "bind";
  scene.setBind(bind);
});
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "r") document.getElementById("reseed").click();
  if (key === "b") pose.set(bind ? "motion" : "bind");
});
window.addEventListener("resize", () => scene.resize());

build();
scene.resize();

runLoop((t) => {
  scene.resize();
  scene.update(t);
  placeLabels();
}, () => { statusLabel.textContent = "ERROR"; });
