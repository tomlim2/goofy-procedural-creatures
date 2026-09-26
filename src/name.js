// The name screen — the front door (guidelines/name.md). A name, a species (ANY lets the name pick) and DRAW stand a creature up on a
// trading card; SAVE keeps the card, only the card, as it is seen; LINK hands its address on. The card drawn rides in the address
// (?name=…&species=…), so a link shares it; nothing is kept in storage. The screen speaks the device's language, Korean or English
// (lang.js) — the controls, the back's hint and what the card says about the creature.
//
// The card is one WebGL canvas: the board's own scene at 1×1 — the paper, the creature, the sheet over them — with the card's frame
// and its words drawn into it in the pencil (the words in the goofy type, medium/type.js: any script, traced off Noto Sans), so they
// boil with the creature, lie under the same sheet, and SAVE is the same scene drawn again at a fixed size. The screen opens on the
// card's back, and a DRAW turns the card over.

import * as THREE from "three";
import { createScene } from "./scene/index.js";
import { sketchMesh, disposeGroup } from "./scene/mesh.js";
import { BOIL_FRAMES, boilRate } from "./scene/rig.js";
import { Sketch } from "./stroke.js";
import { makeNoise, makeRng } from "./rng.js";
import { creatureOfName, addressOfName, nameOfAddress, nameKey, shownName, isGhost, PAPER } from "./character/index.js";
import { materialOf } from "./character/draw/body.js";
import { stepOf } from "./medium/materials.js";
import { loadType, traceType, typeWith } from "./medium/type.js";
import { writeCentred } from "./medium/letters.js";
import { mix } from "./color.js";
import { CARD, CARD_SAVE, cardOf, layCard } from "./card.js";
import { savePng, shareLink } from "./export.js";
import { runLoop } from "./ui.js";
import { langOf, UI } from "./lang.js";

const form = document.getElementById("controls");
const input = document.getElementById("name");
const speciesSelect = document.getElementById("species");
const drawButton = document.getElementById("draw");
const saveButton = document.getElementById("save");
const linkButton = document.getElementById("link");
const afterRow = document.getElementById("after");   // SAVE and LINK — the row that stands once a card does
const face = document.getElementById("face");
const live = document.getElementById("live");

// The device's language, Korean or English (lang.js): the page's words are set from it before anything is drawn. ?lang= in the
// address comes first, so a link can ask for the other one and a check can read the page in both
const LANG = langOf([...new URLSearchParams(window.location.search).getAll("lang"), ...(navigator.languages || [navigator.language])]);
const T = UI[LANG];
document.documentElement.lang = LANG;
document.title = T.title;
input.placeholder = T.name;
input.setAttribute("aria-label", T.name);
speciesSelect.setAttribute("aria-label", T.species);
for (const option of speciesSelect.options) option.textContent = T[option.value === "all" ? "any" : option.value];
drawButton.textContent = T.draw;
saveButton.textContent = T.save;
linkButton.textContent = T.link;

const scene = createScene(face);
window.menagerie = { scene };   // the debug handle every screen keeps

// The type's four faces, loaded now whatever is typed later (medium/type.js loadType). Until they are here a DRAW waits on them — 1.6 MB
// on a first visit — and says so: the button reads DRAWING… and takes no second press, so a slow line never looks like a dead button
let typeLoaded = false;
const typeReady = loadType().then(() => { typeLoaded = true; });

// What stands on the card now: { made, card, laid } — null until the first DRAW
let current = null;

// -- what the pencil lays over the scene: the card's back, or its frame and words --
// The world rectangle the card shows is the camera's, so both are laid from it and laid again whenever it moves (a resize). Three
// boil frames, one mesh each, flipped at the creature's own cadence (rig.js boilRate); a word's wiggle moves with the frame
const FRAME_ORDER = 1.2;   // over the paper and the floor line, under every creature (their blocks start at 10, scene/index.js)
const UNDER_ORDER = 0.6;   // the card's dressing under the floor line (1): the picture's paper
const TYPE_HAND = 0.5;     // the wobble of the pencil round a letter — half the frame's, so a word a few ink widths tall still reads
const TYPE_WIGGLE = 0.035; // how far a letter's outline is pushed about, in ems
let frame = null;          // { group, boil, extents, lay } — lay() draws the same thing again at the camera's new size

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

