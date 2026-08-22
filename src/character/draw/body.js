// Body — torso and markings. Docs: guidelines/character/parts.md § body

import { blobPath } from "../../stroke.js";
import { shade, isDark, luminance } from "../../color.js";
import { FURS, CALICO_MID } from "../vocabulary/palette.js";

// The creature's pattern — the `pattern` slot as part of the material's base color (stroke.js patternOn). Light ink on a dark body,
// the same rule as face ink. calico is not a line pattern but color regions (drawCalico / drawHeadCalico), and none is none
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
    fills.paint(path, (spec.parts.material || "flat").toUpperCase(), { color: spec.palette.cloth, offset: spec.palette.fillOffset, pattern: patternOf(spec), hand: spec.parts.density });   // the material and density slots (flat, a normal hand when absent), the pattern in its base
    // The body's scribble shading is off — an ellipse it cannot clip to the contour (see drawHead); it returns as the light's shade
    ink.contour(path, "PENCIL", { color: spec.palette.ink, closed: true });   // the goofy outline (stroke.js GOOFY_OUTLINES)
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

  fills.paint(path, (spec.parts.material || "flat").toUpperCase(), { color: spec.palette.cloth, offset: spec.palette.fillOffset, pattern: patternOf(spec), hand: spec.parts.density });   // the material and density slots (flat, a normal hand when absent), the pattern in its base
  // The body's scribble shading is off — on a short or wide torso the tilted ellipse poked past the contour; it returns as the light's shade
  ink.contour(path, "PENCIL", { color: ink0, closed: true });   // the goofy outline (stroke.js GOOFY_OUTLINES)
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

// A patch that sits along the outline — of the closed outline point list (blobPath, 48 points, angle 0 = right, counter-clockwise), it takes the outer points from angle `from` across `span`,
// then joins an inner curve (bumpy with noise) made by pulling those points toward the centre by depth, and closes it. The outer edge is **exactly** the outline, so nothing sticks out,
// and the patch takes on the calico-specific shape that wraps the edge of the body or head. The fill is a fan from the centre (stroke.js fill), so span stays at or below 130° —
// a crescent opened too far leaves corners the centroid cannot see. Returns { path (closed), inner (the inner curve only — the only part that gets a line) }
export function outlinePatch(outline, fromDeg, spanDeg, depth, noise, phase) {
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
    // Both ends touch the outline (depth 0) and the middle is deep — the patch edge falls away from the outline smoothly. Bumpy with noise
    const d = depth * Math.sin(Math.PI * t) * (1 + (noise ? noise(phase + k * 1.7) : 0) * 0.35);
    inner.push([x + (cx - x) * d, y + (cy - y) * d]);
  }
  return { path: [...outer, ...inner.slice(1, -1)], inner };
}

// One patch — the fill plus a thin line on the inner edge only (the outer edge already has the outline)
function patch(ink, fills, outline, fromDeg, spanDeg, depth, color, inkColor, noise, phase) {
  const { path, inner } = outlinePatch(outline, fromDeg, spanDeg, depth, noise, phase);
  fills.paint(path, "FLAT", { color });   // a cutout with no line of its own
  ink.stroke(inner, { color: inkColor, width: 0.007, jitter: 0.004 });
}

// Body patches (calico) — black wrapping the rump (the tail end), tan on the front of the belly (cats). Dogs get one big black. Angles are relative to blobPath (0 right = the tail end on a quad,
// 90 up, 180 left = the head end). The front top of the body is hidden by the big head, so the patches go at the back end and the front of the belly — put one mid-back and it disappears behind the head
function drawCalicoBody(ink, fills, spec, body, noise) {
  const c = calicoColors(spec);
  if (!c || !body.path) return;
  const inkColor = spec.palette.ink;
  const ph = spec.proportions.wobbleSeed * 0.013;
  const flip = c.side > 0;   // slightly offset per individual — so patches do not line up in the same place across the board
  if (c.mid) {
    patch(ink, fills, body.path, flip ? -40 : -15, 95, 0.55, c.dark, inkColor, noise, ph);
    patch(ink, fills, body.path, flip ? 215 : 195, 75, 0.45, c.mid, inkColor, noise, ph + 7);
  } else {
    patch(ink, fills, body.path, flip ? -35 : -10, 120, 0.6, c.dark, inkColor, noise, ph);
  }
}

// Head patch (calico) — black on the side, **a cap shape from the crown leaning that way** (the ear on that side is black too, so the two read as one mass — head.js drawCatEars/drawPupEars),
// plus a small tan low on the opposite side (the cheek, cats). drawHead returns the head outline point list.
// A black patch **must never reach the eyes or brows** — line-drawn eyes (sleepy, half, dot…) and brows are black ink and vanish on top of black. The placement that comes
// down the side (100°~185°) caught the eyes on 158 of 600 creatures; the crown placement (left 75°~150° / right 30°~105°, depth 0.4) catches 0. A tan patch keeps its contrast against ink, so the cheek is fine
export function drawHeadCalico(ink, fills, spec, headPath, noise) {
  const c = calicoColors(spec);
  if (!c) return;
  const inkColor = spec.palette.ink;
  const ph = spec.proportions.wobbleSeed * 0.017 + 3;
  patch(ink, fills, headPath, c.side < 0 ? 75 : 30, 75, 0.4, c.dark, inkColor, noise, ph);
  if (c.mid) patch(ink, fills, headPath, c.side < 0 ? 300 : 210, 50, 0.4, c.mid, inkColor, noise, ph + 5);
}

// The calico — color regions of the base, on the body (the head's are drawHeadCalico). The line patterns (stripes, dots, hatch, spots,
// patch) are no longer drawn here: they are part of the material's base color, inside the fill and clipped to the contour (patternOf → paint)
export function drawCalico(ink, fills, spec, body, noise) {
  if (spec.parts.pattern === "calico") drawCalicoBody(ink, fills, spec, body, noise);
}

