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
import { WEARABLE, wearOf, extraOf, materialKeys } from "./character/vocabulary/wear.js";
import { PALETTE } from "./character/vocabulary/palette.js";
import { bindSeg, addOption, randomRoll, runLoop, download } from "./ui.js";
import { paintBall } from "./balls.js";
import { paintPart } from "./thumbs.js";

const canvas = document.getElementById("stage");
const speciesSel = document.getElementById("speciesSel");
const stateSel = document.getElementById("stateSel");
const statusLabel = document.getElementById("status");
const poseSeg = document.getElementById("poseSeg");
const baseBox = document.getElementById("base");
const partsBox = document.getElementById("parts");
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
// the part list for this card; MATERIALS carries the colour boxes themselves.
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
// **Every material the creature wears, in one card.** The roll deals two — the main material (`material` and
// `density`, its colour the skin box — everything on the head side takes it) and the body's (`bodyMaterial` and
// `bodyDensity`, its colour the cloth box — everything hanging off the torso) — and a hand may add any number
// more: each a name, a texture, a density and a colour of its own (`spec.materials`, vocabulary/wear.js). A
// new one is made where it is worn — under a part, material → **+** — as a copy of what the part had on, and
// the part wears it from then on; it is edited here. Each is a material in the 3D sense — a
// texture, the density it is laid at and a colour — and **each is its own**: nothing here says one follows
// another (asOwn). Each gets a preview card at the top; **the previews are the selection**: click one and the
// sections below edit that material — its name, the parts that wear it, its texture (the sample balls), its
// density (a slider, low to high), its colour. A part is put in a material under PART → material.
let selected = "main";   // the material being edited — main, body, or one of the hand's own (m1, m2 …)
const mat = { previews: null, name: null, sect: {}, strip: null, density: null, colourRows: {}, ownColours: null };

// What a material is called under its ball: the roll's two are main and mat1 until named
// (`spec.materialNames`); a hand's own carries its name, and is mat2, mat3 … until it has one
function captionOf(key) {
  if (key === "main" || key === "body") return (spec.materialNames && spec.materialNames[key]) || (key === "main" ? "main" : "mat1");
  const extra = extraOf(spec, key);
  return (extra && extra.name) || `mat${materialKeys(spec).indexOf(key)}`;
}
// A material's three — texture, density, colour — whichever kind it is. Its own on this screen (asOwn); a
// `same` is still read as what it stands for, in case one reaches here
function surfaceOf(key) {
  const p = spec.parts;
  if (key === "main") return { texture: p.material, density: p.density, colour: spec.palette0.skin };
  if (key === "body") {
    return {
      texture: p.bodyMaterial && p.bodyMaterial !== "same" ? p.bodyMaterial : p.material,
      density: p.bodyDensity && p.bodyDensity !== "same" ? p.bodyDensity : p.density,
      colour: spec.palette0.cloth
    };
  }
  const extra = extraOf(spec, key) || {};
  return { texture: extra.texture || p.material, density: extra.density || p.density, colour: extra.colour || spec.palette0.skin };
}
// Writes one of a material's three back where it lives: the main's and the body's in their slots and boxes,
// a hand's own in `spec.materials`
function setSurface(key, what, value) {
  if (key === "main" || key === "body") {
    if (what === "colour") spec = derive({ ...spec, palette0: { ...spec.palette0, [key === "main" ? "skin" : "cloth"]: value } });
    else {
      const slot = key === "main" ? (what === "texture" ? "material" : "density") : (what === "texture" ? "bodyMaterial" : "bodyDensity");
      spec = derive({ ...spec, parts: { ...spec.parts, [slot]: value } });
    }
  } else {
    spec = derive({ ...spec, materials: { ...spec.materials, [key]: { ...spec.materials[key], [what]: value } } });
  }
  render();
}
function setName(key, name) {
  const trimmed = name.trim();
  if (key === "main" || key === "body") {
    const names = { ...(spec.materialNames || {}) };
    if (trimmed) names[key] = trimmed;
    else delete names[key];
    spec = derive({ ...spec, materialNames: names });
  } else {
    spec = derive({ ...spec, materials: { ...spec.materials, [key]: { ...spec.materials[key], name: trimmed } } });
  }
  render();
}
// + under a part — a new material of the hand's own, a copy of what the part had on to start from; the part
// wears it from then on, and MATERIALS opens it for editing
function addMaterialFor(part) {
  const keys = Object.keys(spec.materials || {});
  let n = 1;
  while (keys.includes(`m${n}`)) n += 1;
  const key = `m${n}`;
  const { texture, density, colour } = surfaceOf(wearOf(spec, part));
  spec = derive({
    ...spec,
    materials: { ...(spec.materials || {}), [key]: { name: "", texture, density, colour } },
    wear: { ...(spec.wear || {}), [part]: key }
  });
  selected = key;
  render();
}

