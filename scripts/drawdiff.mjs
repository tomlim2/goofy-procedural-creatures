// Before/after comparison for drawing refactors — diffs the working tree's drawing against a git ref (HEAD by default) over **every slot value × species × roll**.
//   node scripts/drawdiff.mjs          # compare against HEAD
//   node scripts/drawdiff.mjs main     # compare against another ref
//
// snapshot.mjs hashes one board (35 creatures) per layer, so it never visits every slot value. When drawing code moves in a big way (splitting files, turning it into a table),
// run this — it hashes and compares 11 layers × 2 boil variants + limbs (× 2 boil variants, and their joints' places) + tail bones + brow/mouth states, sketch by sketch. diff 0 means the drawing is unchanged.
// The old tree is extracted into a temp folder with `git archive` and node_modules (three) is linked beside it. Specs (makeCreature) are compared too.

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const ref = process.argv[2] || "HEAD";

const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, encoding: "utf8" }).trim();
const repoRoot = git("rev-parse --show-toplevel");
const prefix = git("rev-parse --show-prefix").replace(/\/$/, "");   // path to menagerie relative to the repo root

// Walk upward to find node_modules (three) — linked next to the extracted tree
let modules = null;
for (let dir = root; dir !== dirname(dir); dir = dirname(dir)) {
  if (existsSync(join(dir, "node_modules", "three"))) { modules = join(dir, "node_modules"); break; }
}
if (!modules) { console.error("could not find node_modules/three"); process.exit(2); }

