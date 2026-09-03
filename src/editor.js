// Editor — the character maker. Pick a species, then build one individual by hand: every slot, every colour,
// every proportion. Where the board draws what the roll says, this screen draws what you say.
//
// It holds **one working spec** and edits it in place. That is the difference from every other screen here:
// the rest go back through `makeCreature(roll, species)` and are therefore always something a roll could have
// produced, while an edited creature usually is not. So the thing this screen saves is the whole spec as JSON —
// the same file the board's pin opens into a cell (guidelines/determinism.md: a creature is its JSON, and the
// generator is the only thing that draws from a roll; nothing here calls rng). NEW rolls a fresh individual of
// the species to start from. SHUFFLE deals a whole new creature, species included; picking a species deals a
// new one of that species. The roll's number stays inside the file (the scene phases its clock off it), and nowhere else.
//
// The rules are reported, not enforced. A species' forbidden values and the constraint pass (a helmet takes
// the hair, an eyepatch comes off overlapping eyes) are run on a **copy** and the differences are listed under
// NOTES. What you picked is what gets drawn, so this screen can make individuals the board never will.
//
//   editor.html?species=cat

import { createScene } from "./scene/index.js";
import {
  makeCreature, applyForbid, applyConstraints,
  deriveSpec, readCreature, creatureJson, isHouse,
  SLOTS, SPECIES, PAINTABLE, paintKey
} from "./character/index.js";
import { FILLS, INKS, ACCENTS, POPS, DARKS, FURS, SCALES, HAIRS } from "./character/vocabulary/palette.js";
import { bindSeg, addOption, randomRoll, runLoop, download } from "./ui.js";
import { paintBall } from "./balls.js";

const canvas = document.getElementById("stage");
const speciesSel = document.getElementById("speciesSel");
const statusLabel = document.getElementById("status");
const poseSeg = document.getElementById("poseSeg");
const baseBox = document.getElementById("base");
const partsBox = document.getElementById("parts");
const paletteBox = document.getElementById("palette");
const proportionsBox = document.getElementById("proportions");
const notesBox = document.getElementById("notes");
const fileInput = document.getElementById("file");

// One palette for the whole screen. Every colour a creature can carry — a line ink, a skin, a fur, a dark, a
// scale, an accent, a pop, a hair — picks from the same set, pool by pool in that order, each colour once. The
// generator deals each key from a pool of its own (a human's skin from FILLS, a rex's from SCALES); those odds
// are the board's business and stay with it. Here a key is a key, and any colour goes in any of them.
// `pop` alone leads with a `null` for "no accent at all", which is what most individuals have. `pattern2` is the
// rex's second scale colour and is meaningless on anything else.
const unique = (pool) => [...new Set(pool)];
const PALETTE = unique([...INKS, ...FILLS, ...FURS, ...DARKS, ...SCALES, ...ACCENTS, ...POPS, ...HAIRS]);
const COLOR_KEYS = ["ink", "skin", "cloth", "hair", "accent", "pop", "pattern2"];
const poolOf = (key) => (key === "pop" ? [null, ...PALETTE] : PALETTE);

// The proportion sliders. Ranges are wide enough to reach past what the generator draws — this screen is for
// making something on purpose, including something the board would never roll. `hand` is not here: it is
// a drawing roll, not a proportion, and it gets its own button.
const PROPORTION_RANGE = {
  headScale: [0.6, 1.8], headWide: [0.6, 1.6], headLumps: [0, 12], headLump: [0, 0.25],
  eyeSize: [0.02, 0.4], eyeGap: [0.1, 0.9], eyeHeight: [-0.2, 0.4],
  eyeSizeSkew: [-0.6, 0.6], eyeHeightSkew: [-0.15, 0.15],
  noseDrop: [-0.1, 0.4], mouthDrop: [0, 0.7],
  bodyScale: [0.2, 1.1], bodyWide: [0.4, 1.6], legLength: [0, 0.7],
  armSpread: [0.3, 1.8], bodyLen: [0.5, 1.8], tailLift: [-0.4, 0.9], wobble: [0, 2.5]
};

// The address only says which species to start with. It makes a creature; it does not remember one — a file does.
const params = new URLSearchParams(window.location.search);
let species = SPECIES.some((s) => s.name === params.get("species")) ? params.get("species") : "human";
let roll = randomRoll();
let bind = true;
let spec = null;         // the working spec — the single thing this screen edits and saves

