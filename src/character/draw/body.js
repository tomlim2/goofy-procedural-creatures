// Body — torso and markings. Docs: guidelines/character/parts.md § body

import { paintOf } from "../vocabulary/paint.js";
import { blobPath, crumple } from "../../shape.js";
import { stepOf } from "../../medium/materials.js";
import { shade, isDark, luminance } from "../../color.js";
import { MARKS } from "../vocabulary/palette.js";
import { isGhost } from "../spec.js";
import { sideOf, wearOf, surfaceOf, colourOf, WEAR_DEFAULTS, BOXES } from "../vocabulary/wear.js";
const BOXES_SET = new Set(BOXES);

// The creature's goofy material, by name — **the one place a material is named**. `where` is the half of the creature asking: the
// head's is the `material` slot, the body's is `bodyMaterial` unless that says `same` (most of them). Everything standing on the head
// counts as the head — ears, horns, hair, a hat, the muzzle, the face — and everything hanging off the body as the body — limbs,
// hands, boots, sleeves, the tail. A spec without either slot — an older tree's, in drawdiff — is flat, like every late slot's default
// `where` is what the part wears (vocabulary/wear.js — a box, or a material of the hand's own); the two older words
// still work: "body" is the cloth, "head" the skin
const keyOf = (where) => (where === "body" ? "cloth" : !where || where === "head" ? "skin" : where);
export function materialOf(spec, where = "head") {
  return (surfaceOf(spec, keyOf(where)).texture || "flat").toUpperCase();
}

// **The one place a surface's step is worked out.** `where` is the half asking, as in `materialOf`: the head's step is the `density`
// slot; the body's is `bodyDensity` unless that says `same` (most of them), so a body can draw darker or lighter than its head along
// the same line the tool splits on. Everything on one side draws at one step — head, ears and hat alike; torso, limbs and tail alike.
// Spreads straight into paint()
export function surfaceHand(spec, where = "head") {
  // The value step is the creature's hand on the material (the `density` slot), or the body's own on the body's side
  const { density } = surfaceOf(spec, keyOf(where));
  // A **ghost draws its base and no texture at all** (`only: "base"`). Every tone a material makes is a shade of
  // the part's own colour, and a ghost's collapsed to one pale tone, so its fur, hatching and dust came out pale
  // on pale and it read as a blank shape. Handing the texture a tone of its own was drawn and dropped: grey read
  // as a second outline, and once the marks took the ghost's black (every line on a ghost is black — stroke.js
  // inkColor) graphite's rules became hard slashes ruled clean across the creature. There is nothing under a
  // ghost's skin to hatch. A flat pale body and black lines is the whole of it
  return { value: stepOf(density), only: isGhost(spec) ? "base" : undefined };
}

// Paints a part's surface with the creature's goofy material — the one way in for every skin, fur and cloth surface that is not the head or
// the body (ears, the muzzle, hands, boots, sleeves, the tail, hats): guidelines/drawing.md § what takes the goofy material. The value step
// is the side's — the head's `density`, or on the body's side the body's own when `bodyDensity` names one.
// `part` names the part painting, and its side follows what it wears (vocabulary/wear.js sideOf — the main material or
// the body's, by default the head's side and the body's side); `body` is the older word for the body's side, kept for
// the callers that are not a part of their own
export function paintPart(fills, spec, path, color, { own = false, flat = false, body = false, part = null, strip, stripT, skinT } = {}) {
  const where = part ? wearOf(spec, part) : body ? "cloth" : "skin";
  // Colour belongs to the material. A part in its own box is painted the colour the drawing chose for it (a tone
  // of the box, a lid a shade darker); moved by a hand to another box or a material of its own, that one's
  // colour. A ghost's one pale tone wins over a hand's own colour (spec.js ghostPalette); a box's is already a ghost's
  const moved = part && where !== WEAR_DEFAULTS[part];
  const worn = moved ? colourOf(spec, where) : null;
  const options = { color: worn && (BOXES_SET.has(where) || !isGhost(spec)) ? worn : color, ...surfaceHand(spec, where) };
  if (strip) options.strip = strip;   // a tube's base cut as a strip between its rails (the tail — bones bend it)
  if (stripT) options.stripT = stripT;   // …tagged per rung with its t along the spine (the skin reads its bones from the tag)
  if (skinT !== undefined) options.skinT = skinT;   // a fill at one t of the spine (a bead, a tuft, a pom)
  fills.paint(path, flat ? "FLAT" : materialOf(spec, where), options);   // flat: a fill that is never textured by rule. body: it hangs off the torso, so it takes the body's material
}

