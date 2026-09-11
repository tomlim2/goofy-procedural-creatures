// Fan spill — every filled shape on the board checked against the fan that fills it, over **every slot value × species × roll**.
//   node scripts/fanspill.mjs                 -> the parts that spill, worst first, with the slot values that bring it
//   node scripts/fanspill.mjs --check         -> the count only, exit 1 if there is any (for CI)
//   node scripts/fanspill.mjs --all           -> every fill that spilled, one line each
//   node scripts/fanspill.mjs --min 0.02      -> the share of its own area a shape's leak has to reach to count (default 0.01 — and at least the ink's width across)
//   node scripts/fanspill.mjs --rolls 11,777  -> the rolls to walk (default drawdiff's three)
//
// A fill is a fan of triangles from the shape's centre (stroke.js Sketch.fill), and the fan is the shape only when every edge is
// visible from that centre. A bent band, a spiral, a crescent, a notched cap is not: the fan's triangles for the hidden edges are
// turned the wrong way and painted outside the outline (the rex's bone horn spilled bone-white past its ink at the bend). shape.js
// fanSpill measures it for one polygon; this walks the drawing the way drawdiff does — drawCreature's layers, the limbs, the tail
// bones, the brow and mouth states — with the fan wrapped, and puts a name to every polygon that spills: the layer, the part
// (paintPart's `part`), the slot value that brought it — by what shows: the fan's paint outside the outline past the ink (shape.js
// fanLeak), not the turned triangles as such, most of which a crumpled edge lays over the shape's own paint. A shape painted `concave` (ear-clipped) is checked for a self-crossing
// outline instead — ear clipping gives up on one and fans what is left. Do not eyeball it, count it.
// Docs: guidelines/character/rules.md § a fill has to be visible from its centre

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const load = (p) => import(pathToFileURL(join(root, p)).href);
const { Sketch } = await load("src/stroke.js");
const { fanSpill, fanLeak } = await load("src/shape.js");
const { makeCreature, drawCreature, limbSketches, tailSketch, facePartKinds, facePartSketch, SLOTS, LAYER_KEYS, starPath, heartPath } = await load("src/character/index.js");

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const checkOnly = args.includes("--check");
const every = args.includes("--all");
const MIN = Number(flag("--min") ?? 0.01);
const INK = 0.01;   // a leak narrower than the ink's width across is not counted — the contour is already over it
const ROLLS = (flag("--rolls") || "11,2222,333333").split(",").map(Number);
const SPECIES = ["human", "cat", "pup", "imp", "rex"];

// -- the fan, wrapped --
// paint() hands the fill the part's name (body.js paintPart puts it in the options); fill() measures every polygon that reaches the fan
let hits = [];
let checked = 0;
const fill0 = Sketch.prototype.fill, polygon0 = Sketch.prototype.fillPolygon, paint0 = Sketch.prototype.paint;
Sketch.prototype.paint = function (points, name, options) {
  this.__part = (options && options.part) || null;
  try { return paint0.call(this, points, name, options); } finally { this.__part = null; }
};
Sketch.prototype.fill = function (points, color, skinT) {
  checked += 1;
  const m = fanSpill(points);
  if (m.turned) {
    const l = fanLeak(points);
    if (l.share >= MIN && Math.sqrt(l.leak) >= INK) hits.push({ sketch: this, part: this.__part, kind: "fan", n: points.length, ...m, ...l });
  }
  return fill0.call(this, points, color, skinT);
};
Sketch.prototype.fillPolygon = function (points, color, skinT) {
  checked += 1;
  const m = fanSpill(points);
  if (m.crossings) hits.push({ sketch: this, part: this.__part, kind: "crossing", n: points.length, ...m, leak: 0, share: 0 });
  return polygon0.call(this, points, color, skinT);
};