const scene = createScene(canvas);

// **The derived fields.** Four things on a spec are not chosen but computed, and the generator computes them at
// the end of `makeCreature`. Editing a slot or a colour has to recompute them or the screen lies: a ghost that
// keeps its old palette is not a ghost, and a face on a newly darkened head keeps marks that have gone
// invisible. `palette0` is the palette **before** the ghost collapse and is what edits are written into — that
// is what lets the ghost slot be switched off again and give the colours back.
// Every edit goes through deriveSpec (character/file.js) — the step a roll ends with, so an edited spec is
// as settled as a rolled one before it is drawn.
const derive = deriveSpec;

// A creature made here starts from its roll, with one rule of this screen laid over it: the body's material
// follows the base until a hand picks one. The generator rolls a body material of its own for the board; on
// this screen nothing has been chosen yet, so the body wears the base's surface. A file opened here keeps
// whatever it says.
function regenerate() {
  const made = makeCreature(roll, species);
  spec = derive({ ...made, parts: { ...made.parts, bodyMaterial: "same" } });
}

// **What the rules would have done.** Run on a copy so nothing is applied: the species' forbid table first (it
// maps a forbidden value to its replacement), then the constraint pass. Anything that moved is a note.
function notes() {
  const out = [];
  const forbidden = { ...spec.parts };
  applyForbid(forbidden, spec.species);
  for (const slot of Object.keys(forbidden)) {
    if (forbidden[slot] !== spec.parts[slot]) out.push(`${spec.species} forbids ${slot} = ${spec.parts[slot]} (board would draw ${forbidden[slot]})`);
  }
  const constrained = { ...spec.parts };
  applyConstraints(constrained, spec.species, spec.roll);
  for (const slot of Object.keys(constrained)) {
    if (constrained[slot] !== spec.parts[slot] && forbidden[slot] === spec.parts[slot]) {
      out.push(`the rules would take ${slot} = ${spec.parts[slot]} to ${constrained[slot]}`);
    }
  }
  if (spec.parts.ghost !== "none") out.push("ghost: one tone over every colour, eyes hollow — colour edits go to the palette underneath");
  return out;
}

// ---- the deck -------------------------------------------------------------------------------------------

function field(parent, label) {
  const row = document.createElement("label");
  row.className = "field";
  const name = document.createElement("span");
  name.textContent = label;
  row.appendChild(name);
  parent.appendChild(row);
  return row;
}

// **The part is the unit.** One part is open at a time, and the deck shows only what that part has: its
// form, and — for a part that is painted — which of the individual's own colours it takes. Parts that paint
// more than one thing are inspected one by one before they get a second colour (vocabulary/paint.js).
// **The base is not a part.** It is what the creature is made of before any part is put on it: the base skin
// material — a colour (the skin box), a goofy material, and the density it is laid at. The card reads the way
// a 3D program's material panel does: a ball previewing the three together, the materials as sample balls in
// the creature's own colour and density, the density as a stepped slider, then the colour. The two slots leave
// the part list for this card; the palette card, folded away by default, carries the same colour box.
const BASE_SLOTS = ["material", "density"];
const MATERIALS = SLOTS.material;    // graphite · ink · oil · charcoal
const DENSITIES = SLOTS.density;     // black · hatch · scribble · stipple · light — the steps, dark to light
const base = { preview: null, readout: null, balls: {}, density: null, densityOut: null };

// A row that is not a <label>: a label activates its first button on any click, and these rows hold many.
function fieldRow(parent, label, className = "field") {
  const row = document.createElement("div");
  row.className = className;
  const name = document.createElement("span");
  name.textContent = label;
  row.appendChild(name);
  parent.appendChild(row);
  return row;
}
// The preview ball, with what it shows written under it.
function previewRow(parent) {
  const row = fieldRow(parent, "preview");
  const canvas = document.createElement("canvas");
  canvas.className = "preview";
  row.appendChild(canvas);
  const readout = document.createElement("output");
  readout.className = "readout";
  row.appendChild(readout);
  return { row, canvas, readout };
}
// A strip of sample balls, one per material name; "same" is the body's "base skin's".
function ballStrip(parent, names, onPick) {
  const row = fieldRow(parent, "material", "field balls");
  const strip = document.createElement("div");
  strip.className = "strip";
  const balls = {};
  for (const name of names) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = name === "same" ? "ball same" : "ball";
    item.title = name === "same" ? "base skin's" : name;
    item.setAttribute("aria-label", `material ${item.title}`);
    const canvas = document.createElement("canvas");
    item.appendChild(canvas);
    item.addEventListener("click", () => onPick(name));
    strip.appendChild(item);
    balls[name] = { item, canvas };
  }
  row.appendChild(strip);
  return { row, balls };
}