// Is this part on the creature at all — a slot at none, a quad's arms, a tailless biped's tail are not
function present(slot) {
  const identity = (SPECIES.find((s) => s.name === spec.species) || {}).identity || {};
  const quad = identity.skeleton === "quad";
  if (slot === "arms") return !quad && spec.parts.arms !== "none";
  if (slot === "tail") return identity.tail === true;
  if (slot === "legs" || slot === "body" || slot === "head") return true;
  return spec.parts[slot] !== undefined && spec.parts[slot] !== "none";
}
// The parts that wear this material (wear.js — the drawing's side by default, the hand's choice when it put a
// part elsewhere), of those the creature has
function presentParts(key) {
  return WEARABLE.filter((slot) => wearOf(spec, slot) === key && present(slot));
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
// One material card — its ball and its name, the card the button
function materialCard(key, size, phase, onPick) {
  const s = surfaceOf(key);
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.className = "pv";
  wrap.title = captionOf(key);
  wrap.addEventListener("click", () => onPick(key));
  const item = document.createElement("div");
  item.className = "ball preview";
  const canvas = document.createElement("canvas");
  item.appendChild(canvas);
  wrap.appendChild(item);
  const cap = document.createElement("span");
  cap.className = "cap";
  cap.textContent = captionOf(key);
  wrap.appendChild(cap);
  paintBall(canvas, { color: s.colour, material: s.texture, density: s.density, phase, size });
  return wrap;
}
// A strip of swatches off the one palette with no box behind it — a hand's own material's colour
function swatchRow(parent, onPick) {
  const row = fieldRow(parent, null, "field swatches");
  const strip = document.createElement("div");
  strip.className = "strip";
  for (const color of PALETTE) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "swatch";
    dot.dataset.color = color;
    dot.title = color;
    dot.setAttribute("aria-label", `colour ${color}`);
    dot.style.background = color;
    dot.addEventListener("click", () => onPick(color));
    strip.appendChild(dot);
  }
  row.appendChild(strip);
  return row;
}

function buildMaterials() {
  baseBox.innerHTML = "";
  // The previews — one card per material and + at the end; filled on render, since a hand adds to them
  mat.previews = fieldRow(baseBox, null, "field previews");

  // NAME — typed over its line; empty takes the numbering back. USED BY — the parts that wear it
  const nameVal = section(baseBox, "NAME");
  mat.name = document.createElement("input");
  mat.name.type = "text";
  mat.name.className = "val";
  mat.name.maxLength = 24;
  mat.name.spellcheck = false;
  mat.name.setAttribute("aria-label", "the material's name");
  mat.name.addEventListener("change", () => setName(selected, mat.name.value));
  mat.name.addEventListener("keydown", (event) => { if (event.key === "Enter") mat.name.blur(); });
  nameVal.replaceWith(mat.name);
  mat.sect.uses = section(baseBox, "USED BY");

  // TEXTURE — the applied one on its line, the samples under it, in the selected material's colour and density
  mat.sect.texture = section(baseBox, "TEXTURE");
  mat.strip = ballStrip(baseBox, MATERIALS, (name) => setSurface(selected, "texture", name));

  // DENSITY — one slider, low on the left and high on the right, writing whichever material is selected. (Five
  // sample balls, one per step, were tried: at 28px the steps of a wash all look alike)
  mat.sect.density = section(baseBox, "DENSITY");
  const densityRow = field(baseBox, null);
  mat.density = document.createElement("input");
  mat.density.type = "range";
  mat.density.min = "0";
  mat.density.max = String(DENSITIES.length - 1);
  mat.density.step = "1";
  mat.density.setAttribute("aria-label", "density");
  mat.density.addEventListener("input", () => setSurface(selected, "density", DENSITIES[Number(mat.density.value)]));
  densityRow.appendChild(mat.density);

  // COLOUR — the main's is the skin box, the body's the cloth box, a hand's own material's is its own
  mat.sect.colour = section(baseBox, "COLOUR");
  mat.colourRows.main = paletteRow(baseBox, "skin", null);
  mat.colourRows.body = paletteRow(baseBox, "cloth", null);
  mat.ownColours = swatchRow(baseBox, (color) => setSurface(selected, "colour", color));
}

