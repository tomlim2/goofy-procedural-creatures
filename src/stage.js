// The stage — the cast stood up in a room (scene/stage.js). The same cast as the board (boardCells → makeBoard: the
// lanes, a species preview, the same grid sizes), rolled on load and NEW rolls another; the address carries the
// controls and never the cast (guidelines/determinism.md). The camera is the hand's: drag to go round, wheel or a
// pinch to come nearer, HOME to stand back where the page opened.

import { createStage } from "./scene/stage.js";
import { boardCells, makeBoard } from "./character/index.js";
import { randomRoll, runLoop } from "./ui.js";
import { createControls } from "./control.js";
import { exportPng } from "./export.js";

const canvas = document.getElementById("stage");
const statusLabel = document.getElementById("status");

// The high five's schedule, as on the board: ?five=rush divides the waits by 60 (main.js)
const hifiveRush = new URLSearchParams(window.location.search).get("five") === "rush" ? 60 : 1;
const stage = createStage(canvas, { hifiveRush });
window.menagerie = { scene: stage };

let columns = 7;
let rows = 5;
let only = null;
let baseRoll = randomRoll();
let booted = false;

function render() {
  if (!booted) return;
  const cast = makeBoard(boardCells(baseRoll, columns * rows, columns, only));
  syncUrl();
  stage.build(cast, columns);
  statusLabel.textContent = `${cast.length} ALIVE`;
}

function syncUrl() {
  const query = controls.query();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

function reroll() {
  baseRoll = randomRoll();
  render();
}

document.getElementById("reroll").addEventListener("click", reroll);
document.getElementById("home").addEventListener("click", () => stage.home());

const exportButton = document.getElementById("exportPng");
if (exportButton) {
  exportButton.addEventListener("click", () => {
    stage.draw();   // read in the same task as the redraw (src/export.js)
    exportPng(canvas, { mark: "MENAGERIE", name: "stage.png" });
  });
}

// The camera by hand. One pointer drags the camera round (and up and down); two pinch it nearer or further; the
// wheel does the same. Pointer events, so a finger and a mouse are one path
const DRAG = 0.0065;   // radians per pixel
const WHEEL = 0.0012;  // the zoom per wheel unit — exp'd, so a wheel forward and back lands where it started
const pointers = new Map();   // pointerId → [x, y] where it was last seen
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
canvas.addEventListener("pointerdown", (event) => {
  pointers.set(event.pointerId, [event.clientX, event.clientY]);
  canvas.setPointerCapture(event.pointerId);
  document.body.classList.add("dragging");
});
canvas.addEventListener("pointermove", (event) => {
  const was = pointers.get(event.pointerId);
  if (!was) return;
  const now = [event.clientX, event.clientY];
  if (pointers.size === 1) stage.turn(-(now[0] - was[0]) * DRAG, (now[1] - was[1]) * DRAG);
  else if (pointers.size === 2) {
    const other = [...pointers].find(([id]) => id !== event.pointerId)[1];
    const before = distance(was, other);
    const after = distance(now, other);
    if (before > 0 && after > 0) stage.zoom(before / after);   // fingers apart → nearer
  }
  pointers.set(event.pointerId, now);
});
const release = (event) => {
  pointers.delete(event.pointerId);
  if (!pointers.size) document.body.classList.remove("dragging");
};
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  stage.zoom(Math.exp(event.deltaY * WHEEL));
}, { passive: false });

// Screen controls — value, address and what that value does in one table (control.js), as on the board
const controls = createControls({
  grid: {
    el: document.getElementById("countSeg"), initial: "7x5", rebuild: true,
    apply: (value) => { [columns, rows] = value.split("x").map(Number); }
  },
  species: {
    el: document.getElementById("speciesSeg"), initial: "all", rebuild: true,
    apply: (value) => { only = value === "all" ? null : value; }
  },
  // FACE — CAMERA turns every card to the camera's bearing; FRONT leaves them stood facing the front, paper standees
  // seen edge-on from the side
  face: {
    el: document.getElementById("faceSeg"), initial: "camera",
    apply: (value) => stage.setFacing(value)
  },
  // DANCE — the Dumb Ways to Die chorus: every biped dances it on the same beat (motion/actions.js DANCE); the quads
  // stand through it. A forced base state, so a running high five is let go and the walks stop where they are
  dance: {
    el: document.getElementById("danceSeg"), initial: "off",
    apply: (value) => stage.setAction(value === "on" ? "dance" : null)
  }
}, (def) => { if (def.rebuild) render(); else syncUrl(); });

// Shortcuts — R new cast · H home · D dance
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const key = event.key.toLowerCase();
  if (key === "r") reroll();
  if (key === "h") stage.home();
  if (key === "d") controls.set("dance", controls.value("dance") === "on" ? "off" : "on");
});

window.addEventListener("resize", () => stage.resize());

controls.read(new URLSearchParams(window.location.search));
booted = true;
render();
stage.resize();

runLoop(
  (t) => { stage.resize(); stage.update(t); },
  () => { statusLabel.textContent = "ERROR"; },
  // Between ticks: the camera moved by hand → the last tick's pose is drawn again from the new place. Nothing updates
  () => { stage.resize(); if (stage.moved()) stage.draw(); }
);
