// Dimensions and outlines. Pulls actual coordinates out of the spec. Every drawing function shares these values.
// Docs: guidelines/character/parts.md § head, guidelines/rig.md § origin rules

export const TAU = Math.PI * 2;

// The head outline dictionary. The head slot, which used to be drawn and never used, is consumed here.
// square is angularity, taper is the top/bottom width ratio (positive means wider at the bottom), rx/ry are size multipliers.
const HEAD_SHAPES = {
  round: { square: 0, taper: 0, rx: 1, ry: 1 },
  square: { square: 1.5, taper: 0, rx: 1, ry: 0.96 },
  tall: { square: 0.9, taper: -0.05, rx: 0.86, ry: 1.22 },
  pear: { square: 0.25, taper: 0.3, rx: 1, ry: 1.06 },
  wide: { square: 0.7, taper: 0.1, rx: 1.28, ry: 0.9 },
  egg: { square: 0.2, taper: 0.28, rx: 0.94, ry: 1.14 },
  block: { square: 2.2, taper: 0, rx: 1.06, ry: 0.98 }
};

// Biped build (the build slot). w is the bodyW multiplier, h the bodyH multiplier, dressW the multiplier for a dress torso, stance the leg stance
// (leg x against the body half-width). A wide body carries a wide stance; a narrow one draws the legs together.
export const BUILD = {
  skinny: { w: 0.5, h: 1.15, dressW: 0.6, stance: 0.33 },    // lanky — a stick torso
  narrow: { w: 0.7, h: 1.08, dressW: 0.75, stance: 0.4 },
  medium: { w: 1, h: 1, dressW: 1, stance: 0.5 },
  wide: { w: 1.4, h: 0.92, dressW: 1.15, stance: 0.68 },
  small: { w: 0.75, h: 0.7, dressW: 0.8, stance: 0.45 }      // a small torso — makes the head look big
};

// The ceiling for a biped's head top. Hair and hats have to fit inside the 1.19 left after taking the floor line (0.16) off the cell height of 1.35
export const MAX_HEAD_TOP = 1.05;

// Leg length multipliers (the legLength slot). Quads use the same table — a short quad is a dachshund. verylong is twice long (imp stilts)
export const LEG_LENGTH = { long: 1, medium: 0.65, short: 0.3, verylong: 2 };
// Quad build (the build slot). w is the body length multiplier, h the torso thickness multiplier, cx how far behind the front (head) reference point the torso centre sits.
export const QUAD_BUILD = {
  skinny: { w: 1, h: 0.62, cx: 0.35 },       // a thin torso
  narrow: { w: 0.7, h: 1, cx: 0.35 },        // a short body
  medium: { w: 1, h: 1, cx: 0.35 },
  wide: { w: 1.45, h: 1, cx: 0.22 },         // a long body (dachshund, munchkin)
  small: { w: 0.75, h: 0.75, cx: 0.35 }      // a small body
};

export function headShape(spec) {
  return HEAD_SHAPES[spec.parts.head] || HEAD_SHAPES.round;
}

// (Color tone and luminance utilities are in src/color.js — shade, isDark)

