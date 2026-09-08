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
// NOTES. What you picked is what gets drawn, so this screen can make individuals the board never will. The one
// thing the rules do decide here is what a SHAPE list offers: a value the species' rule only renames (a cat's
// perkBig is its pointyBig) is hidden, because its row drew a duplicate (menuOf)
//
//   editor.html?species=cat

import { createScene } from "./scene/index.js";
import {
  makeCreature, applyForbid, applyConstraints, applyLateConstraints,
  deriveSpec, readCreature, creatureJson, isHouse,
  SLOTS, SPECIES
} from "./character/index.js";
import { WEARABLE, wearOf, extraOf, materialKeys, isBox, BOXES, surfaceOf as wornSurface, regionsOf, partOf, REGION_LABEL } from "./character/vocabulary/wear.js";
import { MARKS } from "./character/vocabulary/palette.js";
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
  applyLateConstraints(constrained);   // the hair's rules — on the late slots, after the rest
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
// **Every material the creature wears, in one card.** A material is a palette box with a texture
// (vocabulary/wear.js): the roll deals skin, cloth, hair, accent, a pop when it has one, and the ink its marks
// are drawn in — each a colour, laid at the main material's texture and density, cloth at the body's — and a
// hand may add any number more: each a name, a texture, a density and a colour of its own. A new one is made
// where it is worn — under a part, material → **+**, a copy of what the part had on, worn at once — or with
// the + beside the title. Each is a material in the 3D sense — a texture, the density it is laid at and a
// colour — and **each is its own**: nothing here says one follows another (asOwn). Each gets a preview card
// at the top, in one row that scrolls sideways; **the previews are the selection**: click one and the
// sections below edit that material — its name, the parts that wear it, its texture (the sample balls), its
// density (a slider, low to high), its colour. A part is put in a material under PART → material.
let selected = "skin";   // the material being edited — a box, or one of the hand's own (m1, m2 …)
const mat = { previews: null, name: null, sect: {}, strip: null, density: null, colourRows: {}, ownColours: null };

// What a material is called under its ball: a box by its name until a hand names it (`spec.materialNames`);
// a hand's own carries its name, and is mat1, mat2 … until it has one
function captionOf(key) {
  if (isBox(key)) return (spec.materialNames && spec.materialNames[key]) || key;
  const own = extraOf(spec, key);
  if (own && own.name) return own.name;
  const owns = materialKeys(spec).filter((k) => !isBox(k));
  return `mat${owns.indexOf(key) + 1}`;
}
// A box's colour before the ghost collapse — what the swatches ring (palette0, the box edits are written into)
function boxColour0(box) {
  if (box === "pop") return (spec.palette0.pop && spec.palette0.pop.color) || null;
  if (box === "white") return (extraOf(spec, "white") || {}).colour || MARKS.white;   // no box behind it: its own, or the one white
  return spec.palette0[box] || null;
}
// A material's three — texture, density, colour — whichever kind it is
function surfaceOf(key) {
  const { texture, density } = wornSurface(spec, key);
  const colour = isBox(key) ? boxColour0(key) : (extraOf(spec, key) || {}).colour;
  return { texture, density, colour: colour || spec.palette0.skin };
}
// Writes one of a material's three back where it lives: skin's and cloth's texture and density in their slots,
// a box's colour in its palette box, any other box's texture and density and a hand's own material entire in
// `spec.materials`
function setSurface(key, what, value) {
  if (isBox(key) && key !== "white" && what === "colour") {
    // A pop is a colour **and** a target, so keep the target the individual already had
    const boxValue = key === "pop" ? { color: value, target: (spec.palette0.pop && spec.palette0.pop.target) || "hair" } : value;
    spec = derive({ ...spec, palette0: { ...spec.palette0, [key]: boxValue } });
  } else if (key === "skin" || key === "cloth") {
    const slot = key === "skin" ? (what === "texture" ? "material" : "density") : (what === "texture" ? "bodyMaterial" : "bodyDensity");
    spec = derive({ ...spec, parts: { ...spec.parts, [slot]: value } });
  } else {
    spec = derive({ ...spec, materials: { ...(spec.materials || {}), [key]: { ...(extraOf(spec, key) || {}), [what]: value } } });
  }
  render();
}
function setName(key, name) {
  const trimmed = name.trim();
  if (isBox(key)) {
    const names = { ...(spec.materialNames || {}) };
    if (trimmed) names[key] = trimmed;
    else delete names[key];
    spec = derive({ ...spec, materialNames: names });
  } else {
    spec = derive({ ...spec, materials: { ...spec.materials, [key]: { ...spec.materials[key], name: trimmed } } });
  }
  render();
}
// A new material of the hand's own, laid with the three given, keyed after the last. Returns its key
function newMaterial({ texture, density, colour }) {
  const keys = Object.keys(spec.materials || {});
  let n = 1;
  while (keys.includes(`m${n}`)) n += 1;
  const key = `m${n}`;
  spec = { ...spec, materials: { ...(spec.materials || {}), [key]: { name: "", texture, density, colour } } };
  return key;
}
// + beside MATERIALS — a new material, a copy of the one being edited, worn by nothing yet; opened for editing
function addMaterial() {
  selected = newMaterial(surfaceOf(selected));
  spec = derive(spec);
  render();
}

