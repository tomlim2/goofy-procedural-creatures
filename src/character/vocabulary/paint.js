// Paint — the colour a part is filled with: its material's (vocabulary/wear.js). Kept as the one word draw/ asks
// with. A part in its own box takes the box's colour; moved to another box, that box's; to a material of the
// hand's own, that material's — colour belongs to the material. A ghost's one pale tone (spec.js ghostPalette)
// is the palette's, so a box's colour is already a ghost's; a hand's own colour is passed over on a ghost.
import { wearOf, colourOf, isBox, WEAR_DEFAULTS } from "./wear.js";

const ghostly = (spec) => !!(spec.parts && spec.parts.ghost && spec.parts.ghost !== "none");

export function paintOf(spec, part) {
  const worn = wearOf(spec, part);
  const colour = colourOf(spec, worn);
  if (colour && (isBox(worn) || !ghostly(spec))) return colour;
  return colourOf(spec, WEAR_DEFAULTS[part]) || spec.palette.skin;
}

// A mark's ink — an eye's line, a brow, the mouth. In its own material the drawing's own choice (`fallback`:
// the face ink, light on a dark face); moved by a hand, the worn material's colour.
export function markInkOf(spec, part, fallback) {
  const worn = wearOf(spec, part);
  if (!worn || worn === WEAR_DEFAULTS[part]) return fallback;
  const colour = colourOf(spec, worn);
  return colour && (isBox(worn) || !ghostly(spec)) ? colour : fallback;
}