function renderMaterials() {
  const keys = materialKeys(spec);
  if (!keys.includes(selected)) selected = "main";
  // The previews — every material the creature wears, the one being edited framed. A new one is made under a
  // part (material → +), not here
  const strip = document.createElement("div");
  strip.className = "strip";
  keys.forEach((key, i) => {
    const card = materialCard(key, 72, i * 40, (picked) => { selected = picked; renderMaterials(); });
    card.setAttribute("aria-label", `edit the material ${captionOf(key)}`);
    card.classList.toggle("on", key === selected);
    strip.appendChild(card);
  });
  mat.previews.replaceChildren(strip);

  const s = surfaceOf(selected);
  const own = extraOf(spec, selected);
  mat.name.value = own ? own.name || "" : (spec.materialNames && spec.materialNames[selected]) || "";
  mat.name.placeholder = captionOf(selected);
  mat.sect.uses.textContent = presentParts(selected).join(" · ") || "nothing yet — under a part, material";

  mat.sect.texture.textContent = s.texture;
  MATERIALS.forEach((name, i) => {
    const b = mat.strip.balls[name];
    paintBall(b.canvas, { color: s.colour, material: name, density: s.density, phase: 1 + i });
    b.item.classList.toggle("on", name === s.texture);
  });

  mat.sect.density.textContent = s.density;
  mat.density.value = String(Math.max(0, DENSITIES.indexOf(s.density)));

  const box = selected === "main" ? "skin" : selected === "body" ? "cloth" : null;
  mat.sect.colour.textContent = `${box ? `${box} ` : ""}${s.colour || ""}`;
  mat.colourRows.main.hidden = selected !== "main";
  mat.colourRows.body.hidden = selected !== "body";
  mat.ownColours.hidden = !!box;
  for (const dot of mat.ownColours.querySelectorAll(".swatch")) dot.classList.toggle("on", dot.dataset.color === s.colour);
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
const tabs = {};        // part → { item, canvas } — the icon tabs down the left
let formsBox = null;    // where the open part's preview grid stands
let mode = "shape";     // under the open part: shape (its forms) or material (which of the creature's materials it wears)
const modeTabs = {};    // mode → the tab button
let wearBox = null;     // the MATERIAL panel: the creature's materials as cards, the one this part wears framed
let wearStrip = null;   // the cards, one per material, rebuilt on render — a hand adds materials
let wearAdd = null;     // the line under them, holding + — on its own line, under the first card
let wearNote = null;    // for a part that wears none
const grids = {};       // `${species}/${part}` → { box, forms: value → { item, canvas } } — each grid built and painted once, kept
let gridKey = null;     // the grid standing in formsBox
const tabImages = {};   // species → slot → an offscreen canvas of the painted icon — painted once, blitted back on return
let paintRow = null;
let paintStrip = null;
// The boxes a part may be painted from. `pattern2` is a mark, not a surface; `ink` is the line, never a fill
const PAINT_BOXES = ["skin", "cloth", "hair", "accent", "pop"];
// Which parts a species draws at all — a tail only where the identity has one, arms only on a biped (the same
// rule USED BY goes by). A tab for a part the species never draws would be an empty icon
function partApplies(slot, name) {
  const identity = (SPECIES.find((s) => s.name === name) || {}).identity || {};
  if (slot.startsWith("tail")) return identity.tail === true;
  if (slot === "arms" || slot === "armLength") return identity.skeleton !== "quad";
  return true;
}
const TAB_SIZE = 34;    // CSS pixels — the icon on a part tab
const FORM_SIZE = 44;   // CSS pixels — a form preview: four to a row under the tabs

// **The part is picked by its picture, and the pictures are a legend.** A tab per part down the left, each an icon
// of the part, and the open part's forms as a grid of previews, each one value drawn, the current one framed. The
// pictures are not the creature being edited: they are a **reference individual** of the species — one fixed roll
// with the parts that share a layer quieted (no hat, no hair, no eyewear, no nose, no pattern) — drawn once with
// **everything but the part hidden** (thumbs.js — the real drawing, framed on the region the part lives in) and
// left alone. Rendering them off the
// live creature on every edit was tried: a build per slider tick, and icons that changed under the hand
const REFERENCE_ROLL = 4242;
const REFERENCE_PARTS = { headgear: "none", eyewear: "none", hair: "none", face2: "none", pattern: "none", ghost: "none", tailDeco: "none", brow: "none", nose: "none", material: "graphite", density: "light" };
// A tab shows its part at a value that has something to show: the reference's own unless that is none, then the
// slot's first value that is not
const representativeOf = (name, slot) => {
  const own = referenceOf(name).parts[slot];
  return own !== "none" ? own : SLOTS[slot].find((v) => v !== "none") || own;
};
const references = {};
function referenceOf(name) {
  if (!references[name]) {
    const made = makeCreature(REFERENCE_ROLL, name);
    references[name] = derive({ ...made, parts: { ...made.parts, ...REFERENCE_PARTS, bodyMaterial: "graphite", bodyDensity: "light" } });
  }
  return references[name];
}
function buildParts() {
  partsBox.innerHTML = "";
  const card = document.createElement("div");
  card.className = "partCard";
  const strip = document.createElement("div");
  strip.className = "tabs";
  strip.setAttribute("role", "tablist");
  strip.setAttribute("aria-label", "Part");
  for (const slot of PART_SLOTS) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "tab";
    item.title = slot;
    item.setAttribute("role", "tab");
    item.setAttribute("aria-label", `part ${slot}`);
    const canvas = document.createElement("canvas");
    item.appendChild(canvas);
    const cap = document.createElement("span");
    cap.textContent = slot;
    item.appendChild(cap);
    item.addEventListener("click", () => { part = slot; renderPart(); });
    strip.appendChild(item);
    tabs[slot] = { item, canvas };
  }
  card.appendChild(strip);
  // Under the part: SHAPE — its forms and, for a painted part, its paint — or MATERIAL — which of the creature's
  // materials it wears. The same kind of strip, and one panel that shows one of them
  const modes = document.createElement("div");
  modes.className = "tabs modes";
  modes.setAttribute("role", "tablist");
  modes.setAttribute("aria-label", "Shape or material");
  for (const name of ["shape", "material"]) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab mode";
    tab.setAttribute("role", "tab");
    tab.textContent = name;
    tab.addEventListener("click", () => { mode = name; renderPart(); });
    modes.appendChild(tab);
    modeTabs[name] = tab;
  }
  card.appendChild(modes);
  const panel = document.createElement("div");
  panel.className = "modePanel";
  formsBox = document.createElement("div");   // the open part's grid stands here; the grids themselves are kept (gridOf)
  formsBox.className = "formsSlot";
  panel.appendChild(formsBox);
  paintRow = document.createElement("div");
  paintRow.className = "field swatches";
  const name = document.createElement("span");
  name.textContent = "paint";
  paintRow.appendChild(name);
  paintStrip = document.createElement("div");
  paintStrip.className = "strip";
  paintRow.appendChild(paintStrip);
  panel.appendChild(paintRow);
  // MATERIAL — the creature's materials, as the cards MATERIALS shows, here only to be picked from: the part's
  // material is whichever is framed, and a click puts the part in another (spec.wear). Editing a material is
  // MATERIALS' business, in one place. The cards are laid on render — a hand adds materials
  wearBox = document.createElement("div");
  wearBox.className = "wear";
  wearStrip = document.createElement("div");
  wearStrip.className = "strip";
  wearBox.appendChild(wearStrip);
  wearAdd = document.createElement("div");
  wearAdd.className = "strip addRow";
  wearBox.appendChild(wearAdd);
  wearNote = document.createElement("output");
  wearNote.className = "readout";
  wearBox.appendChild(wearNote);
  panel.appendChild(wearBox);
  card.appendChild(panel);
  partsBox.appendChild(card);
}

