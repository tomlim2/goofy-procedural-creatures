// The name screen's mapping and card on their own (guidelines/name.md § checks).
//   node scripts/names.mjs   the checks, and sample cards in both languages
// Exits 1 when a check fails: the species on ANY off one in five, a name's variants not one name, an address that does not bring
// back its card, a species with no Korean name (lang.js).

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = await import(pathToFileURL(join(root, "src/character/index.js")).href);
const { cardOf } = await import(pathToFileURL(join(root, "src/card.js")).href);
const { WORDS } = await import(pathToFileURL(join(root, "src/lang.js")).href);

const madeUp = (i) => `name ${i}`;   // names nobody has, as many as asked for
let failed = 0;
const check = (ok, line) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failed += 1;
};
const pct = (x) => `${x.toFixed(1)}%`;

// -- the species on ANY: one in five --
const N = 10000;
const counts = Object.fromEntries(C.NAME_SPECIES.map((s) => [s, 0]));
for (let i = 0; i < N; i += 1) counts[C.nameSpecies(C.nameKey(madeUp(i)))] += 1;
const shares = C.NAME_SPECIES.map((s) => [s, (100 * counts[s]) / N]);
check(shares.every(([, p]) => Math.abs(p - 20) <= 1.5), `the species on ANY over ${N} names — ${shares.map(([s, p]) => `${s} ${pct(p)}`).join(" · ")}`);

// -- a name's variants are one name --
const SAME = [
  [" 홍길동 ", "홍길동".normalize("NFD"), "홍길동​", "　홍길동"],
  ["Tom  Lim", "TOM LIM", "tom　lim", "\tTom Lim\n", "ＴＯＭ ＬＩＭ"]
];
const creature = (text) => {
  const made = C.creatureOfName(text);
  return made && JSON.stringify([made.roll, made.species, made.spec]);
};
for (const group of SAME) {
  check(new Set(group.map(creature)).size === 1, `one name — ${group.map((t) => JSON.stringify(t)).join(" = ")}`);
}
check(C.creatureOfName("   ") === null && C.creatureOfName("​‍\t") === null, "a name that is only spaces and invisible characters is no name");
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
check(back.every(Boolean), `an address brings back its card — ${LINKED.map((t) => JSON.stringify(t)).join(" · ")}, each on ANY and on CAT`);
check(
  !C.addressOfName("Tom", "all").includes("species") && C.nameOfAddress("?name=Tom&species=dragon").species === "all" && C.nameOfAddress("").text === "",
  "ANY stays out of the address, a species no name can be reads as ANY, and an address with no name names nobody"
);

// -- Korean: every species has a name (lang.js WORDS.ko) --
check(C.NAME_SPECIES.every((s) => WORDS.ko.species[s]), `every species has a Korean name — ${C.NAME_SPECIES.map((s) => `${s} ${WORDS.ko.species[s] || "?"}`).join(" · ")}`);

// -- sample cards, in both languages --
console.log("");
for (const text of ["홍길동", "Tom Lim", "たなか", "🐈", "menagerie", "Ada Lovelace"]) {
  const made = C.creatureOfName(text);
  console.log(`${JSON.stringify(text).padEnd(16)} ${cardOf(made).kind.padEnd(6)} ${cardOf(made, "ko").kind}`);
}

console.log("");
console.log(failed ? `${failed} check${failed > 1 ? "s" : ""} failed` : "every check passed");
process.exitCode = failed ? 1 : 0;