const tmp = mkdtempSync(join(tmpdir(), "menagerie-drawdiff-"));
try {
  execSync(`git archive ${ref} ${prefix} | tar -x -C "${tmp}"`, { cwd: repoRoot, shell: "/bin/sh" });
  symlinkSync(modules, join(tmp, "node_modules"), "dir");
  const oldRoot = join(tmp, prefix);

  const oldM = await import(pathToFileURL(join(oldRoot, "src/character/index.js")).href);
  const newM = await import(pathToFileURL(join(root, "src/character/index.js")).href);
  const oldSlots = (await import(pathToFileURL(join(oldRoot, "src/character/vocabulary/slots.js")).href)).SLOTS;

  const hash = (s) => createHash("sha1").update(JSON.stringify([Array.from(s.positions, (v) => Math.round(v * 1e6)), Array.from(s.colors, (v) => Math.round(v * 1e6))])).digest("hex").slice(0, 10);
  // A layer is an { ink, fills } pair out of drawCreature. Names can differ between the two trees (a commit that split or merged layers) — only layers present on both sides are compared, the rest are noted once
  const layerKeys = (d) => Object.keys(d).filter((k) => d[k] && d[k].ink && d[k].fills);
  const onlyOne = new Set();
  let n = 0;
  const diffs = [];
  const note = (label) => { if (diffs.length < 30) diffs.push(label); };
  // `ghost` draws nothing of its own — it collapses the whole palette, breaks every line and empties the eyes,
  // and all three are decided when the spec is built. Swapping the part onto an already-built spec therefore
  // leaves both sides drawing the plain creature, and the slot compares equal no matter what changed inside it.
  // Each side re-derives it with its own functions, off the pre-ghost palette the spec carries — the same
  // thing the parts gallery has to do. A no-op for `ghost=none` and for a ref that predates the slot
  const ghosted = (m, spec) => {
    if (!m.ghostPalette || spec.parts.ghost === undefined) return spec;
    const parts = { ...spec.parts };
    if (parts.ghost !== "none") parts.eyes = "hollow";
    return { ...spec, parts, outline: m.ghostOutline(parts.ghost), palette: m.ghostPalette(spec.palette0 || spec.palette, parts.ghost, spec.proportions.hand ?? spec.proportions.wobbleSeed) };
  };
  // The ref may predate the rename (a creature's `seed` became its `roll`, `proportions.wobbleSeed` its `hand`);
  // the working tree's drawing reads the new names, so its side of the spec carries both
  const modern = (s) => ({ ...s, roll: s.roll ?? s.seed, proportions: { ...s.proportions, hand: s.proportions.hand ?? s.proportions.wobbleSeed } });
  const check = (rawSpec, label) => {
    const specOld = ghosted(oldM, rawSpec), spec = ghosted(newM, modern(rawSpec));
    for (const v of [0, 1]) {
      const a = oldM.drawCreature(specOld, v), b = newM.drawCreature(spec, v);
      const ka = layerKeys(a), kb = layerKeys(b);
      for (const k of ka) if (!kb.includes(k)) onlyOne.add(`only in ${ref}: ${k}`);
      for (const k of kb) if (!ka.includes(k)) onlyOne.add(`only in the working tree: ${k}`);
      for (const k of ka) {
        if (!kb.includes(k)) continue;
        n += 1;
        if (hash(a[k].ink) !== hash(b[k].ink) || hash(a[k].fills) !== hash(b[k].fills)) note(`${label} ${k} variant ${v}`);
      }
    }
    // The limbs in **two boil frames**, like the layers: frame 0 alone hid a knee that sat somewhere else in frames 1
    // and 2 (the joint's place read the boiling noise), so the leg stepped at the knee with every boil and the gate said 0
    for (const v of [0, 1]) {
      const la = oldM.limbSketches(specOld, v), lb = newM.limbSketches(spec, v);
      if (la.length !== lb.length) { note(`${label} limb count variant ${v}`); continue; }
      // A jointed limb is **three** sketches, not one — the upper bone (sketch), the lower one (lowerSketch: a
      // forearm, a shin) and the foot on its own ankle (footSketch). Only the upper was compared here, so the
      // gate was blind to two thirds of every arm and leg: a change that moved every toe on the board came out
      // at 0. `knee` rides along too — it is not geometry, but it is what the scene folds the leg by — and so do the
      // joints' places (pivot, elbow, ankle): the scene hangs the lower bone and the foot from them, not from the sketch
      la.forEach((l, i) => {
        for (const part of ["sketch", "lowerSketch", "footSketch"]) {
          if (!l[part] && !lb[i][part]) continue;
          n += 1;
          if (!l[part] || !lb[i][part] || hash(l[part]) !== hash(lb[i][part])) note(`${label} limb ${i} ${part} variant ${v}`);
        }
        if (l.knee !== lb[i].knee) note(`${label} limb ${i} knee ${l.knee} → ${lb[i].knee} variant ${v}`);
        for (const joint of ["pivot", "elbow", "ankle"]) {
          if (JSON.stringify(l[joint]) !== JSON.stringify(lb[i][joint])) note(`${label} limb ${i} ${joint} variant ${v}`);
        }
      });
    }
    const ta = oldM.tailSketch(specOld), tb = newM.tailSketch(spec);
    ta.sketches.forEach((s, i) => { n += 1; if (!tb.sketches[i] || hash(s) !== hash(tb.sketches[i])) note(`${label} tail ${i}`); });
    for (const part of ["brow", "mouth"]) {
      for (const kind of oldM.facePartKinds(specOld)[part]) {
        n += 1;
        if (hash(oldM.facePartSketch(specOld, part, kind)) !== hash(newM.facePartSketch(spec, part, kind))) note(`${label} ${part}=${kind}`);
      }
    }
  };
  let specDiffs = 0;
  for (const species of ["human", "cat", "pup", "imp", "rex"]) {
    for (const roll of [11, 2222, 333333]) {
      const base = oldM.makeCreature(roll, species);
      if (JSON.stringify(base) !== JSON.stringify(newM.makeCreature(roll, species))) specDiffs += 1;
      // A base spec may itself hold a value the working tree no longer has (a removed part) — the tree cannot draw it, so that slot
      // is drawn as the tree's first value instead, noted once. The other slots' comparisons still stand
      const drawable = { ...base, parts: { ...base.parts } };
      for (const [slot, values] of Object.entries(newM.SLOTS)) {
        if (drawable.parts[slot] !== undefined && !values.includes(drawable.parts[slot])) {
          onlyOne.add(`only in ${ref}: ${slot}=${drawable.parts[slot]} (a base spec, drawn as ${values[0]})`);
          drawable.parts[slot] = values[0];
        }
      }
      for (const [slot, values] of Object.entries(oldSlots)) {
        if (!newM.SLOTS[slot]) { onlyOne.add(`only in ${ref}: slot ${slot}`); continue; }   // a renamed or removed slot — the working tree cannot draw it
        for (const value of values) {
          // A value the working tree no longer has (a removed part) cannot be drawn by it — noted once, not compared
          if (!newM.SLOTS[slot].includes(value)) { onlyOne.add(`only in ${ref}: ${slot}=${value}`); continue; }
          check({ ...drawable, parts: { ...drawable.parts, [slot]: value } }, `${species}/${roll}/${slot}=${value}`);
        }
      }
    }
  }
  console.log(`${ref} ↔ working tree: ${n} sketches compared, ${specDiffs} spec differences, ${diffs.length} drawing differences${diffs.length >= 30 ? " or more" : ""}`);
  for (const d of diffs) console.log("  " + d);
  if (onlyOne.size) console.log(`present on one side only (not compared): ${[...onlyOne].join(" · ")}`);
  process.exitCode = diffs.length || specDiffs || onlyOne.size ? 1 : 0;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