// -- one individual, every sketch the scene stands up --
// Returns the hits with the sketch named: a layer of drawCreature, a limb, the tail, a brow or mouth state — and the part, when the
// layer alone does not say (the hat layer paints headgear and top knots; the face layer cheeks, tears and the rings under the eyes)
function draw(spec) {
  hits = [];
  const who = new Map();
  const layers = drawCreature(spec, 0);
  for (const key of LAYER_KEYS) who.set(layers[key].fills, key);
  for (const l of limbSketches(spec, 0)) for (const k of ["sketch", "lowerSketch", "footSketch", "backSketch"]) if (l[k]) who.set(l[k], `${l.kind}s`);
  for (const s of tailSketch(spec, 0).sketches) who.set(s, "tail");
  const kinds = facePartKinds(spec);
  for (const part of ["brow", "mouth"]) for (const kind of kinds[part]) who.set(facePartSketch(spec, part, kind), `${part}=${kind}`);
  return hits.map((h) => {
    const layer = who.get(h.sketch) || "?";
    return { ...h, layer, name: !h.part || h.part === layer || layer.startsWith(h.part) ? layer : `${layer} (${h.part})` };
  });
}
const countBy = (list) => { const c = {}; for (const h of list) c[h.name] = (c[h.name] || 0) + 1; return c; };
const worst = (list) => list.reduce((a, b) => (b.leak > a.leak || (b.kind === "crossing" && b.crossings > a.crossings) ? b : a));
const pct = (x) => `${(x * 100).toFixed(x >= 0.1 ? 0 : 1)}%`;
const size = (h) => Math.sqrt(h.leak).toFixed(3);   // the side of a square holding the leak's area — against the ink's 0.01 and a head's 0.3
const line = (h) => (h.kind === "crossing" ? `crosses ×${h.crossings}` : `leak ${pct(h.share)} ~${size(h)} across (fan ${pct(h.spill)}, ${h.turned}/${h.n} edges${h.crossings ? `, crosses ×${h.crossings}` : ""})`);
// The slot a part's fill answers to — the part or the layer when either is a slot — for naming the base individual's own value
const slotOf = (h) => [h.part, h.layer].find((k) => k && SLOTS[k]);
const valueOf = (h, parts) => {
  const k = slotOf(h);
  if (!k) return h.layer;
  return k === "tail" ? `tail=${parts.tail} tailSkin=${parts.tailSkin} tailDeco=${parts.tailDeco}` : `${k}=${parts[k]}`;
};
// Whether a walked slot is the part's own — anything else that changes the part (a head shape under a hat) only reshapes what the base wears
const owns = (slot, h) => { const k = h.part || h.layer; return slot === k || slot.startsWith(k) || (k === "hair" && slot.startsWith("hair")) || (k === "hat" && slot === "headgear"); };

// -- the walk --
const t0 = performance.now();
const parts = new Map();   // species · name → { values: value → the worst hit of it and the rolls it showed on }
const lines = [];          // --all
const threw = [];
let values = 0;
const note = (species, h, value, roll, tag = "") => {
  const key = `${species}|${h.name}`;
  const p = parts.get(key) || { species, name: h.name, kind: h.kind, values: new Map() };
  const v = p.values.get(value) || { hit: h, rolls: new Set(), tag, example: `${species}/${roll}` };
  v.rolls.add(roll);
  if (worst([v.hit, h]) === h && h !== v.hit) { v.hit = h; v.example = `${species}/${roll}`; }
  p.values.set(value, v);
  parts.set(key, p);
};
for (const species of SPECIES) {
  for (const roll of ROLLS) {
    const base = makeCreature(roll, species);
    const baseHits = draw(base);
    const baseCount = countBy(baseHits);
    for (const h of baseHits) {
      lines.push(`${species}/${roll} base ${h.name} ${line(h)}`);
      note(species, h, valueOf(h, base.parts), roll, "the base's own");
    }
    for (const [slot, list] of Object.entries(SLOTS)) {
      for (const value of list) {
        if (base.parts[slot] === value) continue;   // the base itself, counted above
        values += 1;
        const spec = { ...base, parts: { ...base.parts, [slot]: value } };
        let found;
        try { found = draw(spec); } catch (e) { threw.push(`${species}/${roll}/${slot}=${value} threw: ${e.message}`); continue; }
        const count = countBy(found);
        for (const name of Object.keys(count)) {
          if (count[name] <= (baseCount[name] || 0)) continue;   // the base's own part spilling, not this value's
          const mine = found.filter((h) => h.name === name);
          if (every) for (const x of mine) lines.push(`${species}/${roll} ${slot}=${value} ${x.name} ${line(x)}`);
          const h = worst(mine);
          note(species, h, `${slot}=${value}`, roll, !owns(slot, h) && baseCount[name] ? `reshapes the base's own ${valueOf(h, base.parts)}` : "");
        }
      }
    }
  }
}
// The eye rig's own fills (scene/rig.js — meshes the walk does not build): the white and the pupil are blobs; the ☆ and the ♥ are these
for (const [name, pts] of [["☆ starPath", starPath(0, 0, 0.05)], ["♥ heartPath", heartPath(0, 0, 0.05, 0.0425)]]) {
  checked += 1;
  const m = fanSpill(pts);
  const l = fanLeak(pts);
  if (l.share >= MIN && Math.sqrt(l.leak) >= INK) note("rig", { ...m, ...l, kind: "fan", n: pts.length, name, layer: "rig" }, name, 0);
}
const secs = ((performance.now() - t0) / 1000).toFixed(1);

