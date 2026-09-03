// Editor — the character maker. Pick a species, then build one individual by hand: every slot, every colour,
// every proportion. Where the board draws what the seed says, this screen draws what you say.
//
// It holds **one working spec** and edits it in place. That is the difference from every other screen here:
// the rest go back through `makeCreature(seed, species)` and are therefore always something a seed could have
// produced, while an edited creature usually is not. So the thing this screen saves is the whole spec as JSON,
// not a seed — a seed cannot express it (guidelines/determinism.md is about the generator, and the generator
// is still the only thing that draws from a seed; nothing here calls rng).
//
// The rules are reported, not enforced. A species' forbidden values and the constraint pass (a helmet takes
// the hair, an eyepatch comes off overlapping eyes) are run on a **copy** and the differences are listed under
// NOTES. What you picked is what gets drawn, so this screen can make individuals the board never will.
//
//   editor.html?seed=0z0y9qe&species=cat

import { createScene } from "./scene/index.js";
import {
  makeCreature, applyForbid, applyConstraints,
  deriveSpec, readCreature, creatureJson, isHouse,
  SLOTS, SPECIES, PAINTABLE, paintKey
} from "./character/index.js";
import { FILLS, INKS, ACCENTS, POPS, DARKS, FURS, SCALES, HAIRS } from "./character/vocabulary/palette.js";
import { formatSeed } from "./rng.js";
import { bindSeg, addOption, randomSeed, runLoop, download } from "./ui.js";

const canvas = document.getElementById("stage");
const speciesSel = document.getElementById("speciesSel");
const seedLabel = document.getElementById("seed");
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
// making something on purpose, including something the board would never roll. `wobbleSeed` is not here: it is
// a drawing seed, not a proportion, and it gets its own button.
const PROPORTION_RANGE = {
  headScale: [0.6, 1.8], headWide: [0.6, 1.6], headLumps: [0, 12], headLump: [0, 0.25],
  eyeSize: [0.02, 0.4], eyeGap: [0.1, 0.9], eyeHeight: [-0.2, 0.4],
  eyeSizeSkew: [-0.6, 0.6], eyeHeightSkew: [-0.15, 0.15],
  noseDrop: [-0.1, 0.4], mouthDrop: [0, 0.7],
  bodyScale: [0.2, 1.1], bodyWide: [0.4, 1.6], legLength: [0, 0.7],
  armSpread: [0.3, 1.8], bodyLen: [0.5, 1.8], tailLift: [-0.4, 0.9], wobble: [0, 2.5]
};

const params = new URLSearchParams(window.location.search);
let species = SPECIES.some((s) => s.name === params.get("species")) ? params.get("species") : "human";
let seed = params.get("seed") ? parseInt(params.get("seed"), 36) >>> 0 : randomSeed();
let bind = true;
let spec = null;         // the working spec — the single thing this screen edits and saves
let loaded = false;      // true once a spec has been loaded from a file, so the seed no longer describes it

const scene = createScene(canvas);

// **The derived fields.** Four things on a spec are not chosen but computed, and the generator computes them at
// the end of `makeCreature`. Editing a slot or a colour has to recompute them or the screen lies: a ghost that
// keeps its old palette is not a ghost, and a face on a newly darkened head keeps marks that have gone
// invisible. `palette0` is the palette **before** the ghost collapse and is what edits are written into — that
// is what lets the ghost slot be switched off again and give the colours back.
// Every edit goes through deriveSpec (character/file.js) — the step a roll ends with, so an edited spec is
// as settled as a rolled one before it is drawn.
const derive = deriveSpec;

