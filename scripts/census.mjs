// Species × slot distribution and identity violation check.
//   node scripts/census.mjs             -> per-species slot distribution table + violation list
//   node scripts/census.mjs --slot eyes -> one slot only
//   node scripts/census.mjs --check     -> violations only (for CI, exit 1 if any)
//
// Catches things like "cyclops eyes are leaking into humans" before they are asked about. Do not eyeball it, count it.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const { makeGrid, SLOTS, SPECIES, limbSketches, tailSketch, eyeGeometry, layout } = await import(join(root, "src/character/index.js"));

const args = process.argv.slice(2);
const onlySlot = args.includes("--slot") ? args[args.indexOf("--slot") + 1] : null;
const checkOnly = args.includes("--check");
const BOARDS = 40;

// -- sample --
const bySpecies = {};
for (let s = 0; s < BOARDS; s += 1) {
  for (const c of makeGrid(s * 7919 + 1, 35, 7)) (bySpecies[c.species] ||= []).push(c);
}
const speciesNames = SPECIES.map((s) => s.name);
const total = Object.values(bySpecies).flat().length;

// -- identity check --
const violations = [];
for (const sp of SPECIES) {
  const id = sp.identity || {};
  for (const c of bySpecies[sp.name] || []) {
    const where = `${sp.name} roll=${c.roll}`;
    if (id.horns && !id.horns.includes(c.parts.horns)) violations.push(`${where}: horns=${c.parts.horns} (allowed: ${id.horns.join("/")})`);
    for (const k of ["hairFront", "hairBack"]) if (id[k] && !id[k].includes(c.parts[k])) violations.push(`${where}: ${k}=${c.parts[k]} (allowed: ${id[k].join("/")})`);
    if (id.brow && !id.brow.includes(c.parts.brow)) violations.push(`${where}: brow=${c.parts.brow} (allowed: ${id.brow.join("/")})`);
    if (id.ears && !id.ears.includes(c.parts.ears)) violations.push(`${where}: ears=${c.parts.ears} (allowed: ${id.ears.join("/")})`);
    if (id.eyes?.not && id.eyes.not.includes(c.parts.eyes)) violations.push(`${where}: eyes=${c.parts.eyes} forbidden`);
    if (id.armLength && !id.armLength.includes(c.parts.armLength)) violations.push(`${where}: armLength=${c.parts.armLength} (allowed: ${id.armLength.join("/")})`);
    if (id.legLength?.not && id.legLength.not.includes(c.parts.legLength)) violations.push(`${where}: legLength=${c.parts.legLength} forbidden`);
    if (id.darkHead) {
      const v = parseInt(c.palette.skin.slice(1), 16);
      const lum = 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
      if (lum >= 90) violations.push(`${where}: head is not dark ${c.palette.skin}`);
    }
    // Shared guardrail — the two eyes never sit closer than 70% of the sum of their radii (eyeGeometry guarantees it. If that breaks, this catches it)
    {
      const eyes = eyeGeometry(c, layout(c));
      if (eyes.length === 2) {
        const d = Math.hypot(eyes[1].x - eyes[0].x, eyes[1].y - eyes[0].y);
        if (d < (eyes[0].r + eyes[1].r) * 0.7 - 1e-6) violations.push(`${where}: eyes overlap too much (distance ${d.toFixed(3)} < 70% of radius sum ${((eyes[0].r + eyes[1].r) * 0.7).toFixed(3)})`);
      }
    }
    if (id.arms !== undefined || id.tail !== undefined || id.skeleton) {
      const limbs = limbSketches(c);
      const hasArms = limbs.some((l) => l.kind === "arm");
      const tail = tailSketch(c);
      const hasTail = tail.sketches.some((s) => !s.empty);   // any one of the bones counts
      const legs = limbs.filter((l) => l.kind === "leg").length;
      if (id.arms === true && !hasArms) violations.push(`${where}: no arms`);
      if (id.arms === false && hasArms) violations.push(`${where}: has arms`);
      if (id.tail === true && !hasTail) violations.push(`${where}: no tail`);
      if (id.tail === false && hasTail) violations.push(`${where}: has a tail`);
      if (id.skeleton === "quad" && legs !== 4) violations.push(`${where}: ${legs} legs (quad)`);
      if (id.skeleton === "biped" && legs !== 2) violations.push(`${where}: ${legs} legs (biped)`);
    }
  }
}

if (checkOnly) {
  if (violations.length) {
    console.log(`identity violations: ${violations.length}`);
    for (const v of violations.slice(0, 30)) console.log("  " + v);
    process.exit(1);
  }
  console.log(`identity violations: 0 (${BOARDS} boards, ${total} creatures)`);
  process.exit(0);
}

// -- distribution table --
const pad = (s, n) => String(s).padEnd(n);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

console.log(`sample: ${BOARDS} boards · ` + speciesNames.map((n) => `${n} ${(bySpecies[n] || []).length}`).join(" · "));
console.log();

const slots = onlySlot ? [onlySlot] : Object.keys(SLOTS);
for (const slot of slots) {
  const values = SLOTS[slot];
  if (!values) { console.log(`no such slot: ${slot}`); continue; }
  console.log(`## ${slot}`);
  console.log(pad("", 10) + speciesNames.map((n) => pad(n, 8)).join(""));
  for (const v of values) {
    const row = speciesNames.map((n) => {
      const list = bySpecies[n] || [];
      const p = pct(list.filter((c) => c.parts[slot] === v).length, list.length);
      return pad(p === 0 ? "·" : `${p}%`, 8);
    });
    console.log(pad(v, 10) + row.join(""));
  }
  console.log();
}

if (violations.length) {
  console.log(`⚠ identity violations: ${violations.length}`);
  for (const v of violations.slice(0, 20)) console.log("  " + v);
} else {
  console.log("identity violations: 0");
}
