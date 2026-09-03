// Entry point. Settles the seed, bakes the grid, runs the clock.

import * as THREE from "three";
import { createScene, CELL_W, CELL_H } from "./scene/index.js";
import { boardCells, makeBoard } from "./character/index.js";
import { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS } from "./motion/index.js";
import { formatSeed, seedFromString } from "./rng.js";
import { addOption, randomSeed, runLoop } from "./ui.js";
import { createControls } from "./control.js";
import { exportPng } from "./export.js";

const canvas = document.getElementById("stage");
const seedLabel = document.getElementById("seed");
const statusLabel = document.getElementById("status");
const cellLabel = document.getElementById("cell");
const editLink = document.getElementById("edit");
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
// **The base seed only fills cells.** It names a starting character for each one and has no other say — a
// character is its own seed's, so the same seed draws the same creature wherever it sits (determinism.md).
let baseSeed = readSeedFromHash() ?? randomSeed();
// Cells the user has taken over, by index: { seed, species }. Everything else comes from the base seed.
const overrides = new Map();
let cells = [];
let selected = 0;
// Nothing is baked while booting — every value from the address goes into the controls and one bake happens at the very end (otherwise a 9×6 gets baked three times)
let booted = false;

// The hand-cast cells from the address — index:seed, the form syncUrl writes.
function readCastFromQuery() {
  const raw = new URLSearchParams(window.location.search).get("cells");
  if (!raw) return;
  for (const entry of raw.split(",")) {
    const [index, seed] = entry.split(":");
    const at = Number(index);
    const parsed = parseInt(seed, 36);
    if (Number.isInteger(at) && at >= 0 && Number.isFinite(parsed)) overrides.set(at, { seed: parsed >>> 0, species: null });
  }
}

function readSeedFromHash() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return null;
  const parsed = parseInt(raw, 36);
  return Number.isFinite(parsed) ? parsed >>> 0 : seedFromString(raw);
}

// The species preview is a judging mode — one species standing 54 to a board — so a cell somebody took over
// would spoil exactly the count it exists to show. It draws the plain lanes.
function currentCells() {
  const next = boardCells(baseSeed, columns * rows, columns, only);
  if (only !== null) return next;
  for (const [index, cell] of overrides) {
    if (index >= next.length) continue;
    // A cast entry read from the address carries no species — it stands in whatever lane it landed in.
    next[index] = { ...cell, species: cell.species ?? next[index].species };
  }
  return next;
}

function render() {
  if (!booted) return;
  cells = currentCells();
  if (selected >= cells.length) selected = 0;
  // The label updates first. Whatever reason a build fails for, the fact that
  // the click was registered has to show on screen.
  showSelected();
  syncUrl();
  scene.build(makeBoard(cells), columns);
  statusLabel.textContent = `${cells.length} ALIVE`;
}

function showSelected() {
  const cell = cells[selected];
  if (!cell) return;
  seedLabel.textContent = formatSeed(cell.seed);
  if (cellLabel) cellLabel.textContent = `${cell.species.toUpperCase()} · CELL ${selected}`;
  if (editLink) editLink.href = `./editor.html?seed=${cell.seed.toString(36)}&species=${cell.species}`;
}

// Debug URL — puts the current screen into the address. Controls go in the query (control.js builds it); the seed stays in the hash as before.
// A screen built with the buttons can be moved straight into an address, and entering by that address stands the same screen up:
//   ?grid=1x1&species=cat&pose=bind&ink=still&action=wave#01dkuwa
function syncUrl() {
  if (!booted) return;
  const search = controls.query();
  // The taken-over cells ride in the address as their own seeds — index:seed, the shortest thing that puts a
  // hand-cast board back up. A cell edited in the editor cannot be a seed at all, and is not written here.
  const cast = [...overrides.entries()].map(([index, cell]) => `${index}:${cell.seed.toString(36)}`).join(",");
  const query = [search, cast ? `cells=${cast}` : ""].filter(Boolean).join("&");
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}#${baseSeed.toString(36)}`);
}

// A new board: a new base seed, and the hand-cast cells let go with it.
function reseed() {
  baseSeed = randomSeed();
  overrides.clear();
  render();
}

// One character, redrawn. Only this cell moves — that is the whole point of a character owning its seed, and
// it is why this swaps the one slot rather than calling render(): a full rebuild would discard every rig on
// the board, restart all 35 clocks from their birth and drop the high fives, which looks like the board
// blinking off and back on for a change to a single creature.
function recast() {
  const cell = cells[selected];
  if (!cell) return;
  const next = { seed: randomSeed(), species: cell.species };
  overrides.set(selected, next);
  cells[selected] = next;
  scene.replace(selected, makeBoard([next])[0]);
  showSelected();
  syncUrl();
}

document.getElementById("reseed").addEventListener("click", reseed);
const recastButton = document.getElementById("recast");
if (recastButton) recastButton.addEventListener("click", recast);

// Picking a character. Every cell centre is projected to the screen and the nearest one to the click wins —
// the same projection the parts gallery puts its labels with, and it needs no raycast into the rig.
canvas.addEventListener("pointerdown", (event) => {
  if (!cells.length) return;
  const box = canvas.getBoundingClientRect();
  const rows = Math.ceil(cells.length / columns);
  const width = columns * CELL_W;
  const height = rows * CELL_H;
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < cells.length; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    pick.set(-width / 2 + CELL_W * (col + 0.5), height / 2 - CELL_H * (row + 0.5), 0).project(scene.camera);
    const x = (pick.x * 0.5 + 0.5) * box.width;
    const y = (-pick.y * 0.5 + 0.5) * box.height;
    const distance = Math.hypot(x - (event.clientX - box.left), y - (event.clientY - box.top));
    if (distance < bestDistance) { bestDistance = distance; best = i; }
  }
  if (best >= 0) { selected = best; showSelected(); }
});

// PNG export — the screen exactly as it is, with only a signature laid on top (seed bottom-left, name bottom-right).
// scene.draw() is called first and the read happens **in the same task** — WebGL clears the drawing buffer at the end of a frame (src/export.js)
const exportButton = document.getElementById("exportPng");
if (exportButton) {
  exportButton.addEventListener("click", () => {
    // A board is a cast now, so the signature names the base seed it was grown from — and says so when cells
    // have been taken over, because that base seed alone no longer stands this board back up.
    const label = formatSeed(baseSeed) + (overrides.size ? " +CAST" : "");
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
  // Grid. 1×1 fills the screen with one creature — for looking at a single part with your eyes
  grid: {
    el: document.getElementById("countSeg"), initial: "7x5", rebuild: true,
    apply: (value) => { [columns, rows] = value.split("x").map(Number); }
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
  // Species preview. ALL is the fixed lanes, the rest are that species only — for judging color and part distribution
  species: {
    el: document.getElementById("speciesSeg"), initial: "all", rebuild: true,
    apply: (value) => { only = value === "all" ? null : value; }
  },
  action: {
    el: actionSel, kind: "select", initial: "",
    apply: (value) => scene.setAction(value || null)
  }
}, (def) => { if (def.rebuild) render(); else syncUrl(); showJudging(); });

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
  overrides.clear();
  render();
});

window.addEventListener("resize", () => scene.resize());

// Puts the address's values into the screen, then bakes once
controls.read(new URLSearchParams(window.location.search));
readCastFromQuery();
showJudging();
booted = true;
render();
scene.resize();

runLoop((t) => {
  scene.resize();
  scene.update(t);
}, () => { statusLabel.textContent = "ERROR"; });
