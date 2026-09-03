// Entry point. Stands a cast up, runs the clock.
//
// The board is a **cast** — one spec per cell — and the spec is the truth: it is what is drawn, what SAVE
// writes and what OPEN reads back. The base seed in the address only fills the cells; a seed is the
// generator's input, not a creature's name (guidelines/determinism.md). Whatever is done to a cell after
// that — REDRAW, BACK, a file opened into it — lives in the cast, and the address does not remember it. SAVE does.

import * as THREE from "three";
import { createScene, CELL_W, CELL_H } from "./scene/index.js";
import { boardCells, makeBoard, readCreature, readBoard, creatureJson, boardJson } from "./character/index.js";
import { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS } from "./motion/index.js";
import { formatSeed, seedFromString } from "./rng.js";
import { addOption, randomSeed, runLoop, download } from "./ui.js";
import { createControls } from "./control.js";
import { exportPng } from "./export.js";

const canvas = document.getElementById("stage");
const statusLabel = document.getElementById("status");
const pin = document.getElementById("pin");
const backButton = document.getElementById("back");
const cellFile = document.getElementById("cellFile");
const boardFile = document.getElementById("boardFile");
const pick = new THREE.Vector3();

// The high five's schedule. RUSH divides its two waits by 60 — a board's first five lands within a second or
// two instead of within five minutes, and the pairs keep going. **Only the waiting is shortened**: the pair
// logic, the hurry over, the wind-up and the slap are the board's own, so what you watch is the real thing.
// It is read here rather than through the control table because the scene is built with it (a five's schedule
// belongs to makeHifives), so switching it re-reads the address and reloads.
const hifiveRush = new URLSearchParams(window.location.search).get("five") === "rush" ? 60 : 1;
const scene = createScene(canvas, { hifiveRush });
// Debug handle — inspect individual rigs from the console with window.menagerie.scene.creatures()
window.menagerie = { scene };

let columns = 7;
let rows = 5;
// Species preview. null means the fixed lanes; a species name means that species only.
let only = null;
// **The base seed only fills cells.** It names a starting spec for each one and has no other say.
let baseSeed = readSeedFromHash() ?? randomSeed();
// The cast: one spec per cell. This is the board.
let cast = [];
// Cells a hand has touched — redrawn, walked back, opened from a file. A resize keeps these where they stand
// and fills the rest again from the base seed.
const held = new Set();
// What each touched cell was before, newest last — BACK walks a cell through them.
const history = new Map();
// What the next render owes the cast. "fill" grows a fresh cast from the base seed (a new board, a new
// species); "resize" keeps the held cells and fills the rest for the new size; null leaves it as it is.
let stale = "fill";
let selected = 0;
// A creature has been clicked. The pin at its feet only shows after that; a fresh board has nothing picked.
let picked = false;
// Nothing is baked while booting — every value from the address goes into the controls and one bake happens at the very end (otherwise a 9×6 gets baked three times)
let booted = false;
// Set while a board file is being opened: the grid and species buttons are moved to match the file, and their
// usual rebuild must not run, or it would fill a board over the one just read.
let quiet = false;

function readSeedFromHash() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return null;
  const parsed = parseInt(raw, 36);
  return Number.isFinite(parsed) ? parsed >>> 0 : seedFromString(raw);
}

// A fresh cast from the base seed: the fixed lanes, or — for the species preview, a judging mode — one
// species standing 54 to a board.
function fill(count) {
  return makeBoard(boardCells(baseSeed, count, columns, only));
}

// The same board at another size. A cell a hand has touched stays where it is; every other cell is filled
// again from the base seed, so the lanes come out right for the new width.
function resized(count) {
  const fresh = fill(count);
  return fresh.map((spec, i) => (held.has(i) && i < cast.length ? cast[i] : spec));
}

function render() {
  if (!booted) return;
  const count = columns * rows;
  if (stale === "fill") {
    cast = fill(count);
    held.clear();
    history.clear();
  } else if (stale === "resize" || cast.length !== count) {
    cast = resized(count);
    for (const i of [...held]) if (i >= count) { held.delete(i); history.delete(i); }
  }
  stale = null;
  if (selected >= cast.length) { selected = 0; picked = false; }
  syncUrl();
  scene.build(cast, columns);
  statusLabel.textContent = alive();
}

const alive = () => `${cast.length} ALIVE`;

// A word in the status label's place — why a file was refused, or that one was taken — gone again after a moment.
let noteTimer = null;
function note(message) {
  if (noteTimer) clearTimeout(noteTimer);
  statusLabel.textContent = message;
  noteTimer = setTimeout(() => { statusLabel.textContent = alive(); noteTimer = null; }, 1500);
}