// One pencil group over the scene: the same drawing in three boil frames, its noise the roll's. paint({ lines, words, under }, k, at)
// lays one frame — `lines` in the frame's hand, `words` in the letters' and the type's, `under` what goes under the floor line — and
// at.X / at.Y take a fraction of the card to the world
function layPencil(roll, paint) {
  if (frame) {
    disposeGroup(frame.group);
    scene.scene.remove(frame.group);
  }
  const [hw, hh] = extents();
  const at = { hw, hh, X: (fx) => -hw + fx * 2 * hw, Y: (fy) => hh - fy * 2 * hh };
  const noise = makeNoise(makeRng(roll + 1));
  const group = new THREE.Group();
  group.position.y = scene.camera.position.y;   // laid about the camera's centre, which stands above the origin (stand)
  for (let k = 0; k < BOIL_FRAMES; k += 1) {
    const lines = new Sketch(noise, 1.2);
    lines.phase = k * 101.7;   // a different stretch of the noise per frame — that is the boil
    const words = new Sketch(noise, TYPE_HAND, 1);
    words.phase = k * 101.7 + 50;
    const under = new Sketch(noise, 1.2);
    under.phase = k * 101.7 + 25;
    paint({ lines, words, under }, k, at);
    // One child per boil frame (boilFrame shows children[k]): a group holding the frame's meshes — the lines and words at
    // FRAME_ORDER, and what goes under the floor line at UNDER_ORDER when there is anything
    const frameGroup = new THREE.Group();
    frameGroup.add(sketchMesh([lines, words], 0.9, FRAME_ORDER));
    if (!under.empty) frameGroup.add(sketchMesh([under], 1, UNDER_ORDER));
    frameGroup.visible = k === 0;
    group.add(frameGroup);
  }
  scene.scene.add(group);
  frame = { group, boil: boilRate(roll), extents: [hw, hh], lay: () => layPencil(roll, paint) };
}

// The card's edge and the picture's window as closed pencil lines, the card's words in the goofy type, and its dressing (CARD): the
// picture's paper washed with the creature's own material, and its colours as paint chips
function layFrame(made, card, laid) {
  const { spec } = made;
  const ink = card.ink;
  // The wash — the creature's material at the lightest step in a tint of its skin, so each card's paper is its own; a ghost, which
  // draws no texture, gets the tint alone
  const wash = { name: materialOf(spec, "head"), color: mix(spec.palette.skin, PAPER, CARD.wash.tint), value: stepOf(CARD.wash.step), only: isGhost(spec) ? "base" : undefined };
  layPencil(made.roll, ({ lines, words, under }, k, { X, Y, hw, hh }) => {
    const inset = CARD.inset * 2 * hw;
    const radius = CARD.corner * 2 * hw;
    const window = roundedRect(X(CARD.art.x0), Y(CARD.art.y0), X(CARD.art.x1), Y(CARD.art.y1), radius * 0.4);
    under.paint(window, wash.name, { color: wash.color, value: wash.value, only: wash.only });
    lines.contour(roundedRect(-hw + inset, hh - inset, hw - inset, -hh + inset, radius), { color: ink });
    lines.contour(window, { color: ink });
    // The paint chips — a row ending at the right, each a flat square of one colour in the card's ink
    const size = CARD.swatch.size * 2 * hw, gap = CARD.swatch.gap * 2 * hw;
    card.swatches.forEach((color, i) => {
      const right = X(CARD.swatch.x1) - (card.swatches.length - 1 - i) * (size + gap);
      const chip = roundedRect(right - size, Y(CARD.swatch.y) + size / 2, right, Y(CARD.swatch.y) - size / 2, size * 0.2);
      lines.fill(chip, color);
      lines.contour(chip, { color: ink, size: "S" });
    });
    for (const word of laid) {
      typeWith(words, word.line, { x: X(word.x), y: Y(word.y), em: word.em * 2 * hw, color: word.color, wiggle: TYPE_WIGGLE, phase: k * 3.1 });
    }
  });
}