// ---- NEW MATERIAL · EDIT MATERIAL — the panel --------------------------------------------------------
//
// Under a part, the material list's + and every ✎ open a panel beside the deck rather than acting at once: **+**
// makes a new material for the surface and opens on it, **✎** opens on the material it stands by. The panel is the
// same either way — the ball the material is, then its three: TEXTURE (the sample balls), DENSITY (the slider, low
// to high), COLOUR (the palette's swatches). **A pick is the edit**: every one is written to the spec and drawn
// (setSurface — a box's colour into its palette box, skin's and cloth's texture and density into their slots, the
// rest into spec.materials), so the head goes green as the swatch is clicked, and there is nothing to confirm — a
// pointer put down off the panel, or Escape, closes it, and what stands, stands. It had CANCEL · MAKE/SAVE and a
// backdrop dimming the page: the buttons were a second step after a pick that was already the change, and the dim
// hid the very colour just picked. So it is a plain dialog (show, not showModal) — no backdrop, the page under it
// alive. The rows are MATERIALS' own (ballStrip, swatchRow, the .sect line), so the two read the same
const draftDialog = document.getElementById("newMaterial");
const draftBox = document.getElementById("newMaterialFields");
let draft = null;   // { mode: "new" | "edit", region, key } while the panel is up
const draftUi = { title: null, partLabel: null, part: null, ball: null, cap: null, sect: {}, strip: null, slider: null, swatches: null };
function buildDraft() {
  draftUi.title = document.getElementById("newMaterialTitle");
  draftUi.part = section(draftBox, "FOR");
  draftUi.partLabel = draftUi.part.previousElementSibling;
  const card = document.createElement("div");
  card.className = "pv on draft";
  const item = document.createElement("div");
  item.className = "ball preview";
  draftUi.ball = document.createElement("canvas");
  item.appendChild(draftUi.ball);
  draftUi.cap = document.createElement("span");
  draftUi.cap.className = "cap";
  card.append(item, draftUi.cap);
  draftBox.appendChild(card);
  draftUi.sect.texture = section(draftBox, "TEXTURE");
  draftUi.strip = ballStrip(draftBox, ["flat", ...MATERIALS], (name) => setDraft("texture", name));
  draftUi.sect.density = section(draftBox, "DENSITY");
  const row = field(draftBox, null);
  draftUi.slider = document.createElement("input");
  draftUi.slider.type = "range";
  draftUi.slider.min = "0";
  draftUi.slider.max = String(DENSITIES.length - 1);
  draftUi.slider.step = "1";
  draftUi.slider.setAttribute("aria-label", "density");
  draftUi.slider.addEventListener("input", () => setDraft("density", DENSITIES[Number(draftUi.slider.value)]));
  row.appendChild(draftUi.slider);
  draftUi.sect.colour = section(draftBox, "COLOUR");
  draftUi.swatches = swatchRow(draftBox, (color) => setDraft("colour", color));
  // A pointer put down off the panel closes it — the dropdowns' rule — and so does Escape, from anywhere on the page
  // (a plain dialog gets no close request of its own). A pen put down while the panel is up closes it here and opens
  // it again on its own material with the click
  document.addEventListener("pointerdown", (event) => { if (draftDialog.open && !draftDialog.contains(event.target)) closeDraft(); });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape" && draftDialog.open) closeDraft(); });
  draftDialog.addEventListener("close", () => { draft = null; });
}
// + under a part — a new material for the surface, a copy of what it has on, worn at once. ✎ — the panel on the
// material it stands by (`key`). The panel stands at the height of the region's MATERIAL line
function openDraft(region, key = null) {
  const mode = key ? "edit" : "new";
  if (!key) {
    key = newMaterial(surfaceOf(wearOf(spec, region)));
    spec = derive({ ...spec, wear: { ...(spec.wear || {}), [region]: key } });
  }
  selected = key;
  draft = { mode, region, key };
  render();
  renderDraft();
  if (!draftDialog.open) draftDialog.show();
  placeDraft();
}
function closeDraft() {
  draft = null;
  if (draftDialog.open) draftDialog.close();
}
// Where the panel stands: beside the deck, at the height of the MATERIAL line it was opened from — next to where the
// hand just was — and inside the screen, the deck's inset kept from its foot. Not centred: centred, it covered the
// creature to the last pixel and the preview was invisible; at the screen's far edge it stood a long way from the line.
// The line is looked up by its region, not held: the render before this lays the MATERIAL lines anew, and the one the
// pen was on is off the page by now
const DRAFT_GAP = 12, DRAFT_EDGE = 18;
function placeDraft() {
  const deck = document.querySelector(".deck");
  const d = deck ? deck.getBoundingClientRect() : { right: DRAFT_EDGE, top: DRAFT_EDGE };
  const line = draft && wearBox && wearBox.querySelector(`.drop[data-region="${draft.region}"] .pick`);
  const a = line ? line.getBoundingClientRect() : d;
  const w = draftDialog.offsetWidth, h = draftDialog.offsetHeight;
  const left = Math.max(DRAFT_EDGE, Math.min(d.right + DRAFT_GAP, window.innerWidth - DRAFT_EDGE - w));
  const top = Math.max(d.top, Math.min(a.top, window.innerHeight - DRAFT_EDGE - h));
  Object.assign(draftDialog.style, { margin: "0", left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto" });
}
window.addEventListener("resize", () => { if (draftDialog.open) placeDraft(); });
function setDraft(what, value) {
  setSurface(draft.key, what, value);   // written and drawn — the creature shows it
  renderDraft();
}
function renderDraft() {
  const { mode, region, key } = draft;
  const edit = mode === "edit";
  draftUi.title.textContent = edit ? "EDIT MATERIAL" : "NEW MATERIAL";
  // FOR — the surface a new material is for; USED BY — every part an edited one is on (a box is on several)
  draftUi.partLabel.textContent = edit ? "USED BY" : "FOR";
  const label = REGION_LABEL[region] ? `${partOf(region)} ${REGION_LABEL[region]}` : region;
  draftUi.part.textContent = edit ? presentParts(key).join(" · ") || label : label;
  draftUi.cap.textContent = captionOf(key);
  const s = surfaceOf(key);
  paintBall(draftUi.ball, { color: s.colour, material: s.texture, density: s.density, phase: 0, size: 72 });
  draftUi.sect.texture.textContent = s.texture;
  ["flat", ...MATERIALS].forEach((name, i) => {
    const b = draftUi.strip.balls[name];
    b.item.hidden = name === "flat" && (key === "skin" || key === "cloth");   // the two slots have no flat (MATERIALS does the same)
    if (b.item.hidden) return;
    paintBall(b.canvas, { color: s.colour, material: name, density: s.density, phase: 1 + i });
    b.item.classList.toggle("on", name === s.texture);
  });
  draftUi.sect.density.textContent = s.density;
  draftUi.slider.value = String(Math.max(0, DENSITIES.indexOf(s.density)));
  draftUi.sect.colour.textContent = s.colour || "";
  for (const dot of draftUi.swatches.querySelectorAll(".swatch")) dot.classList.toggle("on", dot.dataset.color === s.colour);
}

// Is this part on the creature at all — a slot at none, a quad's arms, a tailless biped's tail are not
function present(region) {
  const slot = partOf(region);   // a region stands when its part does
  const identity = (SPECIES.find((s) => s.name === spec.species) || {}).identity || {};
  const quad = identity.skeleton === "quad";
  if (slot === "arms") return !quad && spec.parts.arms !== "none";
  if (slot === "tail") return identity.tail === true;
  if (region === "hair") return spec.parts.hairFront !== "none" || spec.parts.hairBack !== "none";   // one surface, two slots
  if (slot === "legs" || slot === "body" || slot === "head" || slot === "mouth") return true;
  return spec.parts[slot] !== undefined && spec.parts[slot] !== "none";
}
// The parts that wear this material (wear.js — the drawing's own by default, the hand's choice when it put a
// part elsewhere), of those the creature has
function presentParts(key) {
  return WEARABLE.filter((region) => wearOf(spec, region) === key && present(region)).map((region) => REGION_LABEL[region] ? `${partOf(region)} ${REGION_LABEL[region]}` : region);
}

// Brings an item of a row that scrolls sideways into view — the row alone, never the deck: scrollIntoView
// also scrolls every ancestor, and on each edit it pulled the deck up to MATERIALS
function revealInRow(row, item) {
  if (!row || !item) return;
  const r = item.getBoundingClientRect();
  const s = row.getBoundingClientRect();
  if (r.left < s.left) row.scrollLeft += r.left - s.left;
  else if (r.right > s.right) row.scrollLeft += r.right - s.right;
}

// A label line of the card — its name in small capitals, the current value at the right end (filled on render), the
// control under it. Every card reads this way (styles.css .sect)
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
  // The previews — one card per material, in a row that scrolls sideways; filled on render, since a hand adds to them
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
  mat.strip = ballStrip(baseBox, ["flat", ...MATERIALS], (name) => setSurface(selected, "texture", name));   // flat: the white's own, and any material that is not a slot's

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

  // COLOUR — a box's is its palette box (one row per box, the selected one showing), a hand's own material's its own
  mat.sect.colour = section(baseBox, "COLOUR");
  for (const box of BOXES) mat.colourRows[box] = box === "white" ? swatchRow(baseBox, (color) => setSurface("white", "colour", color)) : paletteRow(baseBox, box, null);
  mat.ownColours = swatchRow(baseBox, (color) => setSurface(selected, "colour", color));
}

function renderMaterials() {
  const keys = materialKeys(spec);
  if (!keys.includes(selected)) selected = "skin";
  // The previews — every material the creature wears, the one being edited framed and scrolled into view. A
  // new one is made with the + beside the title, or under a part (material → +)
  const strip = document.createElement("div");
  strip.className = "strip";
  keys.forEach((key, i) => {
    const card = materialCard(key, 72, i * 40, (picked) => { selected = picked; renderMaterials(); });
    card.setAttribute("aria-label", `edit the material ${captionOf(key)}`);
    card.classList.toggle("on", key === selected);
    strip.appendChild(card);
  });
  mat.previews.replaceChildren(strip);
  revealInRow(strip, strip.querySelector(".pv.on"));

  const s = surfaceOf(selected);
  const own = isBox(selected) ? null : extraOf(spec, selected);
  mat.name.value = own ? own.name || "" : (spec.materialNames && spec.materialNames[selected]) || "";
  mat.name.placeholder = captionOf(selected);
  mat.sect.uses.textContent = presentParts(selected).join(" · ") || "nothing yet — under a part, material";

  mat.sect.texture.textContent = s.texture;
  ["flat", ...MATERIALS].forEach((name, i) => {
    const b = mat.strip.balls[name];
    b.item.hidden = name === "flat" && (selected === "skin" || selected === "cloth");   // the two slots have no flat
    if (b.item.hidden) return;
    paintBall(b.canvas, { color: s.colour, material: name, density: s.density, phase: 1 + i });
    b.item.classList.toggle("on", name === s.texture);
  });

  mat.sect.density.textContent = s.density;
  mat.density.value = String(Math.max(0, DENSITIES.indexOf(s.density)));

  const box = isBox(selected) ? selected : null;
  mat.sect.colour.textContent = `${box ? `${box} ` : ""}${s.colour || ""}`;
  for (const name of BOXES) mat.colourRows[name].hidden = name !== box;
  mat.ownColours.hidden = !!box;
  for (const row of [mat.ownColours, mat.colourRows.white]) for (const dot of row.querySelectorAll(".swatch")) dot.classList.toggle("on", dot.dataset.color === s.colour);
}

// The body is clothing: what is put on it brings its own surface (bodyMaterial) and its own pressure (bodyDensity),
// each its own on this screen (asOwn). Those slots leave the part list; they are edited in MATERIALS.
// **Colour belongs to the material.** A part takes no paint row: its colour is its material's, and its
// material is picked under it (material → the cards).
// The ghost is not a part but a state of the whole creature — it sits under SPECIES as its own dropdown
// (NORMAL, then GHOST), not in the part list.
const STATE_SLOT = "ghost";
const stateName = (value) => (value === "none" ? "NORMAL" : "GHOST");
// **A part's properties.** The numbers that shape a part (its proportions) and the slots that are not a form
// but a measure or a manner of it — a length, a build, a position, a pattern — live under the part, in its
// PROPERTY section, under SHAPE and MATERIAL, not in a card of their own and not as parts on the tab strip. `r` is a proportion slider,
// `sl` a slot: a segmented row up to four values, a dropdown past that. The hand (the wobble) stays its own card
const r = (key, label) => ({ key, kind: "range", label });
const sl = (key, label) => ({ key, kind: "slot", label });
const PROPERTIES = {
  head: [r("headScale", "size"), r("headWide", "width"), r("headLumps", "lumps"), r("headLump", "lump")],
  eyes: [sl("eyeScale", "size"), r("eyeGap", "gap"), r("eyeHeight", "height"), r("eyeSizeSkew", "size skew"), r("eyeHeightSkew", "height skew")],
  brow: [sl("browLength", "length")],
  nose: [r("noseDrop", "drop")],
  mouth: [sl("mouthPos", "position"), sl("mouthSize", "size"), r("mouthDrop", "drop")],
  body: [sl("build", "build"), sl("pattern", "pattern"), r("bodyScale", "scale"), r("bodyWide", "width"), r("bodyLen", "length")],
  arms: [sl("armLength", "length"), r("armSpread", "spread")],
  legs: [sl("legLength", "length"), r("legLength", "stretch")],
  tail: [sl("tailLength", "length"), sl("tailSkin", "skin"), sl("tailDeco", "deco"), r("tailLift", "lift")]
};
// The slots that are a property of a part, and so leave the tab strip
const PROPERTY_SLOTS = Object.values(PROPERTIES).flat().filter((p) => p.kind === "slot").map((p) => p.key);
// The two hair slots sit together on the strip, after the front (the roll keeps the back at the end of SLOTS as a late slot)
const PART_SLOTS = Object.keys(SLOTS).filter((slot) => !MATERIAL_SLOTS.includes(slot) && slot !== STATE_SLOT && !PROPERTY_SLOTS.includes(slot) && slot !== "hairBack")
  .flatMap((slot) => (slot === "hairFront" ? ["hairFront", "hairBack"] : [slot]));
// What a part tab is called — the slot's own name, but the hair slots are long for a 40px tab
const TAB_LABEL = { hairFront: "bangs", hairBack: "back" };
let part = PART_SLOTS[0];
const tabs = {};        // part → { item, canvas } — the icon tabs across the top
let shape = null;       // SHAPE — the dropdown: the form the part has (its picture, its name) on the line, the part's forms listed under it when open
let wearBox = null;     // MATERIAL — one dropdown per surface of the part: what it wears on the line, the creature's materials under it; laid on render
let propBox = null;     // PROPERTY — the open part's sliders and slot rows, standing open under the two
const propPanels = {};  // part → { box, sync } — built once per part, synced on render (a slider rebuilt mid-drag loses the drag)
const menus = {};       // `${species}/${part}` → { box, forms: value → { item, canvas, painted } } — each list built and painted once, kept
let menuKey = null;     // the list standing in the SHAPE dropdown
const tabImages = {};   // species → slot → an offscreen canvas of the painted icon — painted once, blitted back on return
// The boxes a part may be painted from. `pattern2` is a mark, not a surface; `ink` is the line, never a fill
// Which parts a species draws at all — a tail only where the identity has one, arms only on a biped (the same
// rule USED BY goes by). A tab for a part the species never draws would be an empty icon
function partApplies(slot, name) {
  const sp = SPECIES.find((s) => s.name === name) || {};
  const identity = sp.identity || {};
  if (slot.startsWith("tail")) return identity.tail === true;
  if (slot === "arms" || slot === "armLength") return identity.skeleton !== "quad";
  // A part whose every value the species' rule takes to none is a part the species does not have — a cat's or an
  // imp's hair, a human's horns. Its tab offered one row, `none`
  const rule = (sp.forbid || {})[slot];
  if (rule && SLOTS[slot] && SLOTS[slot].every((v) => v === "none" || rule[v] === "none")) return false;
  return true;
}
const TAB_SIZE = 34;    // CSS pixels — the icon on a part tab
const FORM_SIZE = 44;   // CSS pixels — a form's picture: on its row of the SHAPE list, and on the line
const BALL_SIZE = 36;   // CSS pixels — a material's ball on a MATERIAL line or row

// **The part is picked by its picture, and the pictures are a legend.** A tab per part down the left, each an icon
// of the part, and the open part's forms as a list of pictures, each one value drawn, the current one framed. The
// pictures are not the creature being edited: they are a **reference individual** of the species — one fixed roll
// with the parts that share a layer quieted (no hat, no hair, no eyewear, no nose, no pattern) — drawn once with
// **everything but the part hidden** (thumbs.js — the real drawing, framed on the region the part lives in) and
// left alone. Rendering them off the
// live creature on every edit was tried: a build per slider tick, and icons that changed under the hand
const REFERENCE_ROLL = 4242;
const REFERENCE_PARTS = { headgear: "none", eyewear: "none", hairFront: "none", hairBack: "none", face2: "none", pattern: "none", ghost: "none", tailDeco: "none", brow: "none", nose: "none", material: "graphite", density: "light" };
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
// **A dropdown.** What the part has on, on one line — its picture, then its name; no caret (the line is plainly a line
// to click, and the MATERIAL line ends in its pen, renderWear) — and a click on the line opens the list of what it
// could have under it, every row the same way: picture, then name. One is open at a
// time; a pick, a click anywhere else or Escape closes it. The list **floats over the deck** (position: fixed, put
// there by `place`), the way a select's does: opened in the flow of the card it pushed the properties down and pulled
// them back on every pick, and the card's whole length went up and down with it. The deck clips what it scrolls, but
// a fixed layer's box is the viewport's, not the deck's, so the list is not cut at the deck's edge — as long as
// nothing over the deck takes a transform or a filter, which would make the deck its box again. The list goes under
// the line when the screen has the room, over it when there is more room above; past six 44px rows, or what the room
// holds, it scrolls inside itself, the current row brought into view; it follows its line while the deck scrolls and
// closes when the line leaves the deck. `fill`, when a dropdown has one, lays the rows on each opening — the material
// lists change as a hand adds materials
let openDrop = null;
function dropdown(parent, label) {
  const box = document.createElement("div");
  box.className = "drop";
  const pick = document.createElement("button");
  pick.type = "button";
  pick.className = "pick";
  pick.setAttribute("aria-haspopup", "listbox");
  pick.setAttribute("aria-expanded", "false");
  pick.setAttribute("aria-label", label);
  const thumb = document.createElement("span");
  thumb.className = "thumb";
  const name = document.createElement("span");
  name.className = "name";
  pick.append(thumb, name);
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.hidden = true;
  box.append(pick, menu);
  parent.appendChild(box);
  const d = { box, pick, thumb, name, menu, fill: null, open: false };
  pick.addEventListener("click", () => setOpen(d, !d.open));
  return d;
}
function setOpen(d, on) {
  if (on && openDrop && openDrop !== d) setOpen(openDrop, false);
  d.open = on;
  d.menu.hidden = !on;
  d.pick.setAttribute("aria-expanded", String(on));
  openDrop = on ? d : openDrop === d ? null : openDrop;
  if (!on) return;
  if (d.fill) d.fill();
  place(d);
  const current = d.menu.querySelector(".opt.on");
  if (current) d.menu.scrollTop = current.offsetTop - (d.menu.clientHeight - current.offsetHeight) / 2;
}
document.addEventListener("pointerdown", (event) => { if (openDrop && !openDrop.box.contains(event.target)) setOpen(openDrop, false); });
window.addEventListener("keydown", (event) => { if (event.key === "Escape" && openDrop) setOpen(openDrop, false); });
// Puts an open list where it goes: under its line and as wide as it, or over the line when the screen has more room
// there than under; never taller than six rows or than the room, an edge kept from the screen's border
const MENU_MAX = 312, MENU_GAP = 2, MENU_EDGE = 8;
function place(d) {
  const r = d.pick.getBoundingClientRect();
  const m = d.menu;
  m.style.left = `${r.left}px`;
  m.style.width = `${r.width}px`;
  m.style.maxHeight = "none";
  const need = m.offsetHeight;
  const below = window.innerHeight - MENU_EDGE - (r.bottom + MENU_GAP);
  const above = r.top - MENU_GAP - MENU_EDGE;
  const up = need > below && above > below;
  m.style.maxHeight = `${Math.min(MENU_MAX, Math.max(44, up ? above : below))}px`;
  m.style.top = up ? `${r.top - MENU_GAP - m.offsetHeight}px` : `${r.bottom + MENU_GAP}px`;
  m.classList.toggle("up", up);
}
// The deck scrolls under an open list (scroll does not bubble — caught on the way down): the list follows its line, and
// goes when the line has left the deck. A wheel over the list itself scrolls the list, not the deck
document.addEventListener("scroll", (event) => {
  if (!openDrop || event.target === openDrop.menu) return;
  const deck = openDrop.box.closest(".deck");
  const r = openDrop.pick.getBoundingClientRect();
  const s = deck ? deck.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  if (r.bottom < s.top || r.top > s.bottom) setOpen(openDrop, false);
  else place(openDrop);
}, true);
window.addEventListener("resize", () => { if (openDrop) place(openDrop); });
// One row of a dropdown — a picture, then a name
function option(picture, text, onPick) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "opt";
  item.setAttribute("role", "option");
  const thumb = document.createElement("span");
  thumb.className = "thumb";
  thumb.appendChild(picture);
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = text;
  item.append(thumb, name);
  item.addEventListener("click", onPick);
  return item;
}
// A material's ball, painted — the picture on a MATERIAL line or row
function ballOf(key, size, phase) {
  const s = surfaceOf(key);
  const ball = document.createElement("span");
  ball.className = "ball preview";
  const canvas = document.createElement("canvas");
  ball.appendChild(canvas);
  paintBall(canvas, { color: s.colour, material: s.texture, density: s.density, phase, size });
  return ball;
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
    cap.textContent = TAB_LABEL[slot] || slot;
    item.appendChild(cap);
    item.addEventListener("click", () => { part = slot; renderPart(); });
    strip.appendChild(item);
    tabs[slot] = { item, canvas };
  }
  card.appendChild(strip);
  // Under the part, its panel, in this order — SHAPE: the form it has, and the part's forms under it (menuOf — one list
  // per species and part, built once and kept). Then its properties — the part's own numbers and measures (PROPERTIES)
  // — standing open, each under a label line of its own: they belong to the form, so they follow it. Then MATERIAL:
  // which of the creature's materials it wears — the materials MATERIALS shows, here to be picked from (a pick puts the
  // part in another, spec.wear) or edited in place (the pen — the dialog); the material is the last thing put on a
  // part, so it comes last. Three text tabs swapping one panel between them were tried first: the thing wanted was
  // always on the other tab, and a form and a material each read fine on one line
  const panel = document.createElement("div");
  panel.className = "partPanel";
  section(panel, "SHAPE");
  shape = dropdown(panel, "shape");
  shape.canvas = document.createElement("canvas");   // the current form's picture — the list's row for it, blitted
  shape.thumb.appendChild(shape.canvas);
  propBox = document.createElement("div");
  propBox.className = "props fields";
  panel.appendChild(propBox);
  wearBox = document.createElement("div");   // the MATERIAL line(s) and their dropdowns, laid on render
  wearBox.className = "wear";
  panel.appendChild(wearBox);
  card.appendChild(panel);
  partsBox.appendChild(card);
}

