// Entry point. Settles the seed, bakes the grid, runs the clock.

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
// Debug handle — inspect individual rigs from the console with window.menagerie.scene.creatures()
window.menagerie = { scene };

let columns = 7;
let rows = 5;
// Species preview. null means the fixed lanes; a species name means that species only.
let only = null;
let seed = readSeedFromHash() ?? randomSeed();
// Nothing is baked while booting — every value from the address goes into the controls and one bake happens at the very end (otherwise a 9×6 gets baked three times)
let booted = false;

function readSeedFromHash() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return null;
  const parsed = parseInt(raw, 36);
  return Number.isFinite(parsed) ? parsed >>> 0 : seedFromString(raw);
}

function render() {
  if (!booted) return;
  // The label updates first. Whatever reason a build fails for, the fact that
  // the click was registered has to show on screen.
  seedLabel.textContent = formatSeed(seed);
  syncUrl();
  const specs = makeGrid(seed, columns * rows, columns, only);
  scene.build(specs, columns);
  statusLabel.textContent = `${specs.length} ALIVE`;
}

// Debug URL — puts the current screen into the address. Controls go in the query (control.js builds it); the seed stays in the hash as before.
// A screen built with the buttons can be moved straight into an address, and entering by that address stands the same screen up:
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

// PNG export — the screen exactly as it is, with only a signature laid on top (seed bottom-left, name bottom-right).
// scene.draw() is called first and the read happens **in the same task** — WebGL clears the drawing buffer at the end of a frame (src/export.js)
const exportButton = document.getElementById("exportPng");
if (exportButton) {
  exportButton.addEventListener("click", () => {
    const label = formatSeed(seed);
    scene.draw();
    exportPng(canvas, { seed: label, mark: "MENAGERIE", name: `menagerie-${label}.png` });
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
}, (def) => (def.rebuild ? render() : syncUrl()));

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
  if (fromHash === null || fromHash === seed) return;
  seed = fromHash;
  render();
});

window.addEventListener("resize", () => scene.resize());

// Puts the address's values into the screen, then bakes once
controls.read(new URLSearchParams(window.location.search));
booted = true;
render();
scene.resize();

runLoop((t) => {
  scene.resize();
  scene.update(t);
}, () => { statusLabel.textContent = "ERROR"; });