// -- the back --
// The card face down, which is what the screen opens on (guidelines/name.md § the back): the card's own edge, a border inside it, and
// the wordmark over a hint in the goofy letters — medium/letters.js, the project's own capitals, which the card's words were drawn
// for — or over the name, as it is typed. In the page's ink, since a card with no creature has no palette, and boiling at roll 0's
// cadence like any other card
const BACK_INK = "#2b2724";   // styles.css --ink
const BACK = {
  border: 0.075,                 // the border inside the card's edge, of the card's width
  mark: { y: 0.5, cap: 0.062 },  // MENAGERIE across the middle: its baseline and cap, of the card's height
  hint: { y: 0.6, cap: 0.028 },  // the hint under it — the letters' cap, or the type's em at typeEm times that
  typeEm: 1.4,
  name: 0.7                      // the name typed, shrunk to this much of the card's width when it runs longer
};
function layBack() {
  // The name as it is typed stands where the hint does (the field lays the back again at every keystroke, below): as the card will
  // write it (shownName, in the type), in the page's ink where the hint is soft — a field's text is dark where its placeholder was
  // grey. A key that comes out empty is no name, and the hint comes back
  const typed = nameKey(input.value) ? shownName(input.value) : "";
  layPencil(0, ({ lines, words }, k, { Y, hw, hh }) => {
    const inset = CARD.inset * 2 * hw;
    const radius = CARD.corner * 2 * hw;
    lines.contour(roundedRect(-hw + inset, hh - inset, hw - inset, -hh + inset, radius), { color: BACK_INK });
    const border = BACK.border * 2 * hw;
    lines.contour(roundedRect(-hw + border, hh - border, hw - border, -hh + border, radius * 0.6), { color: BACK_INK });
    writeCentred(words, "MENAGERIE", 0, Y(BACK.mark.y), BACK.mark.cap * 2 * hh, { color: BACK_INK, pen: "L" });
    // The goofy letters write the English hint; the name and the Korean hint are the type's (medium/type.js), any script, so they
    // wait for the faces and are laid when they come (typeReady below) — the English hint standing until then, the Korean wordmark
    // alone
    const soft = mix(BACK_INK, PAPER, 0.35);
    if (LANG === "en" && !(typed && typeLoaded)) writeCentred(words, T.hint, 0, Y(BACK.hint.y), BACK.hint.cap * 2 * hh, { color: soft });
    else if (typeLoaded) {
      const line = traceType(typed || T.hint, 500);
      const em = Math.min(BACK.hint.cap * 2 * hh * BACK.typeEm, (BACK.name * 2 * hw) / line.width);
      typeWith(words, line, { x: -(line.width * em) / 2, y: Y(BACK.hint.y), em, color: typed ? BACK_INK : soft, wiggle: TYPE_WIGGLE, phase: k * 3.1 });
    }
  });
}
typeReady.then(() => { if (!current) layBack(); });

function boilFrame(t) {
  if (!frame) return;
  const shown = Math.floor(t * frame.boil.fps + frame.boil.offset) % BOIL_FRAMES;
  frame.group.children.forEach((frameGroup, k) => { frameGroup.visible = k === shown; });
}

// -- turning the card over --
// A DRAW turns the card over: the card — its outline, its words and the creature standing on it — is squashed across until it
// stands on its edge, what it shows is swapped there, where there is nothing to see, and it opens out again. **The card turns, not
// the area**: the paper and the sheet over it hold still (scene/index.js `setTurn` squashes everything drawn on the paper; the
// frame is this page's own group), so a card turns over on a page that does not move — and the slowest work there is, standing a
// creature up, happens where it cannot be seen. It runs on the loop's own clock, so the card boils as it turns. The turns are
// taken one at a time, a DRAW during one waiting for it, and a visitor who asks for less motion gets the swap alone
const TURN = 0.2;   // half a turn, seconds
const lessMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let turning = Promise.resolve();   // the turns queue on this
let turn = null;                   // the one running: { from, swap, done, swapped }
let turned = 1;                    // how wide the card stands — 1 flat on, 0 on its edge

function turnTo(k) {
  turned = k;
  frame.group.scale.x = k;
  scene.setTurn(k);
}

function turnOver(swap) {
  turning = turning.then(() => new Promise((done) => {
    if (lessMotion.matches) {
      swap();
      done();
      return;
    }
    saveButton.disabled = linkButton.disabled = true;   // a card caught mid-turn would save squashed, and its address is written at the swap
    turn = { from: null, swap, done, swapped: false };
  }));
  return turning;
}

// One tick of the turn: the card stands as wide as the cosine of the angle it has turned through, and what it shows is swapped at
// the edge — at |cos| the new side comes round the right way about rather than mirrored
function stepTurn(t) {
  if (!turn) return;
  if (turn.from === null) turn.from = t;
  const u = Math.min(1, (t - turn.from) / (2 * TURN));
  if (u >= 0.5 && !turn.swapped) {
    turn.swap();
    turn.swapped = true;
  }
  turnTo(Math.abs(Math.cos(Math.PI * u)));
  if (u >= 1) {
    const { done } = turn;
    turn = null;
    saveButton.disabled = linkButton.disabled = false;
    done();
  }
}