// The PROPERTY panel of one part, built once: a slider per proportion (PROPORTION_RANGE), and per slot a
// segmented row of its values, or a dropdown when there are more than four. `sync` puts the spec's values in
function propPanelOf(name) {
  if (propPanels[name]) return propPanels[name];
  const box = document.createElement("div");
  box.className = "fields";
  const syncs = [];
  for (const prop of PROPERTIES[name] || []) {
    const row = prop.kind === "range" ? field(box, prop.label) : fieldRow(box, prop.label);
    if (prop.kind === "range") {
      const [min, max] = PROPORTION_RANGE[prop.key];
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = String(min);
      slider.max = String(max);
      slider.step = prop.key === "headLumps" ? "1" : max - min <= 0.4 ? "0.005" : "0.01";
      slider.setAttribute("aria-label", `${name} ${prop.label}`);
      slider.addEventListener("input", () => {
        spec = { ...spec, proportions: { ...spec.proportions, [prop.key]: Number(slider.value) } };
        render();
      });
      row.appendChild(slider);
      const readout = document.createElement("output");
      readout.className = "readout";
      row.appendChild(readout);
      syncs.push(() => {
        slider.value = String(spec.proportions[prop.key]);
        readout.textContent = Number(spec.proportions[prop.key]).toFixed(prop.key === "headLumps" ? 0 : 2);
      });
    } else if (SLOTS[prop.key].length <= 4) {
      const seg = document.createElement("div");
      seg.className = "seg";
      seg.dataset.count = String(SLOTS[prop.key].length);   // four values go two by two (styles.css .props)
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", `${name} ${prop.label}`);
      const buttons = {};
      for (const value of SLOTS[prop.key]) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = value;
        b.addEventListener("click", () => { spec = derive({ ...spec, parts: { ...spec.parts, [prop.key]: value } }); render(); });
        seg.appendChild(b);
        buttons[value] = b;
      }
      row.appendChild(seg);
      syncs.push(() => { for (const value of Object.keys(buttons)) buttons[value].classList.toggle("on", value === spec.parts[prop.key]); });
    } else {
      const select = document.createElement("select");
      select.setAttribute("aria-label", `${name} ${prop.label}`);
      for (const value of SLOTS[prop.key]) addOption(select, value, value);
      select.addEventListener("change", () => { spec = derive({ ...spec, parts: { ...spec.parts, [prop.key]: select.value } }); render(); });
      row.appendChild(select);
      syncs.push(() => { select.value = spec.parts[prop.key]; });
    }
  }
  propPanels[name] = { box, sync: () => { for (const f of syncs) f(); } };
  return propPanels[name];
}

