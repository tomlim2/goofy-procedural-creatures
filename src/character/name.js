// A name → a creature — the name screen's one door into the generator (guidelines/name.md). A name becomes a key, the key a roll
// and a species, and from there it is makeCreature, exactly as a board cell. Also the address a card is shared by. Nothing here
// touches the DOM, so the node scripts read the same mapping as the page.

import { makeCreature } from "./spec.js";

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

// The roll is the key's alone — the species never touches it — and the species on ANY has a hash of its own, so which species
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
// A card is shared by its address: ?name= the shown name, and &species= the dropdown's choice when it is not ANY — ANY is where the
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