// Debug URL — puts the current screen into the address. Controls go in the query (control.js builds it); the
// seed stays in the hash. A screen built with the buttons can be moved straight into an address, and entering
// by that address stands the same screen up:
//   ?grid=1x1&species=cat&pose=bind&ink=still&action=wave#01dkuwa
// The address makes a board; it does not remember one. A cell that was redrawn or opened from a file is not
// in it — that is what SAVE is for.
function syncUrl() {
  if (!booted) return;
  const query = controls.query();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}#${baseSeed.toString(36)}`);
}

// A new board: a new base seed, and the cast let go with it.
function reseed() {
  baseSeed = randomSeed();
  stale = "fill";
  picked = false;
  render();
}

// One creature, redrawn: a fresh roll of the same species in this cell. Only this cell moves — it swaps the one
// slot rather than calling render(), because a full rebuild would discard every rig on the board, restart all
// 35 clocks from their birth and drop the high fives, which looks like the board blinking off and back on for
// a change to a single creature.
function recast() {
  const cell = cast[selected];
  if (!cell) return;
  setCell(makeBoard([{ seed: randomSeed(), species: cell.species }])[0]);
}

// Puts one spec into the picked cell, remembering the one that stood there so BACK can return to it.
function setCell(spec) {
  const cell = cast[selected];
  if (!cell) return;
  if (!history.has(selected)) history.set(selected, []);
  history.get(selected).push(cell);
  held.add(selected);
  cast[selected] = spec;
  scene.replace(selected, spec);
  placePin();
}

// The cell's previous creature, one step back per press.
function back() {
  const past = history.get(selected);
  if (!past || !past.length) return;
  const previous = past.pop();
  cast[selected] = previous;
  scene.replace(selected, previous);
  placePin();
}

// A creature file into the picked cell — the way a creature made in the editor gets onto the board.
function openCell(text) {
  const read = readCreature(text);
  if (read.error) { note(read.error); return; }
  setCell(read.spec);
  note("OPENED");
}

// The picked creature as a file — the way one gets from the board into the editor.
function saveCell() {
  const cell = cast[selected];
  if (!cell) return;
  download(`${cell.species === "house" ? "house" : "creature"}-${formatSeed(cell.seed)}.json`, creatureJson(cell));
}

// The whole board as a file. Under LIVE regen the scene swaps individuals on its own clocks, so the cells are
// read off the scene rather than the cast — what is saved is what is standing there.
function saveBoard() {
  const standing = scene.creatures().map((item, i) => (item && item.spec) || cast[i]);
  download(`board-${formatSeed(baseSeed)}.json`, boardJson(columns, standing));
}

// A board file replaces the cast whole. Every cell counts as touched — a resize keeps them all — and the grid
// and species buttons are moved to match the file without their usual rebuild (quiet). A size the buttons do
// not offer leaves none of them lit (and the address carries no grid, control.js); the board still stands at
// the file's own width.
function openBoard(text) {
  const read = readBoard(text);
  if (read.error) { note(read.error); return; }
  quiet = true;
  columns = read.columns ?? columns;
  rows = Math.ceil(read.cells.length / columns);
  const size = `${columns}x${rows}`;
  controls.set("grid", size);
  if (controls.value("grid") !== size) for (const b of document.querySelectorAll("#countSeg button")) b.classList.remove("on");
  controls.set("species", "all");
  quiet = false;
  only = null;
  cast = read.cells;
  held.clear();
  history.clear();
  for (let i = 0; i < cast.length; i += 1) held.add(i);
  stale = null;
  picked = false;
  render();
  note("OPENED");
}

// The pin at the picked creature's feet. Projected every frame, like the gallery's labels.
function placePin() {
  if (!pin) return;
  if (!picked || !cast[selected]) { pin.hidden = true; return; }
  const rowCount = Math.ceil(cast.length / columns);
  const width = columns * CELL_W;
  const height = rowCount * CELL_H;
  const col = selected % columns;
  const row = Math.floor(selected / columns);
  // The ground line of the row sits at +0.16 above the cell's bottom edge; the pin hangs just under it.
  pick.set(-width / 2 + CELL_W * (col + 0.5), height / 2 - CELL_H * (row + 1) + 0.16 - 0.03, 0).project(scene.camera);
  const box = canvas.getBoundingClientRect();
  pin.style.left = `${box.left + (pick.x * 0.5 + 0.5) * box.width}px`;
  pin.style.top = `${box.top + (-pick.y * 0.5 + 0.5) * box.height}px`;
  pin.hidden = false;
  backButton.disabled = !(history.get(selected) && history.get(selected).length);
}

// A file input's one file, read as text and handed on; the input is cleared so the same file can be opened twice.
function onFile(input, take) {
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (file) file.text().then(take);
    input.value = "";
  });
}

