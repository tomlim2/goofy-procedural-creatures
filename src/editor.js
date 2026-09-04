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
import { PALETTE } from "./character/vocabulary/palette.js";
import { bindSeg, addOption, randomRoll, runLoop, download } from "./ui.js";
import { paintBall } from "./balls.js";

const canvas = document.getElementById("stage");
const speciesSel = document.getElementById("speciesSel");
const stateSel = document.getElementById("stateSel");
const statusLabel = document.getElementById("status");
const poseSeg = document.getElementById("poseSeg");
const baseBox = document.getElementById("base");
const partsBox = document.getElementById("parts");
const paletteBox = document.getElementById("palette");
const proportionsBox = document.getElementById("proportions");
const notesBox = document.getElementById("notes");
const fileInput = document.getElementById("file");

// One palette for the whole screen — PALETTE (vocabulary/palette.js): every colour a creature can carry — a line
// ink, a skin, a fur, a dark, a scale, an accent, a pop, a hair, the imp's ink — pool by pool, each colour once.
// The generator deals each key from a pool of its own (a human's skin from FILLS, a rex's from SCALES) and snaps
// every derived tone to the nearest entry, so a creature's colours always answer to these swatches; those odds
// are the board's business and stay with it. Here a key is a key, and any colour goes in any of them.
// `pop` alone leads with a `null` for "no accent at all", which is what most individuals have. `pattern2` is the
// rex's second scale colour and is meaningless on anything else.
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

// **On this screen every material is its own.** The board rolls a body that may follow the main's tool or step
// (`same` in bodyMaterial / bodyDensity — one hand through); here that is resolved into the value it stands for
// when a creature enters, by roll or by file, so from then on editing the main moves the main and nothing else.
// The drawing is the same either way; what is saved carries the resolved values.
function asOwn(next) {
  const p = next.parts;
  const bodyMaterial = p.bodyMaterial && p.bodyMaterial !== "same" ? p.bodyMaterial : p.material;
  const bodyDensity = p.bodyDensity && p.bodyDensity !== "same" ? p.bodyDensity : p.density;
  return derive({ ...next, parts: { ...p, bodyMaterial, bodyDensity } });
}

// A creature made here starts from its roll, its body's material and step its own (asOwn).
function regenerate() {
  spec = asOwn(makeCreature(roll, species));
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

// A row with a name in the left column — or, with label null, a **bare** row: no name, the control fills
// the width. The material panel's rows are bare (a shader ball, sample balls, a stepped slider and swatches
// say what they are; a word beside them said it again)
function field(parent, label) {
  const row = document.createElement("label");
  row.className = label === null ? "field bare" : "field";
  if (label !== null) {
    const name = document.createElement("span");
    name.textContent = label;
    row.appendChild(name);
  }
  parent.appendChild(row);
  return row;
}

// **The part is the unit.** One part is open at a time, and the deck shows only what that part has: its
// form, and — for a part that is painted — which of the individual's own colours it takes. Parts that paint
// more than one thing are inspected one by one before they get a second colour (vocabulary/paint.js).
// **The base is not a part.** It is what the creature is made of before any part is put on it: the main material
// material — a colour (the skin box), a goofy material, and the density it is laid at. The card reads the way
// a 3D program's material panel does: a ball previewing the three together, the materials as sample balls in
// the creature's own colour and density, the density as a stepped slider, then the colour. The two slots leave
// the part list for this card; the palette card, folded away by default, carries the same colour box.
// The slots the MATERIALS card owns — the main material and its density, the body's material and its density
const MATERIAL_SLOTS = ["material", "density", "bodyMaterial", "bodyDensity"];
const MATERIALS = SLOTS.material;    // graphite · ink · oil · charcoal
// The density scale as the slider lays it: **low on the left, high on the right** — light · stipple · scribble · hatch · black.
// The slot lists the steps the other way round (dark to light, medium/materials.js VALUES); that order is the roll's and stays
const DENSITIES = [...SLOTS.density].reverse();

// A row that is not a <label>: a label activates its first button on any click, and these rows hold many.
function fieldRow(parent, label, className = "field") {
  const row = document.createElement("div");
  row.className = label === null ? `${className} bare` : className;
  if (label !== null) {
    const name = document.createElement("span");
    name.textContent = label;
    row.appendChild(name);
  }
  parent.appendChild(row);
  return row;
}
// A strip of sample balls, one per texture name
function ballStrip(parent, names, onPick, kind = "texture") {
  const row = fieldRow(parent, null, "field balls");
  const strip = document.createElement("div");
  strip.className = "strip";
  const balls = {};
  for (const name of names) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "ball";
    item.title = name;
    item.setAttribute("aria-label", `${kind} ${name}`);
    const canvas = document.createElement("canvas");
    item.appendChild(canvas);
    item.addEventListener("click", () => onPick(name));
    strip.appendChild(item);
    balls[name] = { item, canvas };
  }
  row.appendChild(strip);
  return { row, balls };
}

