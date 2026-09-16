// The name screen's mapping and card on their own (guidelines/name.md § checks).
//   node scripts/names.mjs             the checks, the constants as measured, and sample cards
//   node scripts/names.mjs --measure   only the constants — RARITY_CUTS and HEART_RANGE as they measure, to paste into src/character/name.js
// Exits 1 when a check fails: the species on ALL off one in five, a name's variants not one name, an address that does not bring
// back its card, a species' stars off 60 · 30 · 10%, the ♥ range drifted from its measure, a move a card can show with no label.

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = await import(pathToFileURL(join(root, "src/character/index.js")).href);
const { cardOf, moveLabel } = await import(pathToFileURL(join(root, "src/card.js")).href);

const measureOnly = process.argv.includes("--measure");
const madeUp = (i) => `name ${i}`;   // names nobody has, as many as asked for
let failed = 0;
const check = (ok, line) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failed += 1;
};
const pct = (x) => `${x.toFixed(1)}%`;
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

// -- the constants, measured: each species' 60th and 90th percentile of the rarity score, and the 5th and 95th of the size over all five --
const PER_SPECIES = 10000;
const scores = {};
const sizes = [];
for (const species of C.NAME_SPECIES) {
  scores[species] = [];
  for (let i = 0; i < PER_SPECIES; i += 1) {
    const { spec } = C.creatureOfName(madeUp(i), species);
    scores[species].push(C.rarityScore(spec));
    sizes.push(C.sizeOf(spec));
  }
  scores[species].sort((a, b) => a - b);
}
sizes.sort((a, b) => a - b);
const cuts = Object.fromEntries(C.NAME_SPECIES.map((s) => [s, [quantile(scores[s], 0.6), quantile(scores[s], 0.9)].map((v) => Number(v.toFixed(3)))]));
const range = [quantile(sizes, 0.05), quantile(sizes, 0.95)].map((v) => Number(v.toFixed(4)));
console.log(`measured over ${PER_SPECIES} names a species:`);
console.log(`  RARITY_CUTS ${JSON.stringify(cuts)}`);
console.log(`  HEART_RANGE ${JSON.stringify(range)}`);
if (measureOnly) process.exit(0);
console.log("");

// -- the species on ALL: one in five --
const N = 10000;
const counts = Object.fromEntries(C.NAME_SPECIES.map((s) => [s, 0]));
for (let i = 0; i < N; i += 1) counts[C.nameSpecies(C.nameKey(madeUp(i)))] += 1;
const shares = C.NAME_SPECIES.map((s) => [s, (100 * counts[s]) / N]);
check(shares.every(([, p]) => Math.abs(p - 20) <= 1.5), `the species on ALL over ${N} names — ${shares.map(([s, p]) => `${s} ${pct(p)}`).join(" · ")}`);

// -- a name's variants are one name --
const SAME = [
  [" 홍길동 ", "홍길동".normalize("NFD"), "홍길동\u200b", "\u3000홍길동"],
  ["Tom  Lim", "TOM LIM", "tom\u3000lim", "\tTom Lim\n", "\uff34\uff2f\uff2d \uff2c\uff29\uff2d"]
];
const creature = (text) => {
  const made = C.creatureOfName(text);
  return made && JSON.stringify([made.roll, made.species, made.spec]);
};
for (const group of SAME) {
  check(new Set(group.map(creature)).size === 1, `one name — ${group.map((t) => JSON.stringify(t)).join(" = ")}`);
}
check(C.creatureOfName("   ") === null && C.creatureOfName("\u200b\u200d\t") === null, "a name that is only spaces and invisible characters is no name");
const other = C.creatureOfName("Tom Lim", "cat");
const same = C.creatureOfName("Tom Lim");
check(other.roll === same.roll, "the roll is the name's alone — choosing a species does not move it");

// -- the address: a link brings back the card it was drawn at --
const LINKED = ["홍길동", " Tom  Lim ", "たなか", "Élodie 🐈", "a&b=c#d+e%f?g/h"];
const cardAt = (made) => made && JSON.stringify([made.shown, made.roll, made.species, made.spec]);
const back = LINKED.flatMap((text) => ["all", "cat"].map((species) => {
  const read = C.nameOfAddress(`?${C.addressOfName(text, species)}`);
  return read.species === species && cardAt(C.creatureOfName(read.text, read.species)) === cardAt(C.creatureOfName(text, species));
}));
check(back.every(Boolean), `an address brings back its card — ${LINKED.map((t) => JSON.stringify(t)).join(" · ")}, each on ALL and on CAT`);
check(
  !C.addressOfName("Tom", "all").includes("species") && C.nameOfAddress("?name=Tom&species=dragon").species === "all" && C.nameOfAddress("").text === "",
  "ALL stays out of the address, a species no name can be reads as ALL, and an address with no name names nobody"
);

// -- the stars: 60 · 30 · 10% of every species, with the cut-offs the page carries --
for (const species of C.NAME_SPECIES) {
  const tiers = [0, 0, 0];
  const [rare, legendary] = C.RARITY_CUTS[species];
  for (const score of scores[species]) tiers[score >= legendary ? 2 : score >= rare ? 1 : 0] += 1;
  const got = tiers.map((n) => (100 * n) / PER_SPECIES);
  const ok = Math.abs(got[0] - 60) <= 3 && Math.abs(got[1] - 30) <= 3 && Math.abs(got[2] - 10) <= 3;
  check(ok, `${species} stars ★ ${pct(got[0])} · ★★ ${pct(got[1])} · ★★★ ${pct(got[2])} (cut-offs ${C.RARITY_CUTS[species].join(" · ")}, measured ${cuts[species].join(" · ")})`);
}

// -- ♥: the range the page carries against the one measured --
const near = (a, b) => Math.abs(a - b) <= 0.05 * b;
check(near(C.HEART_RANGE[0], range[0]) && near(C.HEART_RANGE[1], range[1]), `♥ range ${C.HEART_RANGE.join("–")} (measured ${range.join("–")})`);

// -- the moves: every one a card can show has a label; how many cards show two --
const MOVE_SAMPLE = 200;
let unlabelled = [];
const two = {};
for (const species of C.NAME_SPECIES) {
  two[species] = 0;
  for (let i = 0; i < MOVE_SAMPLE; i += 1) {
    const card = cardOf(C.creatureOfName(madeUp(i), species));
    if (card.moves.length >= 2) two[species] += 1;
    for (const move of card.moves) if (move.name !== "float" && !moveLabel(move.name)) unlabelled.push(move.name);
  }
}
unlabelled = [...new Set(unlabelled)];
check(unlabelled.length === 0, `every move a card can show has a label${unlabelled.length ? ` — not ${unlabelled.join(", ")}` : ""}`);
console.log(`     two moves on ${C.NAME_SPECIES.map((s) => `${s} ${two[s]}/${MOVE_SAMPLE}`).join(" · ")}`);

// -- sample cards --
console.log("");
for (const text of ["홍길동", "Tom Lim", "たなか", "🐈", "menagerie", "Ada Lovelace"]) {
  const made = C.creatureOfName(text);
  const card = cardOf(made);
  const moves = card.moves.map((m) => (m.count === null ? m.label : `${m.label} ×${m.count}`)).join(" · ");
  console.log(`${JSON.stringify(text).padEnd(16)} ♥ ${String(card.hearts).padStart(3)}  ${card.kind.padEnd(18)} ${"★".repeat(card.stars).padEnd(3)}  ${moves}`);
}

console.log("");
console.log(failed ? `${failed} check${failed > 1 ? "s" : ""} failed` : "every check passed");
process.exitCode = failed ? 1 : 0;