document.getElementById("reseed").addEventListener("click", reseed);
document.getElementById("pinRedraw").addEventListener("click", recast);
backButton.addEventListener("click", back);
document.getElementById("pinOpen").addEventListener("click", () => cellFile.click());
document.getElementById("pinSave").addEventListener("click", saveCell);
onFile(cellFile, openCell);
document.getElementById("boardSave").addEventListener("click", saveBoard);
document.getElementById("boardOpen").addEventListener("click", () => boardFile.click());
onFile(boardFile, openBoard);

// Picking a character. Nothing is picked until a creature is clicked, and a click that lands on no creature
// lets the pick go. Each cell is projected to the screen — the same projection the parts gallery puts its
// labels with, no raycast into the rig — and the click has to fall inside the cell's own box, drawn a little
// tighter than the tile so the gap between two creatures counts as nowhere.
const HIT_W = 0.8;
const HIT_H = 0.9;
// The cell under a screen point, or -1 for nowhere.
function cellAt(clientX, clientY) {
  if (!cast.length) return -1;
  const box = canvas.getBoundingClientRect();
  const rowCount = Math.ceil(cast.length / columns);
  const width = columns * CELL_W;
  const height = rowCount * CELL_H;
  const toScreen = (x, y) => {
    pick.set(x, y, 0).project(scene.camera);
    return [(pick.x * 0.5 + 0.5) * box.width, (-pick.y * 0.5 + 0.5) * box.height];
  };
  const px = clientX - box.left;
  const py = clientY - box.top;
  for (let i = 0; i < cast.length; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const cx = -width / 2 + CELL_W * (col + 0.5);
    const cy = height / 2 - CELL_H * (row + 0.5);
    const [x0, y0] = toScreen(cx - CELL_W * HIT_W / 2, cy + CELL_H * HIT_H / 2);
    const [x1, y1] = toScreen(cx + CELL_W * HIT_W / 2, cy - CELL_H * HIT_H / 2);
    if (px >= x0 && px <= x1 && py >= y0 && py <= y1) return i;
  }
  return -1;
}
canvas.addEventListener("pointerdown", (event) => {
  const hit = cellAt(event.clientX, event.clientY);
  if (hit >= 0) { selected = hit; picked = true; }
  else picked = false;
  placePin();
});
// Hovering a creature draws an arrow under its feet, on the canvas (scene.setHover). The scene only redraws
// when the cell changes, so moving inside one cell costs nothing.
canvas.addEventListener("pointermove", (event) => {
  const hit = cellAt(event.clientX, event.clientY);
  scene.setHover(hit >= 0 ? hit : null);
});
canvas.addEventListener("pointerleave", () => scene.setHover(null));

// PNG export — the screen exactly as it is, with only a signature laid on top (seed bottom-left, name bottom-right).
// scene.draw() is called first and the read happens **in the same task** — WebGL clears the drawing buffer at the end of a frame (src/export.js)
const exportButton = document.getElementById("exportPng");
if (exportButton) {
  exportButton.addEventListener("click", () => {
    // The signature names the base seed the board was grown from — and says so when cells have been touched,
    // because that seed alone no longer stands this board back up.
    const label = formatSeed(baseSeed) + (held.size ? " +CAST" : "");
    scene.draw();
    exportPng(canvas, { seed: label, mark: "MENAGERIE", name: `menagerie-${formatSeed(baseSeed)}.png` });
  });
}

// Forcing an action. AUTO follows each creature's own schedule (idle plus the occasional action, layers overlapping), IDLE keeps every layer idle,
// and picking an action forces that layer only while the others idle (arm actions for humans and imps, quad actions for cats and dogs, body actions for everyone).
// Used to judge how one action (wave, salute, jump, scratch…) actually looks.
// The list is filled **before** the controller — putting a value in from the address checks it is an option (ui.js bindSelect).
// The main screen does not have this card (the debug screen only) — if it is missing, nothing is filled.
const actionSel = document.getElementById("actionSel");
if (actionSel) {
  addOption(actionSel, "idle", "IDLE — no action");
  for (const [name, def] of Object.entries(ACTIONS)) addOption(actionSel, name, `${name.toUpperCase()} — ${def.label}`);
  // Base states — SLEEP lies quads down to sleep (humans and imps have no sleep pose, so they idle), WALK is walking (every species, arm actions on schedule)
  addOption(actionSel, "sleep", "SLEEP — asleep (quad)");
  addOption(actionSel, "sit", "SIT — sitting (quad)");
  addOption(actionSel, "walk", "WALK — walking (out and back home)");
  // Body actions — shared by bipeds and quads (forced, they repeat with a rest between)
  for (const [name, def] of Object.entries(BODY_ACTIONS)) addOption(actionSel, name, `${name.toUpperCase()} — ${def.label} (body)`);
  // Quad actions — they only bite on cats and dogs (bipeds idle)
  for (const [name, def] of Object.entries(QUAD_ACTIONS)) addOption(actionSel, name, `${name.toUpperCase()} — ${def.label} (quad)`);
}