// ---- MATERIALS ------------------------------------------------------------------------------------------
//
// **Every material the creature wears, in one card.** A creature is made of two surfaces: the main material
// (`material` and `density` — everything on the head side takes it) and the body's (`bodyMaterial` and
// `bodyDensity` — everything hanging off the torso). Each is a material in the 3D sense — a texture, the
// density it is laid at and a colour — and **each is its own**: nothing here says one follows the other
// (asOwn). Each gets a preview card at the top; **the previews are the selection**: click one and the sections
// below edit that material — its name, the parts that wear it, its texture (the sample balls), its density
// (a slider, low to high), its colour (the skin box for the main, the cloth box for the body). Nothing on the body's
// surface is painted with a different colour; the parts that take a paint of their own (hair, a hat) still
// wear the main's texture, so they are listed under it.
const SURFACES = ["base", "body"];
// What a preview is called under its ball. The first is the main material; every material after it is numbered
// mat1, mat2 … until it is given a name (a spec carries none yet — `materialNames[side]` is where one would go)
const captionOf = (side, i) => (side === "base" ? "main" : (spec.materialNames && spec.materialNames[side]) || `mat${i}`);
// Which parts wear which surface (drawing.md § what takes the goofy material) — the head side and the body
// side. Listed only when the creature has the part (a slot at none, a quad's arms, a tailless biped's tail)
const SURFACE_PARTS = { base: ["head", "ears", "horns", "hair", "headgear", "nose"], body: ["body", "arms", "legs", "tail"] };
let surface = "base";
const mat = { previews: {}, sect: {}, strips: {}, density: null, colourRows: {} };

function presentParts(side) {
  const identity = (SPECIES.find((s) => s.name === spec.species) || {}).identity || {};
  const quad = identity.skeleton === "quad";
  return SURFACE_PARTS[side].filter((slot) => {
    if (slot === "arms") return !quad && spec.parts.arms !== "none";
    if (slot === "tail") return identity.tail === true;
    if (slot === "legs" || slot === "body" || slot === "head") return true;
    return spec.parts[slot] !== undefined && spec.parts[slot] !== "none";
  });
}

// A section of the card, three lines: its name, what is applied (a line of its own), then the control
function section(parent, name) {
  const head = document.createElement("div");
  head.className = "sect";
  const label = document.createElement("span");
  label.textContent = name;
  head.appendChild(label);
  const val = document.createElement("output");
  val.className = "val";
  head.appendChild(val);
  parent.appendChild(head);
  return val;
}

