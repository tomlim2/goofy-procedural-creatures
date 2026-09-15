// The name screen — the front door (guidelines/name.md). A name, a species (ALL lets the name pick) and DRAW stand a creature up on a
// trading card; SAVE keeps the card, only the card, as it is seen. The address carries nothing and nothing is remembered: the name
// never leaves the page.
//
// The card is one WebGL canvas: the board's own scene at 1×1 — the paper, the creature, the sheet over them — with the card's frame
// and its words drawn into it in the pencil (the words in the goofy type, medium/type.js: any script, traced off Noto Sans), so they
// boil with the creature, lie under the same sheet, and SAVE is the same scene drawn again at a fixed size.

import * as THREE from "three";
import { createScene } from "./scene/index.js";
import { sketchMesh, disposeGroup } from "./scene/mesh.js";
import { BOIL_FRAMES, boilRate } from "./scene/rig.js";
import { Sketch } from "./stroke.js";
import { makeNoise, makeRng } from "./rng.js";
import { creatureOfName } from "./character/index.js";
import { loadType, traceType, typeWith } from "./medium/type.js";
import { CARD, CARD_SAVE, cardOf, layCard } from "./card.js";
import { savePng } from "./export.js";
import { runLoop } from "./ui.js";

const form = document.getElementById("controls");
const input = document.getElementById("name");
const speciesSelect = document.getElementById("species");
const saveButton = document.getElementById("save");
const face = document.getElementById("face");
const live = document.getElementById("live");

const scene = createScene(face);
window.menagerie = { scene };   // the debug handle every screen keeps

// The type's four faces, loaded now whatever is typed later (medium/type.js loadType)
const typeReady = loadType();

const BLANK_INK = "#2b2724";   // the frame of a card nobody has drawn yet — the page's own ink (styles.css --ink)
// What stands on the card now: { made, card, laid } — null until the first DRAW
let current = null;

// -- the frame and the words --
// The card's edge and the picture's window as closed pencil lines, and the card's words in the goofy type, in the scene's world.
// The world rectangle the card shows is the camera's, so they are laid from it and laid again whenever it moves (a resize). Three
// boil frames, one mesh each, flipped at the creature's own cadence (rig.js boilRate); a word's wiggle moves with the frame
const FRAME_ORDER = 1.2;   // over the paper and the floor line, under every creature (their blocks start at 10, scene/index.js)
const TYPE_HAND = 0.5;     // the wobble of the pencil round a letter — half the frame's, so a word a few ink widths tall still reads
const TYPE_WIGGLE = 0.035; // how far a letter's outline is pushed about, in ems
let frame = null;          // { group, boil, extents, ink, roll, laid }

function extents() {
  const camera = scene.camera;
  return [camera.right / camera.zoom, camera.top / camera.zoom];   // the camera is centred: its half-width and half-height in the world
}