// -- the card --
// The scene at 1×1 with the card's zoom — set after every build, as a build lays the camera out again
function stand(specs) {
  scene.build(specs, 1);
  scene.camera.zoom = CARD.zoom;
  scene.camera.updateProjectionMatrix();
  // The camera looks above the origin, so the cell sits down the card at CARD.origin — the picture's window runs further below the
  // name than above it, and the creature is stood in its middle, the emoji over its head still under the window's top
  const [, hh] = extents();
  scene.camera.position.y = (CARD.origin - 0.5) * 2 * hh;
}

// A DRAW waits for the type; a second DRAW pressed while it waits wins, and the first is let go. The card drawn goes into the address
// in place (replaceState — no history entry a name, so BACK leaves the page), and only a card drawn: a DRAW that draws nothing leaves
// the address on the card still standing
let drawing = 0;
async function draw() {
  const species = speciesSelect.value;
  const made = creatureOfName(input.value, species);
  if (!made) {
    input.focus();
    return;
  }
  const mine = ++drawing;
  if (!typeLoaded) {
    drawButton.disabled = true;
    drawButton.textContent = T.drawing;
    await typeReady;
    drawButton.disabled = false;
    drawButton.textContent = T.draw;
  }
  if (mine !== drawing) return;
  const card = cardOf(made, LANG);
  const laid = layCard(card, traceType);   // the words traced before the turn starts, so the turn does not wait on a new script
  await turnOver(() => {
    current = { made, card, laid };
    stand([made.spec]);
    layFrame(made, card, laid);
    afterRow.hidden = false;
    window.history.replaceState(null, "", `${window.location.pathname}?${addressOfName(made.shown, species)}`);
    live.textContent = T.live(card);
  });
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
// The back writes the name as it is typed — every keystroke, a syllable an input method is still composing too — while the back is
// what shows; once a card stands, the field changes nothing on it until DRAW
input.addEventListener("input", () => {
  if (!current) layBack();
});
// The field keeps the keyboard. It is focused when the page opens (autofocus), but a page opened where it does not have the keyboard
// yet — the app's pane beside a chat, a window behind another — gets it with the first click on it, and a click on the card took it
// off the field. So a mouse press anywhere but on a control leaves the caret in the field (the press's own default, the focus moving
// to the page, is let go); a tap on the card's back brings a phone's keyboard up, and a tap while it is up still puts it away, as a
// phone's tap does
let pointer = "mouse";   // what the last press was made with — pointerdown comes before the mouse's own events, a finger's too
let typing = false;      // whether the field had the keyboard when it was made
window.addEventListener("pointerdown", (event) => {
  pointer = event.pointerType;
  typing = document.activeElement === input;
}, true);
window.addEventListener("mousedown", (event) => {
  if (pointer !== "mouse" || event.button !== 0 || event.target === document.documentElement) return;   // the root: a scrollbar
  if (event.target.closest("input, select, button, a, label")) return;
  event.preventDefault();
  input.focus({ preventScroll: true });
});
face.addEventListener("click", () => {
  if (pointer !== "mouse" && !current && !typing) input.focus();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  draw();
});
speciesSelect.addEventListener("change", () => {
  if (current) draw();
});
saveButton.addEventListener("click", save);
// LINK — the card's address handed on (export.js shareLink): a phone's share sheet, else the clipboard, the button saying COPIED for a moment
linkButton.addEventListener("click", async () => {
  if (!current) return;
  const outcome = await shareLink(window.location.href, T.linkPrompt);
  if (outcome !== "copied") return;
  linkButton.textContent = T.copied;
  setTimeout(() => { linkButton.textContent = T.link; }, 1600);
});

// -- the back, and the loop --
stand([]);          // the paper alone, in the 1×1 view the creature will stand in, so the card does not move when one arrives
scene.resize();
layBack();

runLoop((t) => {
  scene.resize();
  const [hw, hh] = extents();
  if (frame && (Math.abs(hw - frame.extents[0]) > 1e-9 || Math.abs(hh - frame.extents[1]) > 1e-9)) frame.lay();   // laid flat again
  stepTurn(t);   // after the re-lay, which draws the card its full width
  boilFrame(t);
  scene.update(t);
}, (error) => { live.textContent = `error: ${error.message}`; });

// -- a link --
// An address a card was drawn at fills the field and the dropdown and draws, as DRAW would. The field's maxlength holds back typing,
// not a value set from here, so a longer name is cut to it — by whole characters, where typing would have stopped
const linked = nameOfAddress(window.location.search);
speciesSelect.value = linked.species;
if (linked.text) {
  let text = "";
  for (const character of linked.text) {
    if (text.length + character.length > input.maxLength) break;
    text += character;
  }
  input.value = text;
  layBack();   // the back with the name on it, as if it had been typed, until the card turns over
  draw();
}