function buildMaterials() {
  baseBox.innerHTML = "";
  // The previews — one card per surface: its ball and its name, and the one being edited framed
  const previews = fieldRow(baseBox, null, "field previews");
  const strip = document.createElement("div");
  strip.className = "strip";
  // Each preview is one card — the ball and its name together — and the card is the button
  for (const side of SURFACES) {
    const wrap = document.createElement("button");
    wrap.type = "button";
    wrap.className = "pv";
    wrap.title = side === "base" ? "main" : "body";
    wrap.setAttribute("aria-label", `edit the ${wrap.title} material`);
    wrap.addEventListener("click", () => { surface = side; renderMaterials(); });
    const item = document.createElement("div");
    item.className = "ball preview";
    const canvas = document.createElement("canvas");
    item.appendChild(canvas);
    wrap.appendChild(item);
    const cap = document.createElement("span");   // the material's name, under its ball
    cap.className = "cap";
    wrap.appendChild(cap);
    strip.appendChild(wrap);
    mat.previews[side] = { wrap, item, canvas, cap };
  }
  previews.appendChild(strip);

  // NAME — what the selected material is called (the caption under its ball); USED BY — the parts that wear it
  mat.sect.name = section(baseBox, "NAME");
  mat.sect.uses = section(baseBox, "USED BY");

  // TEXTURE — the applied one on its line, the four samples under it, one strip per material
  mat.sect.texture = section(baseBox, "TEXTURE");
  mat.strips.base = ballStrip(baseBox, MATERIALS, (name) => {
    spec = derive({ ...spec, parts: { ...spec.parts, material: name } });
    render();
  });
  mat.strips.body = ballStrip(baseBox, MATERIALS, (name) => {
    spec = derive({ ...spec, parts: { ...spec.parts, bodyMaterial: name } });
    render();
  });

  // DENSITY — the main's is `density`, the body's `bodyDensity`: one slider, low on the left and high on the right,
  // writing whichever is selected. (Five sample balls, one per step, were tried: at 28px the steps of a wash all look alike)
  mat.sect.density = section(baseBox, "DENSITY");
  const densityRow = field(baseBox, null);
  mat.density = document.createElement("input");
  mat.density.type = "range";
  mat.density.min = "0";
  mat.density.max = String(DENSITIES.length - 1);
  mat.density.step = "1";
  mat.density.setAttribute("aria-label", "density");
  mat.density.addEventListener("input", () => {
    const slot = surface === "base" ? "density" : "bodyDensity";
    spec = derive({ ...spec, parts: { ...spec.parts, [slot]: DENSITIES[Number(mat.density.value)] } });
    render();
  });
  densityRow.appendChild(mat.density);

  // COLOUR — the base's is the skin box, the body's the cloth box
  mat.sect.colour = section(baseBox, "COLOUR");
  mat.colourRows.base = paletteRow(baseBox, "skin", null);
  mat.colourRows.body = paletteRow(baseBox, "cloth", null);
}

function renderMaterials() {
  const { material, density } = spec.parts;
  // Its own on this screen (asOwn); a `same` is still read as what it stands for, in case one reaches here
  const bodyMaterial = spec.parts.bodyMaterial && spec.parts.bodyMaterial !== "same" ? spec.parts.bodyMaterial : material;
  const bodyDensity = spec.parts.bodyDensity && spec.parts.bodyDensity !== "same" ? spec.parts.bodyDensity : density;
  // Both previews, whichever is selected — the card shows every material the creature wears
  paintBall(mat.previews.base.canvas, { color: spec.palette0.skin, material, density, phase: 0, size: 72 });
  paintBall(mat.previews.body.canvas, { color: spec.palette0.cloth, material: bodyMaterial, density: bodyDensity, phase: 40, size: 72 });
  SURFACES.forEach((side, i) => {
    mat.previews[side].wrap.classList.toggle("on", side === surface);
    mat.previews[side].cap.textContent = captionOf(side, i);
  });

  const isBase = surface === "base";
  mat.sect.name.textContent = captionOf(surface, SURFACES.indexOf(surface));
  mat.sect.uses.textContent = presentParts(surface).join(" · ");

  mat.sect.texture.textContent = isBase ? material : bodyMaterial;
  mat.strips.base.row.hidden = !isBase;
  mat.strips.body.row.hidden = isBase;
  if (isBase) {
    MATERIALS.forEach((name, i) => {
      const b = mat.strips.base.balls[name];
      paintBall(b.canvas, { color: spec.palette0.skin, material: name, density, phase: 1 + i });
      b.item.classList.toggle("on", name === material);
    });
  } else {
    MATERIALS.forEach((name, i) => {
      const b = mat.strips.body.balls[name];
      paintBall(b.canvas, { color: spec.palette0.cloth, material: name, density: bodyDensity, phase: 41 + i });
      b.item.classList.toggle("on", name === bodyMaterial);
    });
  }

  const step = isBase ? density : bodyDensity;
  mat.sect.density.textContent = step;
  mat.density.value = String(Math.max(0, DENSITIES.indexOf(step)));

  const box = isBase ? "skin" : "cloth";
  mat.sect.colour.textContent = `${box} ${spec.palette0[box] || ""}`;
  mat.colourRows.base.hidden = !isBase;
  mat.colourRows.body.hidden = isBase;
}