// A creature made here starts from its seed, with one rule of this screen laid over it: the body's material
// follows the base until a hand picks one. The generator rolls a body material of its own for the board; on
// this screen nothing has been chosen yet, so the body wears the base's surface. A file opened here keeps
// whatever it says.
function regenerate() {
  const made = makeCreature(seed, species);
  spec = derive({ ...made, parts: { ...made.parts, bodyMaterial: "same" } });
  loaded = false;
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
  applyConstraints(constrained, spec.species, spec.seed);
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
// **The base is not a part.** It is what the creature is made of before any part is put on it: its colour
// is the skin — the box most of the creature is painted from — and its material is the goofy surface
// (material, and how densely it is laid). Those two slots leave the part list for this card; the palette
// card, folded away by default, carries the same colour box.
const BASE_SLOTS = ["material", "density"];
const baseSels = {};
function buildBase() {
  baseBox.innerHTML = "";
  paletteRow(baseBox, "skin", "colour");
  for (const slot of BASE_SLOTS) {
    const row = field(baseBox, slot);
    const select = document.createElement("select");
    select.setAttribute("aria-label", slot);
    for (const value of SLOTS[slot]) addOption(select, value, value);
    select.addEventListener("change", () => {
      spec = derive({ ...spec, parts: { ...spec.parts, [slot]: select.value } });
      render();
    });
    row.appendChild(select);
    baseSels[slot] = select;
  }
}
function renderBase() {
  for (const slot of BASE_SLOTS) baseSels[slot].value = spec.parts[slot];
}

// A part that carries a material of its own. The body is clothing: what is put on it brings its own surface
// (bodyMaterial), and `same` means it follows the base. The slot leaves the part list and shows under body.
const PART_MATERIAL = { body: "bodyMaterial" };
const PART_SLOTS = Object.keys(SLOTS).filter((slot) => !BASE_SLOTS.includes(slot) && !Object.values(PART_MATERIAL).includes(slot));
let part = PART_SLOTS[0];
let partSel = null;
let formSel = null;
let materialRow = null;
let materialSel = null;
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

  materialRow = field(partsBox, "material");
  materialSel = document.createElement("select");
  materialSel.setAttribute("aria-label", "Material");
  materialSel.addEventListener("change", () => {
    spec = derive({ ...spec, parts: { ...spec.parts, [PART_MATERIAL[part]]: materialSel.value } });
    render();
  });
  materialRow.appendChild(materialSel);

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

// The open part's controls, from the spec: the form list, and the paint boxes drawn in the individual's own
// colours with the one it currently takes ringed. A box the individual does not have (a pop on one without)
// is not offered.
function renderPart() {
  partSel.value = part;
  formSel.innerHTML = "";
  for (const value of SLOTS[part]) addOption(formSel, value, value);
  formSel.value = spec.parts[part];

  const materialSlot = PART_MATERIAL[part];
  materialRow.hidden = !materialSlot;
  if (materialSlot) {
    materialSel.innerHTML = "";
    for (const value of SLOTS[materialSlot]) addOption(materialSel, value, value === "same" ? "same as base" : value);
    materialSel.value = spec.parts[materialSlot];
  }

  const paintable = PAINTABLE.includes(part);
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

// One row of a palette box's pool — the swatches a key may be picked from. The same row serves PALETTE and
// the skin at the top of PART, so both show the same choice ringed.
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
  seedLabel.textContent = loaded ? "loaded" : formatSeed(spec.seed);

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

  if (!loaded) window.history.replaceState(null, "", `?seed=${seed.toString(36)}&species=${species}`);
  scene.build([spec], 1);
  scene.setBind(bind);
  statusLabel.textContent = `${spec.species.toUpperCase()}${list.length ? ` · ${list.length} NOTE${list.length > 1 ? "S" : ""}` : ""}`;
}

// ---- the file -------------------------------------------------------------------------------------------

function save() {
  const name = loaded ? "creature" : `creature-${formatSeed(spec.seed)}`;
  download(`${name}.json`, creatureJson(spec));
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
  loaded = true;
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
document.getElementById("reseed").addEventListener("click", () => { seed = randomSeed(); regenerate(); render(); });
document.getElementById("rewobble").addEventListener("click", () => {
  // The same individual drawn by a different hand — the wobble seed is what every stroke's shake comes off.
  spec = derive({ ...spec, proportions: { ...spec.proportions, wobbleSeed: randomSeed() % 65536 } });
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
  if (key === "r") document.getElementById("reseed").click();
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