// **The legend is painted once, ahead, and kept.** One queue of paint jobs, one build per frame, so the deck never
// freezes: when a species comes on the stage its tabs go in first (a build per tab, into offscreen canvases that are
// blitted onto the tabs — coming back to the species blits them again and builds nothing), then the open part's
// list of forms, then every other part's list in tab order, so by the time a tab is clicked its pictures are
// there. Opening a part whose pictures are still pending moves them to the front. Nothing is painted on an edit,
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
// Every part's list for the species, built and queued ahead — the open part's first (renderPart prioritises it)
function prepaint(name) {
  for (const slot of PART_SLOTS) if (partApplies(slot, name)) menuOf(name, slot);
}
// The list of a part's forms for a species — what the SHAPE dropdown opens: a row per value, its picture then its name.
// Built and its paints queued the first time, kept after. A row painted for the open part's current value goes onto the
// SHAPE line as it lands
function menuOf(name, slot) {
  const key = `${name}/${slot}`;
  if (menus[key]) return menus[key];
  const box = document.createElement("div");
  box.className = "opts";
  box.setAttribute("role", "listbox");
  box.setAttribute("aria-label", `${slot} form`);
  const forms = {};
  // **A value the species' rule redirects is not offered.** On this species it is only another value's name — the
  // board maps it (species.js forbid) and the drawing follows the same map — so its row drew a duplicate: a cat's
  // ears listed nine rows of the one pointed ear. The row is built and hidden, not left out, so a spec that carries
  // such a value (a file from elsewhere) still finds its row and shows its picture, and NOTES says what the rule does
  const redirect = ((SPECIES.find((s) => s.name === name) || {}).forbid || {})[slot] || {};
  for (const value of SLOTS[slot]) {
    const canvas = document.createElement("canvas");
    const item = option(canvas, value, () => {
      setOpen(shape, false);
      spec = derive({ ...spec, parts: { ...spec.parts, [slot]: value } });
      render();
    });
    item.setAttribute("aria-label", `${slot} ${value}`);   // no title: the name is on the row, and a tooltip said it again over it
    item.hidden = redirect[value] !== undefined;
    box.appendChild(item);
    forms[value] = { item, canvas, painted: false };
  }
  menus[key] = { box, forms };
  const at = referenceOf(name);
  for (const value of SLOTS[slot]) {
    enqueue(key, () => {
      paintPart(forms[value].canvas, derive({ ...at, parts: { ...at.parts, [slot]: value } }), slot, FORM_SIZE);
      forms[value].painted = true;
      if (menuKey === key && spec.parts[slot] === value) blit(forms[value].canvas, shape.canvas);
    });
  }
  return menus[key];
}