// The creature's pattern — the `pattern` slot as part of the goofy material's base color (medium/materials.js patternOn). Light ink on a dark body,
// the same rule as face ink, and none is none. A lizard's pattern is drawn in its SECOND scale color instead
// (palette.pattern2, spec.js) — color on color is that species' whole point
export function patternOf(spec) {
  const kind = spec.parts.pattern;
  if (!kind || kind === "none") return undefined;   // a spec without the slot (an older tree's, in drawdiff) has no pattern
  if (spec.palette.pattern2) return { kind, color: spec.palette.pattern2 };
  return { kind, color: luminance(spec.palette.cloth) < 120 ? MARKS.light : spec.palette.ink };
}

export function drawBody(ink, fills, spec, box, noise) {
  if (box.quad) {
    // A body lying horizontally. The head covers the front, so the body reaches backward.
    const cx = box.bodyCx;
    const cy = (box.legTop + box.bodyTop) / 2;
    const path = blobPath(cx, cy, box.bodyW, (box.bodyTop - box.legTop) / 2, {
      lumps: 4, amount: 0.1, noise, phase: spec.proportions.hand * 0.02
    });
    fills.paint(path, materialOf(spec, sideOf(spec, "body")), { color: paintOf(spec, "body"), pattern: patternOf(spec), ...surfaceHand(spec, sideOf(spec, "body")) });   // the goofy material (the material slot; flat when absent) at the creature's value step, the pattern in its base
    // No shading here — it is the light's job (guidelines/drawing.md § the light), not the surface's
    ink.contour(path, { color: spec.palette.ink });   // the goofy outline (stroke.js GOOFY_OUTLINES)
    return { path, top: box.bodyTop, bottom: box.legTop, w: box.bodyW, cx };
  }

  const kind = spec.parts.body;
  const w = box.bodyW;
  const bottom = box.legTop;
  const top = box.bodyTop;
  const ink0 = spec.palette.ink;
  let path;

  if (kind === "box") {
    path = [[-w, bottom], [-w, top], [w, top], [w, bottom]];
  } else if (kind === "dress") {
    path = [[-w * 1.35, bottom], [-w * 0.6, top], [w * 0.6, top], [w * 1.35, bottom]];
  } else if (kind === "tube") {
    path = [[-w * 0.62, bottom], [-w * 0.62, top], [w * 0.62, top], [w * 0.62, bottom]];
  } else {
    path = blobPath(0, (bottom + top) / 2, w, (top - bottom) / 2, {
      lumps: 4, amount: 0.12, noise, phase: spec.proportions.hand * 0.02
    });
  }

  fills.paint(path, materialOf(spec, sideOf(spec, "body")), { color: paintOf(spec, "body"), pattern: patternOf(spec), ...surfaceHand(spec, sideOf(spec, "body")) });   // the goofy material (the material slot; flat when absent) at the creature's value step, the pattern in its base
  // No shading here — it is the light's job (guidelines/drawing.md § the light), not the surface's
  ink.contour(path, { color: ink0 });   // the goofy outline (stroke.js GOOFY_OUTLINES)
  return { path, top, bottom, w, cx: 0 };
}