// **The legend is painted once, ahead, and kept.** One queue of paint jobs, one build per frame, so the deck never
// freezes: when a species comes on the stage its tabs go in first (a build per tab, into offscreen canvases that are
// blitted onto the tabs — coming back to the species blits them again and builds nothing), then the open part's
// preview grid, then every other part's grid in tab order, so by the time a tab is clicked its previews are
// there. Opening a part whose previews are still pending moves them to the front. Nothing is painted on an edit,
// and nothing twice
let thumbSpecies = null;
const queue = [];        // [{ key, run }] — key is `${species}/${part}` (or `${species}/tabs`)
let pumping = false;
function enqueue(key, run) {
  queue.push({ key, run });
  if (!pumping) { pumping = true; requestAnimationFrame(pump); }
}
function pump() {
  const job = queue.shift();
  if (job) job.run();
  if (queue.length) requestAnimationFrame(pump);
  else pumping = false;
}
function prioritise(key) {   // the open part's jobs first
  const mine = queue.filter((j) => j.key === key);
  if (!mine.length) return;
  const rest = queue.filter((j) => j.key !== key);
  queue.length = 0;
  queue.push(...mine, ...rest);
}
const blit = (from, to) => {
  to.width = from.width;
  to.height = from.height;
  to.style.width = from.style.width;
  to.style.height = from.style.height;
  to.getContext("2d").drawImage(from, 0, 0);
};
function paintTabs() {
  const name = spec.species;
  const images = tabImages[name] || (tabImages[name] = {});
  const at = referenceOf(name);
  const slots = PART_SLOTS.filter((slot) => partApplies(slot, name));
  for (const slot of slots) {
    if (images[slot]) { blit(images[slot], tabs[slot].canvas); continue; }   // kept from before
    enqueue(`${name}/tabs`, () => {
      if (images[slot]) return;
      const off = document.createElement("canvas");
      paintPart(off, derive({ ...at, parts: { ...at.parts, [slot]: representativeOf(name, slot) } }), slot, TAB_SIZE);
      images[slot] = off;
      if (spec.species === name) blit(off, tabs[slot].canvas);
    });
  }
}
// Every part's grid for the species, built and queued ahead — the open part's first (renderPart prioritises it)
function prepaint(name) {
  for (const slot of PART_SLOTS) if (partApplies(slot, name)) gridOf(name, slot);
}
// The preview grid of a part for a species — built and its paints queued the first time, kept after
function gridOf(name, slot) {
  const key = `${name}/${slot}`;
  if (grids[key]) return grids[key];
  const box = document.createElement("div");
  box.className = "forms";
  box.setAttribute("role", "listbox");
  box.setAttribute("aria-label", "Form");
  const forms = {};
  for (const value of SLOTS[slot]) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "form";
    item.title = value;
    item.setAttribute("role", "option");
    item.setAttribute("aria-label", `${slot} ${value}`);
    const canvas = document.createElement("canvas");
    item.appendChild(canvas);
    const cap = document.createElement("span");
    cap.textContent = value;
    item.appendChild(cap);
    item.addEventListener("click", () => {
      spec = derive({ ...spec, parts: { ...spec.parts, [slot]: value } });
      render();
    });
    box.appendChild(item);
    forms[value] = { item, canvas };
  }
  grids[key] = { box, forms };
  const at = referenceOf(name);
  for (const value of SLOTS[slot]) {
    enqueue(key, () => paintPart(forms[value].canvas, derive({ ...at, parts: { ...at.parts, [slot]: value } }), slot, FORM_SIZE));
  }
  return grids[key];
}

