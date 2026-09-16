// A name → a creature — the name screen's one door into the generator (guidelines/name.md). A name becomes a key, the key a roll
// and a species, and from there it is makeCreature, exactly as a board cell. Also the address a card is shared by, and what the card
// reads off the creature's parts: its size (♥) and its rarity. Nothing here touches the DOM, so the node scripts read the same mapping
// as the page.

import { makeCreature, slotWeights } from "./spec.js";
import { layout } from "./draw/layout.js";
import { SLOTS, ARCHETYPES, SPECIES } from "./vocabulary/index.js";

// The species a name can be — the board's lanes without the house
export const NAME_SPECIES = ["human", "cat", "pup", "imp", "rex"];

// The mapping's version, salted into every hash. If the mapping itself ever has to change, a new salt says so out loud instead
// of quietly moving every name
const SALT = "menagerie:name:v1:";

// The key a name is hashed by. NFKC (the full-width ＴＯＭ is TOM, a decomposed Hangul syllable one syllable), no control or
// zero-width characters, one space for every run of white space, trimmed, lower case — so " 홍길동 ", "Tom  Lim" and "TOM LIM"
// are each one name. An empty key is no name
export function nameKey(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/[\p{Cc}\u200B-\u200D\u2060\uFEFF]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

// The name the card shows — what was typed, NFC and trimmed. The key is only ever hashed
export const shownName = (text) => String(text ?? "").normalize("NFC").trim();

// FNV-1a over the UTF-8 bytes, through murmur3's fmix32 finalizer — an unsigned 32-bit number, the kind randomRoll() makes
const encoder = new TextEncoder();
function hash32(text) {
  let h = 0x811c9dc5;
  for (const byte of encoder.encode(text)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// The roll is the key's alone — the species never touches it — and the species on ALL has a hash of its own, so which species
// a name is and what it looks like do not lean on each other
export const nameRoll = (key) => hash32(SALT + key);
export const nameSpecies = (key) => NAME_SPECIES[hash32(`${SALT}species:${key}`) % NAME_SPECIES.length];

// The creature a name makes. `species` is "all" (the name picks) or one of NAME_SPECIES (used as it is); null for a name whose
// key comes out empty
export function creatureOfName(text, species = "all") {
  const key = nameKey(text);
  if (!key) return null;
  const kind = NAME_SPECIES.includes(species) ? species : nameSpecies(key);
  const roll = nameRoll(key);
  return { key, shown: shownName(text), roll, species: kind, spec: makeCreature(roll, kind) };
}

// -- the address --
// A card is shared by its address: ?name= the shown name, and &species= the dropdown's choice when it is not ALL — ALL is where the
// screen starts, and every screen leaves its starting values out of the address. URLSearchParams does the escaping, so a name with
// & = # + % or a space in it comes back as it went
export function addressOfName(text, species = "all") {
  const query = new URLSearchParams({ name: shownName(text) });
  if (NAME_SPECIES.includes(species)) query.set("species", species);
  return query.toString();
}

// What an address carries: { text, species } — text "" when it names nobody, species "all" when it names none a name can be
export function nameOfAddress(search) {
  const query = new URLSearchParams(search);
  const species = query.get("species");
  return { text: query.get("name") ?? "", species: NAME_SPECIES.includes(species) ? species : "all" };
}

// -- ♥ --
// Its size: the head's and the body's areas, laid onto 30–150 in tens. The range is the 5th and 95th percentile of that area over
// all five species together (scripts/names.mjs measures it), so a rex runs high and a cat low — a big creature has more to love
export const HEART_RANGE = [0.0594, 0.2341];
export const sizeOf = (spec) => {
  const box = layout(spec);
  return box.headRx * box.headRy + box.bodyW * box.bodyH;
};
export function heartsOf(spec) {
  const k = (sizeOf(spec) - HEART_RANGE[0]) / (HEART_RANGE[1] - HEART_RANGE[0]);
  return 30 + Math.round(Math.min(1, Math.max(0, k)) * 12) * 10;
}

// -- rarity --
// A part's share of the weights that picked it. null for a slot the creature does not carry, or a value those weights do not hold —
// a constraint's overwrite was not picked, so it says nothing about how rare the creature is
function shareOf(species, archetype, slot, value) {
  const weights = slotWeights(species, archetype, slot);
  if (!weights) return SLOTS[slot].includes(value) ? 1 / SLOTS[slot].length : null;
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  const hit = weights.find(([v]) => v === value);
  return hit && hit[1] > 0 ? hit[1] / total : null;
}

// How unlikely its parts are together — the sum of −ln(share) over them
export function rarityScore(spec) {
  const species = SPECIES.find((s) => s.name === spec.species);
  const archetype = ARCHETYPES.find((a) => a.name === spec.archetype);
  if (!species || !archetype) return 0;
  let score = 0;
  for (const slot of Object.keys(SLOTS)) {
    const share = spec.parts[slot] === undefined ? null : shareOf(species, archetype, slot, spec.parts[slot]);
    if (share) score -= Math.log(share);
  }
  return score;
}

// A species' 60th and 90th percentile of rarityScore (scripts/names.mjs measures them), so the stars fall to 60 · 30 · 10% of every
// species. Per species, because the score is not fair across them: a human carries 2–4 parts under a 10% share where a cat carries 0–2
export const RARITY_CUTS = {
  human: [43.209, 46.818],
  cat: [36.136, 39.719],
  pup: [36.508, 40.207],
  imp: [36.185, 39.18],
  rex: [31.471, 35.108]
};
export const RARITY_NAMES = ["COMMON", "RARE", "LEGENDARY"];

// 1 · 2 · 3 stars
export function rarityOf(spec) {
  const [rare, legendary] = RARITY_CUTS[spec.species] || [Infinity, Infinity];
  const score = rarityScore(spec);
  return score >= legendary ? 3 : score >= rare ? 2 : 1;
}