// The open part's controls, from the spec: its tab framed, its form on the SHAPE line (the list under it swapped when
// the part changes), its materials on the MATERIAL lines, its properties open under them
// **The card holds still.** Opening another part swaps in a panel of another height — eyes have five properties, a
// brow one — and the deck, scrolled to the card, lost that height under its scroll position and the card
// jumped. The card's place on screen is measured before and put back after; when what is below it is too
// short to scroll that far, the deck is given the room at its foot. Nothing is drawn on a tab click: the
// lists are built once and kept (menuOf), and the creature is not touched
function holdInPlace(card, change) {
  const deck = card && card.closest(".deck");
  if (!deck) { change(); return; }
  const before = card.getBoundingClientRect().top;
  change();
  const drift = card.getBoundingClientRect().top - before;
  if (Math.abs(drift) < 0.5) return;
  const want = deck.scrollTop + drift;
  deck.style.paddingBottom = "0px";
  const room = deck.scrollHeight - deck.clientHeight;
  if (want > room) deck.style.paddingBottom = `${Math.ceil(want - room)}px`;
  deck.scrollTop = want;
}

function renderPart() {
  holdInPlace(partsBox.querySelector(".partCard"), renderPartBody);
}
function renderPartBody() {
  for (const slot of PART_SLOTS) tabs[slot].item.hidden = !partApplies(slot, spec.species);
  if (!partApplies(part, spec.species)) part = PART_SLOTS[0];   // the open part left with the species — back to the head
  for (const slot of PART_SLOTS) tabs[slot].item.classList.toggle("on", slot === part);
  revealInRow(tabs[part].item.parentElement, tabs[part].item);   // the strip scrolls sideways; the open tab stays in view — the row alone
  const key = `${spec.species}/${part}`;
  const menu = menuOf(spec.species, part);
  if (thumbSpecies !== spec.species) {   // a new species is a new legend — or one kept from before
    thumbSpecies = spec.species;
    paintTabs();
    prioritise(`${spec.species}/tabs`);
    prepaint(spec.species);
  }
  if (menuKey !== key) {
    if (openDrop) setOpen(openDrop, false);   // another part is another panel — whatever was open closes
    shape.menu.replaceChildren(menu.box);
    menuKey = key;
    prioritise(key);
  }
  // SHAPE — the current form on the line, its row framed in the list. The line's picture is the row's, blitted — blank
  // until that row is painted, when the paint job puts it there
  const value = spec.parts[part];
  for (const v of SLOTS[part]) {
    menu.forms[v].item.classList.toggle("on", v === value);
    menu.forms[v].item.setAttribute("aria-selected", String(v === value));
  }
  shape.name.textContent = value;
  shape.pick.title = `${part}: ${value}`;
  const current = menu.forms[value];
  if (current && current.painted) blit(current.canvas, shape.canvas);
  else {
    shape.canvas.width = shape.canvas.height = 1;
    shape.canvas.style.width = shape.canvas.style.height = `${FORM_SIZE}px`;
  }

  renderWear();

  // The properties — open under the two; a part with none has none
  const hasProps = !!PROPERTIES[part];
  propBox.hidden = !hasProps;
  if (hasProps) {
    const panel = propPanelOf(part);
    if (propBox.firstChild !== panel.box) propBox.replaceChildren(panel.box);
    panel.sync();
  }
}
// ✎ — the pen that opens EDIT MATERIAL on a material: at the end of the MATERIAL line, and at the right end of every
// row of its list
function penFor(key, onClick) {
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "edit";
  edit.textContent = "✎";
  edit.title = `edit ${captionOf(key)} — its texture, density and colour, on every part that wears it`;
  edit.setAttribute("aria-label", `edit ${captionOf(key)}`);
  edit.addEventListener("click", onClick);
  return edit;
}
// MATERIAL — one dropdown per surface of the part (an eye is a pupil and a white, each in a material of its own; most
// parts are one surface and get one unnamed line): the material it wears on the line, ending in **✎** — the dialog
// on it (EDIT MATERIAL, openDraft) — and, opened, **+** first — NEW MATERIAL, the dialog on a new
// material for the surface — then one row per material the creature has, each with ✎ at its right end: the dialog on
// that one. The row picks, the pen edits. Laid on every render: a hand adds materials, renames them, recolours them
function renderWear() {
  if (openDrop && wearBox.contains(openDrop.box)) openDrop = null;   // being rebuilt — gone with the old rows
  wearBox.replaceChildren();
  const regions = regionsOf(part).filter((region) => wearOf(spec, region));
  for (const region of regions) {
    const wears = wearOf(spec, region);
    const label = REGION_LABEL[region] || region;
    section(wearBox, regions.length > 1 ? `MATERIAL · ${label}` : "MATERIAL");   // a part with more than one surface names each
    const d = dropdown(wearBox, `${label} material`);
    d.menu.setAttribute("role", "listbox");
    d.thumb.appendChild(ballOf(wears, BALL_SIZE, 0));
    d.name.textContent = captionOf(wears);
    d.pick.title = `${label} wears ${captionOf(wears)}`;
    d.box.classList.add("hasPen");   // the line keeps room at its end for the pen (styles.css)
    d.box.dataset.region = region;   // placeDraft finds the line by it
    d.box.appendChild(penFor(wears, () => { setOpen(d, false); openDraft(region, wears); }));
    d.fill = () => {
      d.menu.replaceChildren();
      const plus = document.createElement("span");
      plus.className = "plus";
      plus.setAttribute("aria-hidden", "true");
      plus.textContent = "+";
      const add = option(plus, "new material", () => { setOpen(d, false); openDraft(region); });
      add.classList.add("add");
      add.title = `a new material for the ${label} — its texture, density and colour, starting from what it has on`;
      d.menu.appendChild(add);
      materialKeys(spec).forEach((key, i) => {
        const row = option(ballOf(key, BALL_SIZE, i * 40), captionOf(key), () => {
          spec = derive({ ...spec, wear: { ...(spec.wear || {}), [region]: key } });
          render();
        });
        row.classList.toggle("on", key === wears);
        row.setAttribute("aria-selected", String(key === wears));
        row.setAttribute("aria-label", `${label} wears ${captionOf(key)}`);
        const line = document.createElement("div");   // the row and its pen, side by side
        line.className = "optRow";
        line.append(row, penFor(key, () => { setOpen(d, false); openDraft(region, key); }));
        d.menu.appendChild(line);
      });
    };
  }
  if (!regions.length) section(wearBox, "MATERIAL").textContent = "none — a mark with a colour of its own";
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

// The HAND card — NEW HAND rolls the hand (the same individual drawn by another), and under it the wobble: how much
// every stroke shakes. Every other proportion is a property of its part, under the part
function buildProportions() {
  proportionsBox.innerHTML = "";
  for (const key of ["wobble"]) {
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
buildDraft();

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
document.getElementById("addMaterial").addEventListener("click", addMaterial);
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
  if (draftDialog.open) return;   // the panel's keys are its own — R under it shuffled the creature away
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