// The open part's controls, from the spec: its tab framed, the form previews (rebuilt when the part changes), and
// for a part with no material of its own the paint boxes, drawn in the individual's own colours with the one it
// currently takes ringed. A box the individual does not have (a pop on one without) is not offered
function renderPart() {
  for (const slot of PART_SLOTS) tabs[slot].item.hidden = !partApplies(slot, spec.species);
  if (!partApplies(part, spec.species)) part = PART_SLOTS[0];   // the open part left with the species — back to the head
  for (const slot of PART_SLOTS) tabs[slot].item.classList.toggle("on", slot === part);
  tabs[part].item.scrollIntoView({ block: "nearest", inline: "nearest" });   // the strip scrolls sideways; the open tab stays in view
  const key = `${spec.species}/${part}`;
  const grid = gridOf(spec.species, part);
  if (thumbSpecies !== spec.species) {   // a new species is a new legend — or one kept from before
    thumbSpecies = spec.species;
    paintTabs();
    prioritise(`${spec.species}/tabs`);
    prepaint(spec.species);
  }
  if (gridKey !== key) {
    formsBox.replaceChildren(grid.box);
    gridKey = key;
    prioritise(key);
  }
  for (const value of SLOTS[part]) grid.forms[value].item.classList.toggle("on", value === spec.parts[part]);

  // SHAPE or MATERIAL under the part
  for (const name of Object.keys(modeTabs)) modeTabs[name].classList.toggle("on", name === mode);
  formsBox.hidden = mode !== "shape";
  wearBox.hidden = mode !== "material";
  if (mode === "material") {
    const wears = wearOf(spec, part);
    wearStrip.replaceChildren();
    if (wears) {
      materialKeys(spec).forEach((key, i) => {
        const card = materialCard(key, 48, i * 40, (picked) => {
          spec = derive({ ...spec, wear: { ...(spec.wear || {}), [part]: picked } });
          render();
        });
        card.setAttribute("aria-label", `${part} wears ${captionOf(key)}`);
        card.classList.toggle("on", key === wears);
        wearStrip.appendChild(card);
      });
      // + — a new material for this part: a copy of what it has on, worn at once, opened in MATERIALS. On the
      // line under the cards
      const add = document.createElement("button");
      add.type = "button";
      add.className = "pv add";
      add.title = `a new material for the ${part} — a copy of what it has on`;
      add.setAttribute("aria-label", `a new material for the ${part}`);
      const plus = document.createElement("span");
      plus.className = "plus";
      plus.setAttribute("aria-hidden", "true");
      plus.textContent = "+";
      add.appendChild(plus);
      const cap = document.createElement("span");
      cap.className = "cap";
      cap.textContent = "new";
      add.appendChild(cap);
      add.addEventListener("click", () => addMaterialFor(part));
      wearAdd.replaceChildren(add);
    } else wearAdd.replaceChildren();
    wearAdd.hidden = !wears;
    wearNote.textContent = wears ? "" : `${part} wears no material — a mark, an object with a colour of its own, or flat by rule`;
  }

  // A part in one of the hand's own materials is that material's colour: nothing to paint
  const paintable = PAINTED.includes(part) && !extraOf(spec, wearOf(spec, part));
  paintRow.hidden = mode !== "shape" || !paintable;
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

// One row of a palette box's pool — the swatches a key may be picked from: the main material's colour (the skin
// box) and the body material's (the cloth box). The other boxes — ink, hair, accent, pop, the rex's second scale —
// are the roll's; the PALETTE card that edited them was dropped as one card too many.
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