// Pulls actual dimensions out of the spec. Every drawing function shares these values.
export function layout(spec) {
  const p = spec.proportions;
  const quad = spec.species === "pup" || spec.species === "cat";

  if (quad) {
    // The quad skeleton. The body lies horizontally and the head sits on the front (left) of it.
    // Being short, standing next to a row of humans it drops the tier, as in the reference.
    // Leg length — quads follow the slot too. long is the baseline, medium 65%, short (a dachshund) 30%
    const legTop = p.legLength * 0.4 * (LEG_LENGTH[spec.parts.legLength] || 1);
    // Build — on a quad the build slot is torso length and thickness: narrow a short body, wide a long body (dachshund, munchkin),
    // skinny a thin body, small a small body. A long body pulls its centre toward the head (0.35→0.22) so the tail tip overruns the cell less.
    const build = QUAD_BUILD[spec.parts.build] || QUAD_BUILD.medium;
    const bodyH = 0.15 * (p.bodyScale / 0.52) * build.h;
    const bodyW = 0.18 * p.bodyLen * build.w;
    const bodyCx = 0.08 + bodyW * build.cx;   // torso centre x. The head (x=0) sits at the front (left)
    const bodyTop = legTop + bodyH;
    const shape = headShape(spec);
    const headRy = 0.23 * p.headScale * shape.ry;
    const headRx = 0.23 * p.headScale * p.headWide * shape.rx;
    // The head is laid on top of the body (the head fill covers the body ink, so the torso line does not show through the overlap).
    const headCy = bodyTop + headRy * 0.82;
    return { quad, legTop, bodyH, bodyW, bodyCx, bodyTop, headRx, headRy, headCy };
  }

  // Leg length. Length only, not scale — long is the baseline, medium 65%, short 30% (the body almost settles to the floor). Feet and thickness are unchanged.
  const legTop = p.legLength * 0.55 * (LEG_LENGTH[spec.parts.legLength] || 1);
  // Build (the build slot) × per-individual jitter. Wide gets slightly stocky, narrow slightly lanky, small smaller in both.
  // A dress flares 1.35× at the hem, so wide is applied less — to stay inside the cell (±0.45).
  const build = BUILD[spec.parts.build] || BUILD.medium;
  const bodyH = 0.28 * (p.bodyScale / 0.52) * build.h;
  const bodyW = 0.23 * p.bodyWide * (spec.parts.body === "dress" ? build.dressW : build.w);
  const bodyTop = legTop + bodyH;
  const shape = headShape(spec);
  let headRy = 0.3 * p.headScale * shape.ry;
  let headRx = 0.3 * p.headScale * p.headWide * shape.rx;
  let headCy = bodyTop + headRy * 0.72;
  // To fit inside the cell — if the head top passes MAX_HEAD_TOP, the head shrinks by that much (hair and hats stack on above it).
  // A huge head plus long legs plus a big body would together pass the cell (1.19) and invade the row above
  const top = headCy + headRy;
  if (top > MAX_HEAD_TOP) {
    const k = (MAX_HEAD_TOP - bodyTop) / (top - bodyTop);
    headRy *= k;
    headRx *= k;
    headCy = bodyTop + headRy * 0.72;
  }

  return { quad: false, legTop, bodyH, bodyW, bodyCx: 0, bodyTop, headRx, headRy, headCy };
}

// The eyeScale slot's steps — medium is the eye every creature had before the slot; a file without the slot draws medium
export const EYE_SCALE = { small: 0.78, medium: 1, large: 1.28 };
export function eyeGeometry(spec, box) {
  const p = spec.proportions;
  const gap = box.headRx * p.eyeGap;
  // wide (a big eye) is 1.3× ring — two eyes must not be identical with only different names. The eyeScale slot steps the
  // whole eye (small · medium · large); the guardrails below still fit the pair to the head
  const base = box.headRy * p.eyeSize * 1.35 * (spec.parts.eyes === "wide" ? 1.3 : 1) * (EYE_SCALE[spec.parts.eyeScale] || 1);
  const y = box.headCy + box.headRy * p.eyeHeight;

  // A cyclops has just one, in the middle
  if (spec.parts.eyes === "cyclops") {
    return [{ side: 0, x: 0, y, r: base * 1.75 }];
  }

  // Left and right are deliberately set slightly off. Symmetry reads as a geometric figure at once.
  // But **eyes drawn with lines only** (sleepy, line, happy, squeeze, droop, cross, half, side) are symmetric — on a single-stroke eye, a different size or height
  // reads as a mistake rather than "a smaller eye" (eyes with whites and a pupil still read as eyes when mismatched)
  const lineEye = LINE_EYES.includes(spec.parts.eyes);
  const sizeSkew = lineEye ? 0 : p.eyeSizeSkew;
  const heightSkew = lineEye ? 0 : p.eyeHeightSkew;
  let rL = base * (1 - sizeSkew), rR = base * (1 + sizeSkew);
  // Guardrail — the two eyes overlap **only slightly** (centre distance ≥ 70% of the sum of the radii). Closer than that and the gap is opened; with no room to open it (the head width) both eyes
  // shrink together. Where they overlap, the larger eye covers the smaller from in front (the eye order block in scene/rig.js) — no crossing outlines are left
  let g = gap;
  const OVERLAP = 0.7;
  const need = (rL + rR) * OVERLAP + 0.004;
  if (2 * g < need) g = need / 2;
  const room = box.headRx * 0.94;
  const rMax = Math.max(rL, rR);
  if (g + rMax > room) {
    const k = Math.max(0.5, (room - 0.006) / (g + rMax));
    rL *= k; rR *= k; g *= k;
    // If they are still too close after shrinking, one more pass on the gap alone
    const need2 = (rL + rR) * OVERLAP + 0.004;
    if (2 * g < need2) g = need2 / 2;
  }
  return [
    { side: -1, x: -g, y: y + box.headRy * heightSkew, r: rL },
    { side: 1, x: g, y: y - box.headRy * heightSkew, r: rR }
  ];
}
// Eyes drawn with lines only — kept left-right symmetric (eyeGeometry)
export const LINE_EYES = ["sleepy", "line", "happy", "squeeze", "droop", "cross", "half", "side"];

