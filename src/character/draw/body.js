// Body — torso and markings. Docs: guidelines/character/parts.md § body

import { blobPath } from "../../shape.js";
import { valueStep } from "../../medium/materials.js";
import { shade, isDark, luminance } from "../../color.js";
import { FURS, CALICO_MID } from "../vocabulary/palette.js";

// The value step a surface draws at. A dog, a cat or an imp is **one mass** — the body is the head's color or a close tone of it
// (spec.js) — so both take the head color's step: a tone that crosses a step would otherwise hatch the body differently from the head.
// A human is two surfaces (skin, clothes), each at its own darkness. The hand (the density slot) moves the step either way
export function surfaceValue(spec, color) {
  return valueStep(spec.species === "human" ? color : spec.palette.skin, spec.parts.density);
}

// Paints a part's surface with the creature's goofy material — the one way in for every skin, fur and cloth surface that is not the head or
// the body (ears, the muzzle, hands, boots, sleeves, the tail, hats): guidelines/drawing.md § what takes the goofy material. The value step
// is the creature's (one mass on a dog, a cat or an imp), or the part's own color's when `own` — a hat is an object, not the fur
export function paintPart(fills, spec, path, color, { own = false, flat = false, offset } = {}) {
  const options = { color, value: own ? valueStep(color, spec.parts.density) : surfaceValue(spec, color) };
  if (offset) options.offset = offset;
  fills.paint(path, flat ? "FLAT" : (spec.parts.material || "flat").toUpperCase(), options);   // flat: the whites of the eyes — never textured
}

// The creature's pattern — the `pattern` slot as part of the goofy material's base color (medium/materials.js patternOn). Light ink on a dark body,
// the same rule as face ink. calico is not a line pattern but decals — color regions of the base (bodyDecals / headDecals), and none is none
function patternOf(spec) {
  const kind = spec.parts.pattern;
  if (!kind || kind === "none" || kind === "calico") return undefined;   // a spec without the slot (an older tree's, in drawdiff) has no pattern
  return { kind, color: luminance(spec.palette.cloth) < 120 ? "#e9e3d5" : spec.palette.ink };
}

export function drawBody(ink, fills, spec, box, noise) {
  if (box.quad) {
    // A body lying horizontally. The head covers the front, so the body reaches backward.
    const cx = box.bodyCx;
    const cy = (box.legTop + box.bodyTop) / 2;
    const path = blobPath(cx, cy, box.bodyW, (box.bodyTop - box.legTop) / 2, {
      lumps: 4, amount: 0.1, noise, phase: spec.proportions.wobbleSeed * 0.02
    });
    const decals = bodyDecals(spec, path, noise);
    fills.paint(path, (spec.parts.material || "flat").toUpperCase(), { color: spec.palette.cloth, offset: spec.palette.fillOffset, pattern: patternOf(spec), decals, value: surfaceValue(spec, spec.palette.cloth) });   // the goofy material (the material slot; flat when absent) at the creature's value step; the pattern and the decals in its base
    // No shading here — it is the light's job (guidelines/drawing.md § the light), not the surface's
    ink.contour(path, { color: spec.palette.ink });   // the goofy outline (stroke.js GOOFY_OUTLINES)
    decalEdges(ink, spec, decals);
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
      lumps: 4, amount: 0.12, noise, phase: spec.proportions.wobbleSeed * 0.02
    });
  }

  const decals = bodyDecals(spec, path, noise);

  fills.paint(path, (spec.parts.material || "flat").toUpperCase(), { color: spec.palette.cloth, offset: spec.palette.fillOffset, pattern: patternOf(spec), decals, value: surfaceValue(spec, spec.palette.cloth) });   // the goofy material (the material slot; flat when absent) at the creature's value step; the pattern and the decals in its base
  // No shading here — it is the light's job (guidelines/drawing.md § the light), not the surface's
  ink.contour(path, { color: ink0 });   // the goofy outline (stroke.js GOOFY_OUTLINES)
  decalEdges(ink, spec, decals);
  return { path, top, bottom, w, cx: 0 };
}

// Colors and placement for the calico (pattern calico) — per individual (wobbleSeed, no rng). null if there is none.
//   dark  one black fur (FURS) · mid a warm tan (CALICO_MID — cats only; dogs are piebald, so black only) · side which side the head patch and black ear attach to (−1 left / +1 right)
// The base stays the skin (when it is calico, spec.js withholds black fur to guarantee a light base). Every color is inside the palette — this is not a saturated accent
export function calicoColors(spec) {
  if (spec.parts.pattern !== "calico" || (spec.species !== "cat" && spec.species !== "pup")) return null;
  const seed = spec.proportions.wobbleSeed;
  return { dark: FURS[seed % FURS.length], mid: spec.species === "cat" ? CALICO_MID : null, side: (seed >> 4) % 2 ? 1 : -1 };
}

