// Paint — which of the individual's own colours a part is filled with.
//
// An individual owns five colours (palette.js: skin, cloth, hair, accent, and a pop when it has one) and every
// part is painted from that box, never from a colour of its own. What `paint` adds is the choice of **which**
// of those a part takes. Unset, a part takes what the drawing always took — the defaults below are exactly
// what draw/ did before paint existed, so a roll's creature does not move and a generated spec carries no
// `paint` at all. The editor writes `spec.paint[part]` only when a hand picks another box.
//
// One region per part for now: a part is one colour. Parts that paint more than one thing (a hat with a band,
// a sleeve and a hand) are inspected one at a time before they get a second region.
export const PAINT_DEFAULTS = {
  head: "skin",
  ears: "skin",
  hair: "hair",
  headgear: "accent",
  body: "cloth"
};

// The parts a hand can repaint, in the editor's order.
export const PAINTABLE = Object.keys(PAINT_DEFAULTS);

// The palette key a part is painted with — the hand's choice, or the drawing's own.
export function paintKey(spec, part) {
  return (spec.paint && spec.paint[part]) || PAINT_DEFAULTS[part];
}

// The colour itself. A key the palette does not carry (a pop on an individual without one) falls back to the
// part's default box, so a saved choice never paints with nothing.
export function paintOf(spec, part) {
  const key = paintKey(spec, part);
  const color = key === "pop" ? spec.palette.pop && spec.palette.pop.color : spec.palette[key];
  return color || spec.palette[PAINT_DEFAULTS[part]];
}