function buildBase() {
  baseBox.innerHTML = "";
  const preview = previewRow(baseBox);
  base.preview = preview.canvas;
  base.readout = preview.readout;
  base.balls = ballStrip(baseBox, MATERIALS, (name) => {
    spec = derive({ ...spec, parts: { ...spec.parts, material: name } });
    render();
  }).balls;
  const densityRow = field(baseBox, "density");
  base.density = document.createElement("input");
  base.density.type = "range";
  base.density.min = "0";
  base.density.max = String(DENSITIES.length - 1);
  base.density.step = "1";
  base.density.setAttribute("aria-label", "density");
  base.density.addEventListener("input", () => {
    spec = derive({ ...spec, parts: { ...spec.parts, density: DENSITIES[Number(base.density.value)] } });
    render();
  });
  densityRow.appendChild(base.density);
  base.densityOut = document.createElement("output");
  base.densityOut.className = "readout";
  densityRow.appendChild(base.densityOut);
  paletteRow(baseBox, "skin", "colour");
}
function renderBase() {
  const { material, density } = spec.parts;
  const color = spec.palette0.skin;
  paintBall(base.preview, { color, material, density, phase: 0, size: 72 });
  base.readout.textContent = `${material} · ${density}`;
  MATERIALS.forEach((name, i) => {
    const b = base.balls[name];
    paintBall(b.canvas, { color, material: name, density, phase: 1 + i });
    b.item.classList.toggle("on", name === material);
  });
  base.density.value = String(Math.max(0, DENSITIES.indexOf(density)));
  base.densityOut.textContent = density;
}

// A part that carries a material of its own. The body is clothing: what is put on it brings its own surface
// (bodyMaterial), and `same` means it follows the base. The slot leaves the part list and shows under body.
const PART_MATERIAL = { body: "bodyMaterial" };
// **Colour belongs to the material.** The base skin material is a colour (the skin box), a material and a
// density; the body's material is its own colour (the cloth box) and its own material, or the base skin's. So
// these parts take no paint row: their colour is their material's. Only a part with no material of its own —
// the hair, the headgear — is painted from one of the creature's boxes.
const MATERIAL_PARTS = ["head", "ears", "body"];
const PAINTED = PAINTABLE.filter((slot) => !MATERIAL_PARTS.includes(slot));
const PART_SLOTS = Object.keys(SLOTS).filter((slot) => !BASE_SLOTS.includes(slot) && !Object.values(PART_MATERIAL).includes(slot));
let part = PART_SLOTS[0];
let partSel = null;
let formSel = null;
let bodyColourRow = null;
const body = { previewRow: null, preview: null, readout: null, materialRow: null, balls: {} };
const BODY_MATERIALS = ["same", ...SLOTS.bodyMaterial.filter((name) => name !== "same")];
let paintRow = null;
let paintStrip = null;
const PAINT_BOXES = ["skin", "cloth", "hair", "accent", "pop"];

function buildParts() {
  partsBox.innerHTML = "";
  const pick = field(partsBox, "part");
  partSel = document.createElement("select");
  partSel.setAttribute("aria-label", "Part");
  for (const slot of PART_SLOTS) addOption(partSel, slot, slot);
  partSel.addEventListener("change", () => { part = partSel.value; renderPart(); });
  pick.appendChild(partSel);

  const form = field(partsBox, "form");
  formSel = document.createElement("select");
  formSel.setAttribute("aria-label", "Form");
  formSel.addEventListener("change", () => {
    spec = derive({ ...spec, parts: { ...spec.parts, [part]: formSel.value } });
    render();
  });
  form.appendChild(formSel);

  // The body's material, read the way the base skin card is: a preview ball, the materials (the base skin's
  // own first), then the colour. No density of its own — that is the creature's, one hand and one pressure
  const preview = previewRow(partsBox);
  body.previewRow = preview.row;
  body.preview = preview.canvas;
  body.readout = preview.readout;
  const strip = ballStrip(partsBox, BODY_MATERIALS, (name) => {
    spec = derive({ ...spec, parts: { ...spec.parts, bodyMaterial: name } });
    render();
  });
  body.materialRow = strip.row;
  body.balls = strip.balls;
  bodyColourRow = paletteRow(partsBox, "cloth", "colour");

  paintRow = document.createElement("div");
  paintRow.className = "field swatches";
  const name = document.createElement("span");
  name.textContent = "paint";
  paintRow.appendChild(name);
  paintStrip = document.createElement("div");
  paintStrip.className = "strip";
  paintRow.appendChild(paintStrip);
  partsBox.appendChild(paintRow);
}

