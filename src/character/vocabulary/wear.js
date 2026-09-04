// Wear — which of the individual's materials a part is made of.
//
// An individual wears two materials (spec.js): the **main** one — `material` and `density` — and the **body's** —
// `bodyMaterial` and `bodyDensity`. Every surface that takes a goofy material takes one of the two, and `wear` is
// the choice of **which**. Unset, a part takes what the drawing always took — the head's side the main, the body's
// side the body's — so the defaults below are exactly what draw/ did before wear existed: a roll's creature does
// not move and a generated spec carries no `wear` at all. The editor writes `spec.wear[part]` only when a hand
// puts a part in the other material.
//
// The parts listed are the ones that take a goofy material at all. The rest are marks (eyes, brows, a mouth),
// objects that keep a colour of their own, or flat by rule (the whites of the eyes) — nothing to wear.
export const WEAR_DEFAULTS = {
  head: "main", ears: "main", horns: "main", hair: "main", headgear: "main", nose: "main",
  body: "body", arms: "body", legs: "body", tail: "body"
};

// The parts that wear a material, in the editor's order.
export const WEARABLE = Object.keys(WEAR_DEFAULTS);

// Beyond the two the roll deals, a hand may add materials of its own in the editor: `spec.materials` is a map,
// key → { name, texture, density, colour }, keyed m1, m2 … in the order they were added. A part wears one by its
// key in `wear`, and the material carries its colour with it (colour belongs to the material). The generator
// never writes any; a file carries them.
export const extraOf = (spec, key) => (spec && spec.materials && key && spec.materials[key]) || null;

// Every material the individual wears, in the editor's order: the main, the body's, then the hand's own.
export function materialKeys(spec) {
  return ["main", "body", ...Object.keys((spec && spec.materials) || {})];
}

// Which material a part wears — the hand's choice, or the drawing's own. null for a part that wears none. A key
// that names nothing (a file from elsewhere) falls back to the drawing's own.
export function wearOf(spec, part) {
  const worn = spec.wear && spec.wear[part];
  if (worn === "main" || worn === "body" || extraOf(spec, worn)) return worn;
  return WEAR_DEFAULTS[part] || null;
}

// The drawing's side for a part — "body" for the body's material, "head" for the main, or the key of one of the
// hand's own. draw/body.js materialOf and surfaceHand take the side; a part hands in its name and gets its side here
export function sideOf(spec, part) {
  const worn = wearOf(spec, part);
  return worn === "body" ? "body" : worn && worn !== "main" ? worn : "head";
}