// A decal — a color region that takes its edge from its host's own outline (guidelines/drawing.md § decals). Of the closed outline
// point list (blobPath, 48 points, angle 0 = right, counter-clockwise) one stretch — from angle `from` across `span` — is the outer
// edge exactly, so nothing sticks out and the decal wears the host's lumps; the inner edge is those points pulled toward the centre by
// depth (0 at both ends, deepest in the middle, bumpy with noise), and the two close into one polygon. The fill is a fan from the
// centre (stroke.js fill), so span stays at or below 130° — a crescent opened too far leaves corners the centroid cannot see.
// Returns { path (closed), inner (the inner edge only — the only part that gets a line) }
export function decalAlong(outline, fromDeg, spanDeg, depth, noise, phase) {
  const n = outline.length;
  let cx = 0, cy = 0;
  for (const [x, y] of outline) { cx += x; cy += y; }
  cx /= n; cy /= n;
  const i0 = Math.round((fromDeg / 360) * n), count = Math.max(3, Math.round((spanDeg / 360) * n));
  const outer = [];
  for (let k = 0; k <= count; k += 1) outer.push(outline[(i0 + k + n * 4) % n]);
  const inner = [];
  for (let k = outer.length - 1; k >= 0; k -= 1) {
    const [x, y] = outer[k];
    const t = k / (outer.length - 1);
    // Both ends touch the outline (depth 0) and the middle is deep — the decal's edge falls away from the outline smoothly. Bumpy with noise
    const d = depth * Math.sin(Math.PI * t) * (1 + (noise ? noise(phase + k * 1.7) : 0) * 0.35);
    inner.push([x + (cx - x) * d, y + (cy - y) * d]);
  }
  return { path: [...outer, ...inner.slice(1, -1)], inner };
}

// The body's decals (the calico) — black wrapping the rump (the tail end), tan on the front of the belly (cats). Dogs get one big black.
// Angles are relative to blobPath (0 right = the tail end on a quad, 90 up, 180 left = the head end). The front top of the body is hidden
// by the big head, so the decals go at the back end and the front of the belly — put one mid-back and it disappears behind the head.
// [] when the creature is not a calico
export function bodyDecals(spec, path, noise) {
  const c = calicoColors(spec);
  if (!c || !path) return [];
  const ph = spec.proportions.wobbleSeed * 0.013;
  const flip = c.side > 0;   // slightly offset per individual — so the decals do not line up in the same place across the board
  const one = (from, span, depth, color, phase) => ({ ...decalAlong(path, from, span, depth, noise, phase), color });
  return c.mid
    ? [one(flip ? -40 : -15, 95, 0.55, c.dark, ph), one(flip ? 215 : 195, 75, 0.45, c.mid, ph + 7)]
    : [one(flip ? -35 : -10, 120, 0.6, c.dark, ph)];
}

// The head's decals (the calico) — black on the side, **a cap shape from the crown leaning that way** (the ear on that side is black too,
// so the two read as one mass — head.js drawCatEars/drawPupEars), plus a small tan low on the opposite side (the cheek, cats).
// A black decal **must never reach the eyes or brows** — line-drawn eyes (sleepy, half, dot…) and brows are black ink and vanish on top
// of black. The placement that comes down the side (100°~185°) caught the eyes on 158 of 600 creatures; the crown placement (left
// 75°~150° / right 30°~105°, depth 0.4) catches 0. A tan decal keeps its contrast against ink, so the cheek is fine
export function headDecals(spec, headPath, noise) {
  const c = calicoColors(spec);
  if (!c) return [];
  const ph = spec.proportions.wobbleSeed * 0.017 + 3;
  const one = (from, span, depth, color, phase) => ({ ...decalAlong(headPath, from, span, depth, noise, phase), color });
  const out = [one(c.side < 0 ? 75 : 30, 75, 0.4, c.dark, ph)];
  if (c.mid) out.push(one(c.side < 0 ? 300 : 210, 50, 0.4, c.mid, ph + 5));
  return out;
}

// A decal's only line — its inner edge (the outer edge already has the contour). Drawn after the contour, in the host's ink
export function decalEdges(ink, spec, decals) {
  for (const d of decals) ink.line(d.inner, { color: spec.palette.ink, weight: 0.6 });
}