// The open part's controls, from the spec: the form list; for the body its material (colour, material); and
// for a part with no material of its own the paint boxes, drawn in the individual's own colours with the one
// it currently takes ringed. A box the individual does not have (a pop on one without) is not offered.
function renderPart() {
  partSel.value = part;
  formSel.innerHTML = "";
  for (const value of SLOTS[part]) addOption(formSel, value, value);
  formSel.value = spec.parts[part];

  const isBody = part === "body";
  body.previewRow.hidden = !isBody;
  body.materialRow.hidden = !isBody;
  bodyColourRow.hidden = !isBody;
  if (isBody) {
    const own = spec.parts.bodyMaterial;
    const material = own === "same" ? spec.parts.material : own;
    const color = spec.palette0.cloth;
    const density = spec.parts.density;
    paintBall(body.preview, { color, material, density, phase: 40, size: 72 });
    body.readout.textContent = `${own === "same" ? "base skin's " : ""}${material} · ${density}`;
    BODY_MATERIALS.forEach((name, i) => {
      const b = body.balls[name];
      paintBall(b.canvas, { color, material: name === "same" ? spec.parts.material : name, density, phase: 41 + i });
      b.item.classList.toggle("on", name === own);
    });
  }

  const paintable = PAINTED.includes(part);
  paintRow.hidden = !paintable;
  paintStrip.innerHTML = "";
  if (!paintable) return;
  const current = paintKey(spec, part);
  for (const key of PAINT_BOXES) {
    const color = key === "pop" ? spec.palette0.pop && spec.palette0.pop.color : spec.palette0[key];
    if (!color) continue;
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "swatch";
    dot.style.background = color;
    dot.title = key;
    dot.setAttribute("aria-label", `paint ${part} with ${key}`);
    dot.classList.toggle("on", key === current);
    dot.addEventListener("click", () => {
      spec = derive({ ...spec, paint: { ...(spec.paint || {}), [part]: key } });
      render();
    });
    paintStrip.appendChild(dot);
  }
}

// One row of a palette box's pool — the swatches a key may be picked from. The same row serves PALETTE, the
// base skin material's colour and the body material's colour, so all of them show the same choice ringed.
function paletteRow(parent, key, label = key) {
  const row = document.createElement("div");
  row.className = "field swatches";
  row.dataset.key = key;
  const name = document.createElement("span");
  name.textContent = label;
  row.appendChild(name);
  const strip = document.createElement("div");
  strip.className = "strip";
  for (const color of poolOf(key)) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "swatch";
    dot.dataset.color = color === null ? "" : color;
    dot.title = color === null ? "none" : color;
    dot.setAttribute("aria-label", `${key} ${color === null ? "none" : color}`);
    if (color !== null) dot.style.background = color;
    else dot.textContent = "—";
    dot.addEventListener("click", () => {
      // A pop is a colour **and** a target, so keep the target the individual already had.
      const value = key === "pop" ? (color === null ? null : { color, target: spec.palette0.pop?.target || "hair" }) : color;
      spec = derive({ ...spec, palette0: { ...spec.palette0, [key]: value } });
      render();
    });
    strip.appendChild(dot);
  }
  row.appendChild(strip);
  parent.appendChild(row);
  return row;
}

function buildPalette() {
  paletteBox.innerHTML = "";
  for (const key of COLOR_KEYS) paletteRow(paletteBox, key);
}