// HIGH FIVE — the one control that is not a scene switch: the schedule is settled when the scene is built, so
// this reloads with the value in the address rather than pretending to toggle live (the debug screen only)
const fiveSeg = document.getElementById("fiveSeg");
if (fiveSeg) {
  fiveSeg.querySelector(`button[data-five="${hifiveRush > 1 ? "rush" : "auto"}"]`).classList.add("on");
  for (const b of fiveSeg.querySelectorAll("button[data-five]")) {
    if ((b.dataset.five === "rush") === (hifiveRush > 1)) continue;
    b.classList.remove("on");
    b.addEventListener("click", () => {
      const params = new URLSearchParams(window.location.search);
      if (b.dataset.five === "rush") params.set("five", "rush"); else params.delete("five");
      window.location.search = params.toString();
    });
  }
}

// Screen controls — value, address and what that value does are this one table (control.js). The buttons carry no behaviour.
// initial has to match the button carrying `.on` in the HTML (for ACTION, the first option).
const controls = createControls({
  // Grid. 1×1 fills the screen with one creature — for looking at a single part with your eyes. The cells a
  // hand has touched stay; the rest are filled again for the new width.
  grid: {
    el: document.getElementById("countSeg"), initial: "7x5", rebuild: true,
    apply: (value) => { [columns, rows] = value.split("x").map(Number); if (stale !== "fill") stale = "resize"; }
  },
  // Pose. MOTION lets the clock move the rig; BIND pins the rig to the bind pose.
  pose: {
    el: document.getElementById("poseSeg"), initial: "motion",
    apply: (value) => scene.setBind(value === "bind")
  },
  // Ink. BOIL keeps the lines boiling (cycling 3 boil frames), STILL pins frame 0. A separate axis from pose.
  ink: {
    el: document.getElementById("inkSeg"), initial: "boil",
    apply: (value) => scene.setBoil(value === "boil")
  },
  // Regen. STILL by default — form changes only when NEW SEED is pressed.
  // Turn LIVE on and slots swap on their own clocks, like the reference video.
  live: {
    el: document.getElementById("liveSeg"), initial: "off",
    apply: (value) => scene.setRegen(value === "on")
  },
  // Species preview. ALL is the fixed lanes, the rest are that species only — for judging color and part
  // distribution. Either way it is a fresh cast from the base seed: a cell somebody took over would spoil
  // exactly the count the preview exists to show, so SAVE a board first if it is one to keep.
  species: {
    el: document.getElementById("speciesSeg"), initial: "all", rebuild: true,
    apply: (value) => { only = value === "all" ? null : value; stale = "fill"; }
  },
  action: {
    el: actionSel, kind: "select", initial: "",
    apply: (value) => scene.setAction(value || null)
  }
}, (def) => { if (quiet) return; if (def.rebuild) render(); else syncUrl(); showJudging(); });

// Folded, the JUDGING summary carries what is on — anything away from its default is named, so a screen left
// on BIND or on a forced action never looks like a bug
const judgeNow = document.getElementById("judgeNow");
function showJudging() {
  if (!judgeNow) return;
  const on = [];
  if (controls.value("pose") === "bind") on.push("BIND");
  if (controls.value("ink") === "still") on.push("STILL");
  if (controls.value("live") === "on") on.push("LIVE");
  if (hifiveRush > 1) on.push("RUSH");
  const action = controls.value("action");
  if (action) on.push(action.toUpperCase());
  judgeNow.textContent = on.length ? `· ${on.join(" · ")}` : "";
}

// Shortcuts — R seed · B pose · I ink · S regen. They go through the same path as the buttons (set)
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const key = event.key.toLowerCase();
  if (key === "r") reseed();
  if (key === "b") controls.set("pose", controls.value("pose") === "bind" ? "motion" : "bind");
  if (key === "i") controls.set("ink", controls.value("ink") === "boil" ? "still" : "boil");
  if (key === "s") controls.set("live", controls.value("live") === "on" ? "off" : "on");
});

// For pasting a seed hash into the address bar. A hash change within the same document does not reload, so without this
// only the address would move while the board stayed put. It is also called for the hash syncUrl wrote, so an identical value is skipped
window.addEventListener("hashchange", () => {
  const fromHash = readSeedFromHash();
  if (fromHash === null || fromHash === baseSeed) return;
  baseSeed = fromHash;
  stale = "fill";
  picked = false;
  render();
});

window.addEventListener("resize", () => scene.resize());

// Puts the address's values into the screen, then bakes once
controls.read(new URLSearchParams(window.location.search));
showJudging();
booted = true;
render();
scene.resize();

runLoop((t) => {
  scene.resize();
  scene.update(t);
  placePin();
}, () => { statusLabel.textContent = "ERROR"; });