// -- the report --
const spilling = [...parts.values()].filter((p) => p.kind === "fan").map((p) => ({ ...p, worst: worst([...p.values.values()].map((v) => v.hit)) }))
  .sort((a, b) => b.worst.leak - a.worst.leak);
const crossing = [...parts.values()].filter((p) => p.kind === "crossing");
const sites = new Set(spilling.map((p) => p.name));
const pairs = spilling.reduce((s, p) => s + p.values.size, 0);
const head = `fan spill: ${sites.size} drawing sites leak ≥ ${pct(MIN)} of their shape past the ink (${pairs} part × value pairs over ${SPECIES.length} species) · ${checked} fills checked, ${SPECIES.length} species × ${ROLLS.length} rolls × ${values / SPECIES.length / ROLLS.length} slot values (${secs} s)`;
if (checkOnly) {
  console.log(head);
  if (crossing.length) console.log(`ear-clipped shapes whose outline crosses itself: ${crossing.length} (information — what is left after the ears is fanned)`);
  process.exit(spilling.length ? 1 : 0);
}
console.log(head);
const pad = (s, n) => String(s).padEnd(n);
if (spilling.length) {
  console.log("  leak: what the fan paints outside the outline past the ink, as a share of the shape · across: the side of a square holding it (the ink is 0.01 wide, a head 0.3) · fan: the turned triangles' share");
  for (const p of spilling) {
    console.log();
    console.log(`${pad(p.species, 7)} ${pad(p.name, 24)} worst leak ${pct(p.worst.share)}, ~${size(p.worst)} across`);
    const vs = [...p.values.entries()].sort((a, b) => b[1].hit.leak - a[1].hit.leak);
    for (const [value, v] of vs) {
      const h = v.hit;
      console.log(`        ${pad(value, 26)} ${pad(`leak ${pct(h.share)}`, 10)} ${pad(`~${size(h)} across`, 14)} ${pad(`fan ${pct(h.spill)}`, 9)} ${pad(`${h.turned}/${h.n} edges`, 13)} ${pad(`${v.rolls.size}/${p.species === "rig" ? 1 : ROLLS.length} rolls`, 10)} ${p.species === "rig" ? "" : `e.g. ${v.example}`}${v.tag ? `  — ${v.tag}` : ""}`);
    }
  }
} else {
  console.log("every fill on the board is visible from its centre");
}
if (crossing.length) {
  console.log();
  console.log(`ear-clipped shapes whose outline crosses itself (information — what is left after the ears is fanned): ${crossing.length}`);
  for (const p of crossing) {
    const vs = [...p.values.entries()].sort((a, b) => b[1].hit.crossings - a[1].hit.crossings);
    console.log(`  ${pad(p.species, 7)} ${pad(p.name, 20)} ${vs.map(([value, v]) => `${value} ×${v.hit.crossings} (${v.rolls.size}/${ROLLS.length}${v.tag ? `, ${v.tag}` : ""})`).join(" · ")}`);
  }
}
if (every && lines.length) { console.log(); for (const l of lines) console.log("  " + l); }
if (threw.length) { console.log(); console.log(`threw (not checked): ${threw.length}`); for (const t of threw.slice(0, 10)) console.log("  " + t); }
process.exitCode = spilling.length ? 1 : 0;