function buildProportions() {
  proportionsBox.innerHTML = "";
  for (const key of Object.keys(PROPORTION_RANGE)) {
    const [min, max] = PROPORTION_RANGE[key];
    const row = field(proportionsBox, key);
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    // A step derived from the range lands on values like 1.79 and never reaches the end of the slider. Round
    // numbers instead — fine on a wide range, finer on a narrow one.
    slider.step = key === "headLumps" ? "1" : max - min <= 0.4 ? "0.005" : "0.01";
    slider.setAttribute("aria-label", key);
    slider.addEventListener("input", () => {
      spec = { ...spec, proportions: { ...spec.proportions, [key]: Number(slider.value) } };
      render();
    });
    row.appendChild(slider);
    const readout = document.createElement("output");
    readout.className = "readout";
    row.appendChild(readout);
  }
}

// ---- drawing --------------------------------------------------------------------------------------------

function render() {
  speciesSel.value = spec.species;

  renderBase();
  renderPart();
  for (const row of document.querySelectorAll(".field.swatches[data-key]")) {
    const key = row.dataset.key;
    const current = key === "pop" ? (spec.palette0.pop?.color ?? "") : (spec.palette0[key] ?? "");
    for (const dot of row.querySelectorAll(".swatch")) dot.classList.toggle("on", dot.dataset.color === current);
  }
  for (const row of proportionsBox.children) {
    const slider = row.querySelector("input");
    const key = slider.getAttribute("aria-label");
    slider.value = String(spec.proportions[key]);
    row.querySelector("output").textContent = spec.proportions[key].toFixed(key === "headLumps" ? 0 : 2);
  }

  const list = notes();
  notesBox.innerHTML = "";
  for (const note of list) {
    const item = document.createElement("li");
    item.textContent = note;
    notesBox.appendChild(item);
  }
  notesBox.classList.toggle("empty", list.length === 0);

  scene.build([spec], 1);
  scene.setBind(bind);
  statusLabel.textContent = `${spec.species.toUpperCase()}${list.length ? ` · ${list.length} NOTE${list.length > 1 ? "S" : ""}` : ""}`;
}

// ---- the file -------------------------------------------------------------------------------------------

// Named by species; the browser numbers a second cat. The file is the creature.
function save() {
  download(`${spec.species}.json`, creatureJson(spec));
}

// A loaded spec is drawn as it is — the same file the board saves from a cell, or a board file's one cell. It
// is only checked for what the drawing cannot do without (character/file.js), and the reason it was refused
// takes the status label's place.
function load(text) {
  const read = readCreature(text);
  if (read.error || isHouse(read.spec)) {
    statusLabel.textContent = read.error || "NOT A CREATURE";
    return;
  }
  spec = read.spec;
  species = spec.species;
  render();
}

// ---- wiring ---------------------------------------------------------------------------------------------

for (const s of SPECIES) addOption(speciesSel, s.name, s.name.toUpperCase());
buildBase();
buildParts();
buildPalette();
buildProportions();

// Changing the species draws a new individual of it. Every species has its own palette rules — an imp's head is
// ink and a rex is two scale colours — so carrying the old colours across would give a creature no species
// would ever wear, and the flow here is species first, parts after.
speciesSel.addEventListener("change", () => { species = speciesSel.value; regenerate(); render(); });
// SHUFFLE — everything goes, the species too. It sits above SPECIES because it is not a choice within one.
document.getElementById("shuffle").addEventListener("click", () => {
  species = SPECIES[Math.floor(Math.random() * SPECIES.length)].name;
  roll = randomRoll();
  regenerate();
  render();
});
document.getElementById("rewobble").addEventListener("click", () => {
  // The same individual drawn by a different hand — the wobble roll is what every stroke's shake comes off.
  spec = derive({ ...spec, proportions: { ...spec.proportions, hand: randomRoll() % 65536 } });
  render();
});
document.getElementById("save").addEventListener("click", save);
document.getElementById("open").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) file.text().then(load);
  fileInput.value = "";
});

const pose = bindSeg(poseSeg, "pose", (value) => {
  bind = value === "bind";
  scene.setBind(bind);
});
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  if (key === "r") document.getElementById("shuffle").click();
  if (key === "b") pose.set(bind ? "motion" : "bind");
});
window.addEventListener("resize", () => scene.resize());

regenerate();
render();
scene.resize();

runLoop((t) => {
  scene.resize();
  scene.update(t);
}, () => { statusLabel.textContent = "ERROR"; });