// A rectangle with round corners, counter-clockwise from the top right: each corner a quarter circle in five points
function roundedRect(left, top, right, bottom, r) {
  const centres = [[right - r, top - r], [left + r, top - r], [left + r, bottom + r], [right - r, bottom + r]];
  const points = [];
  centres.forEach(([cx, cy], corner) => {
    for (let i = 0; i <= 4; i += 1) {
      const a = (corner + i / 4) * (Math.PI / 2);
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  });
  return points;
}

function layFrame(ink, roll, laid = null) {
  if (frame) {
    disposeGroup(frame.group);
    scene.scene.remove(frame.group);
  }
  const [hw, hh] = extents();
  const X = (fx) => -hw + fx * 2 * hw;
  const Y = (fy) => hh - fy * 2 * hh;
  const inset = CARD.inset * 2 * hw;
  const radius = CARD.corner * 2 * hw;
  const edge = roundedRect(-hw + inset, hh - inset, hw - inset, -hh + inset, radius);
  const picture = roundedRect(X(CARD.art.x0), Y(CARD.art.y0), X(CARD.art.x1), Y(CARD.art.y1), radius * 0.4);
  const noise = makeNoise(makeRng(roll + 1));
  const group = new THREE.Group();
  for (let k = 0; k < BOIL_FRAMES; k += 1) {
    const lines = new Sketch(noise, 1.2);
    lines.phase = k * 101.7;   // a different stretch of the noise per frame — that is the boil
    lines.contour(edge, { color: ink });
    lines.contour(picture, { color: ink });
    const type = new Sketch(noise, TYPE_HAND, 1);
    type.phase = k * 101.7 + 50;
    for (const word of laid || []) {
      typeWith(type, word.line, { x: X(word.x), y: Y(word.y), em: word.em * 2 * hw, color: word.color, wiggle: TYPE_WIGGLE, phase: k * 3.1 });
    }
    const mesh = sketchMesh([lines, type], 0.9, FRAME_ORDER);
    mesh.visible = k === 0;
    group.add(mesh);
  }
  scene.scene.add(group);
  frame = { group, boil: boilRate(roll), extents: [hw, hh], ink, roll, laid };
}

function boilFrame(t) {
  if (!frame) return;
  const shown = Math.floor(t * frame.boil.fps + frame.boil.offset) % BOIL_FRAMES;
  frame.group.children.forEach((mesh, k) => { mesh.visible = k === shown; });
}

// -- the card --
// The scene at 1×1 with the card's zoom — set after every build, as a build lays the camera out again
function stand(specs) {
  scene.build(specs, 1);
  scene.camera.zoom = CARD.zoom;
  scene.camera.updateProjectionMatrix();
}

// A DRAW waits for the type; a second DRAW pressed while it waits wins, and the first is let go
let drawing = 0;
async function draw() {
  const made = creatureOfName(input.value, speciesSelect.value);
  if (!made) {
    input.focus();
    return;
  }
  const mine = ++drawing;
  await typeReady;
  if (mine !== drawing) return;
  const card = cardOf(made);
  current = { made, card, laid: layCard(card, traceType) };
  stand([made.spec]);
  layFrame(card.ink, made.roll, current.laid);
  saveButton.hidden = false;
  const stars = `${card.stars} star${card.stars > 1 ? "s" : ""}`;
  live.textContent = `${card.name} — ${card.kind.toLowerCase()}, ♥ ${card.hearts}, ${stars}`;
}

// SAVE — the card as it is seen, drawn again at CARD_SAVE: the renderer is set to that size for one draw of the state already on
// the screen (the same tick, the same boil frame), read in that task (export.js), and set back
function save() {
  if (!current) return;
  const [width, height] = CARD_SAVE;
  const renderer = scene.renderer;
  const ratio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  scene.draw();
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  out.getContext("2d").drawImage(face, 0, 0, width, height);
  renderer.setPixelRatio(ratio);
  renderer.setSize(face.clientWidth, face.clientHeight, false);
  scene.draw();
  const fileName = current.card.name.replace(/[/\\:*?"<>|]/g, "_").replace(/\p{Cc}/gu, "") || "menagerie";
  savePng(out, `${fileName}.png`);
}

// -- the controls --
// Enter draws, but not the Enter that commits a syllable an input method is still composing — Safari sends that one with
// isComposing already false, and keyCode 229 is how it still says so
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.isComposing || event.keyCode === 229)) event.preventDefault();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  draw();
});
speciesSelect.addEventListener("change", () => {
  if (current) draw();
});
saveButton.addEventListener("click", save);

// -- the blank card, and the loop --
stand([]);
scene.resize();
layFrame(BLANK_INK, 0);

runLoop((t) => {
  scene.resize();
  const [hw, hh] = extents();
  if (frame && (Math.abs(hw - frame.extents[0]) > 1e-9 || Math.abs(hh - frame.extents[1]) > 1e-9)) layFrame(frame.ink, frame.roll, frame.laid);
  boilFrame(t);
  scene.update(t);
}, (error) => { live.textContent = `error: ${error.message}`; });