// The body is clothing: what is put on it brings its own surface (bodyMaterial) and its own pressure (bodyDensity),
// each its own on this screen (asOwn). Those slots leave the part list; they are edited in MATERIALS.
// **Colour belongs to the material.** The main material is a colour (the skin box), a material and a
// density; the body's material is its own colour (the cloth box) and its own material, or the main material's. So
// these parts take no paint row: their colour is their material's. Only a part with no material of its own —
// the hair, the headgear — is painted from one of the creature's boxes.
const MATERIAL_PARTS = ["head", "ears", "body"];
const PAINTED = PAINTABLE.filter((slot) => !MATERIAL_PARTS.includes(slot));
// The ghost is not a part but a state of the whole creature — it sits under SPECIES as its own dropdown
// (NORMAL, then GHOST), not in the part list.
const STATE_SLOT = "ghost";
const stateName = (value) => (value === "none" ? "NORMAL" : "GHOST");
const PART_SLOTS = Object.keys(SLOTS).filter((slot) => !MATERIAL_SLOTS.includes(slot) && slot !== STATE_SLOT);
let part = PART_SLOTS[0];
let partSel = null;
let formSel = null;
let paintRow = null;
let paintStrip = null;
// The boxes a part may be painted from. `pattern2` is a mark, not a surface; `ink` is the line, never a fill
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

// The open part's controls, from the spec: the form list, and for a part with no material of its own the
// paint boxes, drawn in the individual's own colours with the one it currently takes ringed. A box the
// individual does not have (a pop on one without) is not offered. The body's material is MATERIALS' business
function renderPart() {
  partSel.value = part;
  formSel.innerHTML = "";
  for (const value of SLOTS[part]) addOption(formSel, value, value);
  formSel.value = spec.parts[part];

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
// main material's colour and the body material's colour, so all of them show the same choice ringed.
function paletteRow(parent, key, label = key) {
  const row = document.createElement("div");
  row.className = label === null ? "field swatches bare" : "field swatches";
  row.dataset.key = key;
  if (label !== null) {
    const name = document.createElement("span");
    name.textContent = label;
    row.appendChild(name);
  }
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
  stateSel.value = spec.parts[STATE_SLOT];

  renderMaterials();
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

  // The one creature is swapped in place, and its clock carries over when the change was to its surface — a
  // material, a step, a colour, a paint: a body that was walking keeps walking. A change to what moves — the
  // species, the ghost state, a limb's form or length, a proportion, a new roll — is a new clock (scene replace)
  if (scene.creatures().length) scene.replace(0, spec, { keepClock: true });
  else scene.build([spec], 1);
  scene.setBind(bind);
  statusLabel.textContent = `${spec.species.toUpperCase()}${list.length ? ` · ${list.length} NOTE${list.length > 1 ? "S" : ""}` : ""}`;
}

// ---- the file -------------------------------------------------------------------------------------------

// Named by species; the browser numbers a second cat. The file is the creature.
function save() {
  download(`${spec.species}.json`, creatureJson(spec));
}

// A loaded spec is drawn as it is (a body's `same` resolved into what it stands for — asOwn — draws the same) —
// the same file the board saves from a cell, or a board file's one cell. It
// is only checked for what the drawing cannot do without (character/file.js), and the reason it was refused
// takes the status label's place.
function load(text) {
  const read = readCreature(text);
  if (read.error || isHouse(read.spec)) {
    statusLabel.textContent = read.error || "NOT A CREATURE";
    return;
  }
  spec = asOwn(read.spec);
  species = spec.species;
  render();
}

// ---- wiring ---------------------------------------------------------------------------------------------

for (const s of SPECIES) addOption(speciesSel, s.name, s.name.toUpperCase());
for (const value of SLOTS[STATE_SLOT]) addOption(stateSel, value, stateName(value));
buildMaterials();
buildParts();
buildPalette();
buildProportions();

// Changing the species draws a new individual of it. Every species has its own palette rules — an imp's head is
// ink and a rex is two scale colours — so carrying the old colours across would give a creature no species
// would ever wear, and the flow here is species first, parts after.
speciesSel.addEventListener("change", () => { species = speciesSel.value; regenerate(); render(); });
// The state keeps the individual: a ghost is the same creature under one pale tone (palette0 holds its colours)
stateSel.addEventListener("change", () => {
  spec = derive({ ...spec, parts: { ...spec.parts, [STATE_SLOT]: stateSel.value } });
  render();
});
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
