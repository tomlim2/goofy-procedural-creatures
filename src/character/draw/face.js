// Face — eyes, brows, eyewear, nose, muzzle, cheeks, whiskers. The mouth is mouth.js; the brow and mouth state sets are faceStates.js.
// Docs: guidelines/character/parts.md § head (eyes~nose), guidelines/motion/catalog.md § the face

import { paintPart } from "./body.js";
import { blobPath, arcPath } from "../../shape.js";
import { TAU } from "./layout.js";
import { shade, luminance } from "../../color.js";
import { MARKS, blushOf } from "../vocabulary/palette.js";

// Is this eye hidden by a patch — patchSide is only consulted when there is a patch (so the eye does not disappear along with a patch dropped by a gallery fix or a late constraint)
export function patched(spec, eye) { return spec.parts.eyewear === "patch" && spec.parts.patchSide === eye.side; }

// The white's shape on a live eye — the horizontal and vertical multipliers on radius r. Only oval is tall (scene/rig.js bakes the rig with the same values)
export const EYE_SHAPE = { oval: { sx: 0.82, sy: 1.22 } };
export function eyeShape(spec) { return EYE_SHAPE[spec.parts.eyes] || { sx: 1, sy: 1 }; }
// Live eyes (the ones stood up as a rig) — the rest are baked statically in face ink
export const RIG_EYES = ["ring", "wide", "cyclops", "oval"];
// The angle the heavy-lidded eye (lidded) is tilted by — sharp is the same eye rotated this much toward the nose, soft the other way (rad)
const TILTED_LID = 0.34;
// The white — paper white (the same value as scene/rig.js's live eyes and mouth.js's teeth)
const SCLERA = MARKS.white;

// **The crumple of a round eye, per individual.** A circle is the most repeated shape on the board — a ring, wide, oval or cyclops
// white, a hollow, a lidded white, a dot pupil — and every one of them was drawn with the same three lumps at the same depth in the
// same place, so the whole board's eyes came out stamped from one die. blobPath with no noise makes its lumps from two sines whose
// only variable is `phase`, and that was left at 0 nearly everywhere. The creature's hand picks all three now: how many lumps
// (3~6, which only counts when a noise is passed), how deep they go (half to twice the base) and where they sit. `k` separates the
// parts of one eye, so a white, its rim and its pupil each crumple their own way — a hand redrawing a circle never lands twice on the
// same wobble. It is geometry, never the rng, so the roll still decides the drawing
export function eyeWob(spec, eye, k = 0, { amount = 0.07, noise = null } = {}) {
  const h = (n) => (Math.imul((spec.proportions.hand ^ (n * 0x27d4eb2d)) >>> 0, 0x9e3779b1) >>> 9) / 8388608;
  return {
    lumps: 3 + Math.floor(h(k * 5 + 1) * 4),
    amount: amount * (0.5 + h(k * 5 + 2) * 1.5),
    noise,
    phase: eye.side * 3.7 + h(k * 5 + 3) * 40
  };
}

// The star's (☆) vertex list — outer r, inner r·inner, point up. Used by the startle ☆_☆ eye cover (scene/rig.js)
export function starPath(cx, cy, r, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}
// The heart's (♥) closed curve — width w, height h. Used by the startle ♥_♥ eye cover (scene/rig.js)
export function heartPath(cx, cy, w, h) {
  const pts = [];
  for (let i = 0; i <= 28; i += 1) {
    const a = (i / 28) * Math.PI * 2;
    pts.push([cx + w * Math.pow(Math.sin(a), 3), cy + h * (Math.cos(a) - 0.35 * Math.cos(2 * a) - 0.18 * Math.cos(3 * a) - 0.06 * Math.cos(4 * a)) + h * 0.2]);
  }
  return pts;
}

// The eye's lower edge, consulted when placing the nose, mouth and cheeks — laid over a white they are either the same color (an imp's light ink) or covered, and disappear.
// (A startle does not grow the eye, only shrinks the pupil, so the white's size is unchanged)
// Gives that lower edge (y) if an eye (its white) reaches this x, otherwise Infinity. A part sits at min(its own y, the edge − clearance)
// The lowest edge of **any** eye, wherever it sits. eyeFloor asks "does an eye reach this x", which is right for a part that has to
// clear the eye it stands under; the mouth needs the other question — is it below the eyes at all — because two big eyes set wide
// apart leave the middle empty and a mouth placed there lands between them, over both
export function eyeBottom(spec, eyes) {
  const { sy } = eyeShape(spec);
  return eyes.length ? Math.min(...eyes.map((e) => e.y - e.r * sy * 1.05)) : Infinity;
}

export function eyeFloor(spec, eyes, x) {
  const { sx, sy } = eyeShape(spec);
  const hit = eyes.filter((e) => e.r * sx * 1.05 > Math.abs(x - e.x));
  return hit.length ? Math.min(...hit.map((e) => e.y - e.r * sy * 1.05)) : Infinity;
}

export function drawEyes(ink, fills, spec, box, eyes) {
  const kind = spec.parts.eyes;
  const ink0 = spec.faceInk || spec.palette.ink;
  // The ink of eyes laid on a white (slit, side, half, the lidded set) — drawn in light face ink it is lost on the white
  const dark = spec.palette.ink;

  // Drawn smallest first — when they overlap the larger eye is in front (so no crossing line appears on eyes like hollow, whose fill and outline share one sketch)
  for (const eye of [...eyes].sort((a, b) => a.r - b.r)) {
    if (patched(spec, eye)) continue;

    if (kind === "dot") {
      paintPart(fills, spec, blobPath(eye.x, eye.y, eye.r * 0.4, eye.r * 0.4, eyeWob(spec, eye, 1, { amount: 0.2 })), ink0, { own: true });
    } else if (kind === "sleepy") {
      ink.line(arcPath(eye.x, eye.y, eye.r, eye.r * 0.7, Math.PI, TAU), { color: ink0 });
    } else if (kind === "cross") {
      ink.line([[eye.x - eye.r, eye.y - eye.r], [eye.x + eye.r, eye.y + eye.r]], { color: ink0 });
      ink.line([[eye.x + eye.r, eye.y - eye.r], [eye.x - eye.r, eye.y + eye.r]], { color: ink0 });
    } else if (kind === "scrawl") {
      // A circle scribbled with a crayon — three and a half turns in one stroke, the radius and centre wavering each turn so the lines cross and overshoot.
      // Unlike the neat spiral: the start and end do not meet and the strokes pass over each other (an eye a child drew with a crayon)
      // Four loops, each drawn a bit past one turn, overlaid — each loop has its own centre, size and tilt, so the strokes pass over each other and the ends never meet.
      // (Several turns in one stroke would be concentric and read as a spiral — that is spiral)
      const wob = ink.noise;
      const phase = eye.side * 5.5 + spec.proportions.hand * 0.017;
      for (let k = 0; k < 6; k += 1) {
        const w1 = wob(phase + k * 3.7), w2 = wob(phase + 17 + k * 3.7), w3 = wob(phase + 41 + k * 3.7);
        const cx = eye.x + eye.r * 0.17 * w1;
        const cy = eye.y + eye.r * 0.15 * w2;
        // The loops step in size — big and small loops mix into an overdrawn mark (0.45~1.05×)
        const grade = 0.45 + 0.6 * ((k * 0.37) % 1);
        const rx = eye.r * Math.min(1.05, grade + 0.12 * w3);
        const ry = eye.r * Math.min(1.05, grade + 0.12 * w1) * 0.92;
        const tilt = w2 * 0.9;
        const from = w3 * Math.PI;
        const to = from + TAU + 0.8 + w1 * 0.6;   // one turn plus extra — the end passes the start
        const pts = [];
        for (let i = 0; i <= 24; i += 1) {
          const a = from + (to - from) * (i / 24);
          const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
          pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
        }
        ink.line(pts, { color: ink0 });
      }
    } else if (kind === "spiral") {
      const spiral = [];
      for (let i = 0; i <= 40; i += 1) {
        const t = i / 40;
        const angle = t * TAU * 2.2;
        const r = eye.r * (1 - t * 0.85);
        spiral.push([eye.x + Math.cos(angle) * r, eye.y + Math.sin(angle) * r]);
      }
      ink.line(spiral, { color: ink0, size: "S" });
    } else if (kind === "slit") {
      // An almond outline plus a **filled** vertical pupil (a spindle). With a thin stroke, on a small eye the outline's two lines merge into a smear and the pupil does not read —
      // the almond is raised a little (0.7r) and the pupil filled as an area, so it reads as a cat eye from a distance.
      // Inside the almond is the white — in skin tone it becomes a patch with a pupil floating in it, and on black fur or an imp the almond merges with the head
      const path = blobPath(eye.x, eye.y, eye.r * 1.05, eye.r * 0.7, eyeWob(spec, eye, 2, { amount: 0.1 }));
      paintPart(fills, spec, path, SCLERA, { flat: true });
      fills.contour(path, { color: dark });
      paintPart(fills, spec, blobPath(eye.x, eye.y, eye.r * 0.2, eye.r * 0.6, eyeWob(spec, eye, 3, { amount: 0.05 })), dark, { own: true });
    } else if (kind === "line") {
      // A flat two-dash eye — an expressionless dash. It droops slightly on the outside
      ink.line([[eye.x - eye.r * 0.95, eye.y + 0.003], [eye.x + eye.r * 0.95, eye.y - 0.003]], { color: ink0 });
    } else if (kind === "happy") {
      // An always-smiling eye ^^ — an arch bulging upward (the same shape as the happy state's smile arch, always on here)
      ink.line(arcPath(eye.x, eye.y - eye.r * 0.12, eye.r * 0.92, eye.r * 0.72, Math.PI * 0.12, Math.PI * 0.88, 10), { color: ink0 });
    } else if (kind === "squeeze") {
      // >_< — eyes screwed shut. A bracket pointing toward the nose (left eye >, right eye <)
      const inward = -eye.side;
      ink.line([[eye.x - inward * eye.r * 0.7, eye.y + eye.r * 0.7], [eye.x + inward * eye.r * 0.45, eye.y], [eye.x - inward * eye.r * 0.7, eye.y - eye.r * 0.7]], { color: ink0 });
    } else if (kind === "side") {
      // ¬_¬ — a sideways glance. Half-lidded (a lower arc plus a lid line) but with the pupil pushed to one side (which side is per individual)
      const dir = spec.proportions.hand % 2 ? 1 : -1;
      const lidY = eye.r * 0.3;
      const a0 = Math.asin(lidY / eye.r);
      // What the lower arc encloses is the white — the arc starts at both ends of the lid line and goes round the bottom, so filling it whitens only below that line.
      // Above the line (the lid) is not filled — that is skin, not eyeball
      const arc = arcPath(eye.x, eye.y, eye.r, eye.r, Math.PI - a0, Math.PI * 2 + a0, 18);
      paintPart(fills, spec, arc, SCLERA, { flat: true });
      fills.line(arc, { color: dark });
      fills.line([[eye.x - eye.r * 1.15, eye.y + lidY - eye.r * 0.05], [eye.x + eye.r * 1.15, eye.y + lidY + 0.004]], { color: dark });
      paintPart(fills, spec, blobPath(eye.x + dir * eye.r * 0.48, eye.y - eye.r * 0.12, eye.r * 0.3, eye.r * 0.3, eyeWob(spec, eye, 4, { amount: 0.12 })), dark, { own: true });
    } else if (kind === "droop") {
      // ´･ω･` — drooping outer corners. A lid stroke falling outward over a dot eye (glum)
      paintPart(fills, spec, blobPath(eye.x, eye.y, eye.r * 0.4, eye.r * 0.4, eyeWob(spec, eye, 5, { amount: 0.2 })), ink0, { own: true });
      ink.line([[eye.x - eye.side * eye.r * 0.55, eye.y + eye.r * 1.05], [eye.x + eye.side * eye.r * 0.95, eye.y + eye.r * 0.5]], { color: ink0 });
    } else if (kind === "hollow") {
      // An empty eye — an ordinary eye (ring) with only the pupil taken out. On any species a white plus an outline, no pupil (an imp gets a white eye too, not a black socket).
      // The fill and outline are drawn per eye into **the same sketch (fills)** — when two eyes overlap the later eye (the larger) covers the front eye's outline (no crossing line).
      // For that, smallest first: the larger eye is drawn later and so ends up in front
      const path = blobPath(eye.x, eye.y, eye.r, eye.r, eyeWob(spec, eye, 6, { noise: fills.noise }));   // a slightly crumpled circle, its crumple the creature's own
      paintPart(fills, spec, path, SCLERA, { flat: true });
      fills.contour(path, { color: dark });   // the white's rim is black — being on the white, it is always visible
    } else if (kind === "lidded" || kind === "sharp" || kind === "soft") {
      // The heavy-lidded set — **the same eye at different tilts**: lidded flat · sharp tilted toward the nose (the fierce look of a lifted outer corner) ·
      // soft tilted the other way (the gentle look of a drooping outer corner). The tilt rotates the white, the lid line and the pupil together about the eye's centre —
      // built as separate shapes they would not read as the same eye.
      // **Below the lid line is the white, above it is skin** — a lid is skin covering the eye, not eyeball, so it is filled in the face's color.
      // Leave the top as white too and it reads as one more white crescent laid over the eye; fill it with ink and on a black head (an imp, black fur)
      // it merges with the head, leaving only the white crescent, which does not read as an eye. Being on a white, the ink is always the dark palette ink
      // (in light face ink it is lost on the white). If half-lidded (half) is one thin lid line, this is an eye pressed down by a thick, sagging lid
      const out = eye.side === 0 ? 1 : eye.side;              // a cyclops uses the right as its reference. The nose side = −out
      const tilt = (kind === "sharp" ? out : kind === "soft" ? -out : 0) * TILTED_LID;
      const cos = Math.cos(tilt), sin = Math.sin(tilt);
      const rot = (pts) => pts.map(([x, y]) => [
        eye.x + (x - eye.x) * cos - (y - eye.y) * sin,
        eye.y + (x - eye.x) * sin + (y - eye.y) * cos
      ]);
      const path = rot(blobPath(eye.x, eye.y, eye.r, eye.r * 1.05, eyeWob(spec, eye, 7, { noise: fills.noise })));
      // The lid line — it crosses the white and sags in the middle (the brow ridge presses down on the eye). Stroked thick, twice, to make a "heavy" lid.
      // Its two ends are at ±a0 on the pre-tilt ellipse, so the outline's point array can be cut at that angle to close off the skin part
      const rel = 0.16, a0 = Math.asin(rel);
      const lid = [];
      for (let i = 0; i <= 12; i += 1) {
        const t = i / 12;
        const x = eye.x + eye.r * (Math.cos(Math.PI - a0) * (1 - t) + Math.cos(a0) * t);
        lid.push([x, eye.y + eye.r * (rel * 1.05) - Math.sin(Math.PI * t) * eye.r * 0.16]);
      }
      const lidLine = rot(lid);
      paintPart(fills, spec, path, SCLERA, { flat: true });
      // The lid (above the line) — the lid line runs left→right and the outline's upper part (right→top→left) is joined on to close it
      const brow = path.slice(Math.ceil((a0 / TAU) * path.length), Math.floor(((Math.PI - a0) / TAU) * path.length) + 1);
      paintPart(fills, spec, [...lidLine, ...brow], spec.palette.skin);
      fills.contour(path, { color: dark });
      // The pupil — peeking out from under the lid line (slightly left or right per individual). It has to be stroked **before** the line so the line passes over the pupil
      const gaze = (spec.proportions.hand % 5 - 2) * 0.06;
      paintPart(fills, spec, rot(blobPath(eye.x + eye.r * gaze, eye.y - eye.r * 0.16, eye.r * 0.3, eye.r * 0.34, { lumps: 3, amount: 0.12, noise: null })), dark, { own: true });
      // The thickness is proportional to the eye size — at a fixed thickness the stroke covers the whole white on a small eye (a cat)
      fills.line(lidLine, { color: dark });
    } else if (kind === "half") {
      // A half-closed eye — no line is drawn across the whole circle (a circle plus a line smears into "a circle with a line through it").
      // Only the **lower arc** of the lid line is drawn, with the pupil below that line → the shape of a heavy lid covering the eye
      const lidY = eye.r * 0.3;
      const a0 = Math.asin(lidY / eye.r);   // the angle at which the lid line meets the circle
      // What the arc encloses (below the line) is the white. Above the line is not filled — that is skin, not eyeball
      const arc = arcPath(eye.x, eye.y, eye.r, eye.r, Math.PI - a0, Math.PI * 2 + a0, 18);
      paintPart(fills, spec, arc, SCLERA, { flat: true });
      fills.line(arc, { color: dark });
      fills.line([[eye.x - eye.r * 1.15, eye.y + lidY - eye.r * 0.05], [eye.x + eye.r * 1.15, eye.y + lidY + 0.004]], { color: dark });
      paintPart(fills, spec, blobPath(eye.x, eye.y - eye.r * 0.12, eye.r * 0.3, eye.r * 0.3, eyeWob(spec, eye, 8, { amount: 0.12 })), dark, { own: true });
    }
    // ring / wide / cyclops / oval (RIG_EYES) are not drawn here. The scene stands the white, pupil and shut line up
    // as separate meshes to move the startle (pupil shrink), gaze and lids.
  }
}

export function drawFace2(ink, fills, spec, box, eyes) {
  const kind = spec.parts.face2;
  if (kind === "none") return;
  const ink0 = spec.faceInk || spec.palette.ink;

  if (kind === "circles") {
    // Dark circles — the manga tired-eye shorthand: two short arcs sagging under each eye, the lower one a
    // little narrower. In face ink (the tears' rule), so a dark face carries them in light ink and they read
    // on every skin. Under a patch there is no eye to be tired
    for (const eye of eyes) {
      if (patched(spec, eye)) continue;
      for (const k of [0, 1]) {
        const yb = eye.y - eye.r * (1.12 + k * 0.34);
        const span = eye.r * (1.05 - k * 0.28);
        ink.line(Array.from({ length: 7 }, (_, i) => {
          const t = i / 6;
          return [eye.x - span + t * span * 2, yb - Math.sin(t * Math.PI) * eye.r * 0.2];
        }), { color: ink0, size: "S" });
      }
    }
    return;
  }

  if (kind === "tears") {
    // Two waves running down below the eye — a trickle, not a straight fall. A detail seen often in the reference.
    // Handed over as nine points so the pen's own re-sample (PENCIL.step) has a curve to follow rather than three corners
    const drop = box.headRy * 0.52;
    for (const eye of eyes) {
      if (patched(spec, eye)) continue;
      for (const off of [-0.35, 0.35]) {
        const x = eye.x + eye.r * off;
        const top = eye.y - eye.r * 0.9;
        ink.line(Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          return [x + Math.sin(t * Math.PI * 1.5) * 0.007, top - drop * t];   // starts on the eye, swings twice on the way down
        }), { color: ink0, size: "S" });
      }
    }
    return;
  }

  for (const side of [-1, 1]) {
    const cx = side * box.headRx * 0.58;
    // The cheeks are below the eyes — with a big eye they drop below the (startle-widened) eye. So they are not covered whole by the white
    const cheekY = Math.min(box.headCy - box.headRy * 0.28, eyeFloor(spec, eyes, cx) - 0.02);
    paintPart(fills, spec, blobPath(cx, cheekY, 0.042, 0.026, { lumps: 3, amount: 0.15, noise: null }), blushOf(spec), { own: true });
  }
}

// Cat whiskers — three strands per side. The length is per individual (0.42~0.92× the head's half-width): over half of them have whiskers **poking out through the head outline**.
// Being drawn on the face layer (2.4) they sit above the outline, ears and hat, and reach out onto the paper. They shift along with a face turn
export function drawWhiskers(ink, spec, box) {
  if (spec.species !== "cat") return;
  const roll = (spec.proportions.hand % 97) / 97;
  const len = box.headRx * (0.42 + roll * 0.5);
  const wy = box.headCy - box.headRy * 0.3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const y0 = wy + (i - 1) * 0.028;
      const x0 = side * box.headRx * 0.3;
      // A slightly drooping fan — the longer the whisker, the more its tip spreads
      ink.line([[x0, y0], [x0 + side * len * 0.55, y0 + (i - 1) * 0.008 * (len / 0.09)], [x0 + side * len, y0 + (i - 1) * 0.02 * (len / 0.09) - 0.004]], { color: spec.faceInk || spec.palette.ink, size: "S" });
    }
  }
}

export function drawBrow(ink, spec, box, eyes, kindOverride) {
  const kind = kindOverride || spec.parts.brow;
  if (kind === "none") return;
  const ink0 = spec.faceInk || spec.palette.ink;

  for (const eye of eyes) {
    if (patched(spec, eye)) continue;
    // Brows go above the eyes, but inside the head — on a big eye like a cyclops, 1.9× up is outside the head (on the paper) and it disappears
    const y = Math.min(eye.y + eye.r * (eye.side === 0 ? 1.35 : 1.9), box.headCy + box.headRy * 0.84);
    const half = Math.max(eye.r * 1.15, 0.022);   // even on a small eye a brow is at least brow-length
    let left = y;
    let right = y;
    if (kind === "angry") {
      left = y - eye.r * 0.4 * (eye.side > 0 ? 1 : 0);
      right = y - eye.r * 0.4 * (eye.side > 0 ? 0 : 1);
    } else if (kind === "worry") {
      left = y + eye.r * 0.3 * (eye.side > 0 ? 1 : 0);
      right = y + eye.r * 0.3 * (eye.side > 0 ? 0 : 1);
    }
    ink.line([[eye.x - half, left], [eye.x + half, right]], { color: ink0 });
  }
}

// The lens radius = the eye radius × a multiplier. spec.js uses the same value when deciding whether the two lenses overlap.
export const LENS_SCALE = { glasses: 1.45, goggles: 1.75 };

export function drawEyewear(ink, fills, spec, box, eyes) {
  const kind = spec.parts.eyewear;
  if (kind === "none") return;
  const ink0 = spec.faceInk || spec.palette.ink;

  if (kind === "patch") {
    // An eyepatch is **an object**, so it is always black — filled in an imp's light face ink it becomes a white mass and reads as a mistake.
    // On an ink-black head a light rim holds its shape so the black patch reads. The strap is face ink (black on a light head, light on an ink-black one)
    const eye = eyes.find((e) => e.side === spec.parts.patchSide) || eyes[0];
    const patch = blobPath(eye.x, eye.y, eye.r * 1.5, eye.r * 1.35, { lumps: 3, amount: 0.025, noise: fills.noise, phase: 1.3 });   // almost a circle — only a touch, so it does not jiggle as the boil runs
    paintPart(fills, spec, patch, spec.palette.ink, { own: true });
    if (spec.faceInk) ink.contour(patch, { color: spec.faceInk });
    // The strap crosses the head
    ink.line([[eye.x, eye.y + eye.r * 1.3], [-eye.side * box.headRx, box.headCy + box.headRy * 0.45]], { color: ink0, size: "S" });
    return;
  }

  if (kind === "monocle") {
    const eye = eyes[eyes.length - 1];
    ink.contour(blobPath(eye.x, eye.y, eye.r * 1.5, eye.r * 1.5, { lumps: 4, amount: 0.06, noise: null }), { color: ink0 });
    ink.line([[eye.x + eye.r * 1.4, eye.y - eye.r], [eye.x + eye.r * 1.9, eye.y - eye.r * 2.6]], { color: ink0, size: "S" });
    return;
  }

  const scale = LENS_SCALE[kind] || 1.45;
  for (const eye of eyes) {
    ink.contour(blobPath(eye.x, eye.y, eye.r * scale, eye.r * scale * 0.92, { lumps: 4, amount: 0.06, noise: null }), { color: ink0 });
  }
  ink.line([[eyes[0].x + eyes[0].r * scale, eyes[0].y], [eyes[1].x - eyes[1].r * scale, eyes[1].y]], { color: ink0, size: "S" });
  if (kind === "goggles") {
    for (const eye of eyes) {
      ink.line([[eye.x + eye.side * eye.r * scale, eye.y], [eye.side * box.headRx * 1.02, eye.y + 0.02]], { color: ink0 });
    }
  }
}

// Dog muzzle dimensions and color. The nose slot decides the muzzle's form — the same slot gives a per-species variant.
// The nose (drawNose) and the mouth (drawMouth, mouth.js) look at the same dimensions — the mouth sits above the muzzle and below the nose.
//   fill the muzzle color — per individual (hand, no rng): light cream 45% · a tone slightly lighter than the fur 30% · **black-ish** (0.55× the fur) 25%. A muzzle is **color only**, with no outline (a color patch)
//   ink  the color of **the line drawn on** the muzzle (the mouth) — split by the muzzle's luminance (black if light, light ink if dark). The nose is an object and always black, but on a dark muzzle it gets a light rim
export function muzzleGeometry(spec, box) {
  const kind = spec.parts.nose;
  const mw = kind === "hook" ? 0.62 : kind === "long" ? 0.68 : kind === "wedge" ? 0.4 : 0.5;
  const mh = kind === "long" ? 0.28 : kind === "wedge" ? 0.3 : 0.36;
  const my = box.headCy - box.headRy * (kind === "long" ? 0.48 : 0.42);
  const nr = kind === "hook" ? 0.05 : kind === "dot" ? 0.032 : 0.04;
  const roll = spec.proportions.hand % 100;
  const fill = roll < 45 ? MARKS.muzzle : roll < 75 ? shade(spec.palette.skin, 1.12) : shade(spec.palette.skin, 0.55);
  const dark = luminance(fill) < 120;
  return { my, rx: box.headRx * mw, ry: box.headRy * mh, noseY: my + box.headRy * 0.16, noseR: nr, fill, dark, ink: dark ? "#e9e3d5" : spec.palette.ink };
}

// The multiplier for human and imp noses (hook, wedge, long) — against the head height, 1 on a medium head (headRy 0.31). At fixed coordinates it becomes a speck on a huge head,
// so hook, wedge and long all read as the same nose, and on a small head it takes up half the face. Stroke thickness does not follow the multiplier (the same as the dimension-slot rule)
const NOSE_REF_RY = 0.31;
function noseScale(box) { return box.headRy / NOSE_REF_RY; }

// The nose reference point (humans, cats, imps). If the eyes are big enough to reach the middle (a big eye, a cyclops) the nose is buried in them — it drops below the (startle-widened) eye
export function noseY(spec, box, eyes) {
  return Math.min(box.headCy - box.headRy * spec.proportions.noseDrop, eyeFloor(spec, eyes, 0) - 0.008);
}

// The two area-drawn noses — the drawing (drawNose) and the mouth position (noseBottomY) look at the same coordinates. Both are proportional to the head, and
// since the nose reference point (noseY) only looks at x=0, a nose with width re-checks at its own width whether its wings touch an eye (a white) — if so it drops by that much
// (the faceFront layer is above the eye rig, so an area lapping onto an eye hides the white)
function bulbShape(spec, box, eyes) {
  const rx = Math.max(0.016, box.headRx * 0.085), ry = Math.max(0.014, box.headRy * 0.07);
  const floor = Math.min(eyeFloor(spec, eyes, -rx * 0.8), eyeFloor(spec, eyes, rx * 0.8)) - 0.006;
  const cy = Math.min(noseY(spec, box, eyes) + ry * 0.5, floor - ry);
  return { rx, ry, cy, bottom: cy - ry };
}
function broadShape(spec, box, eyes) {
  const w = Math.max(0.03, box.headRx * 0.14), h = Math.max(0.014, box.headRy * 0.06);
  const floor = Math.min(eyeFloor(spec, eyes, -w * 0.8), eyeFloor(spec, eyes, w * 0.8)) - 0.006;
  const y = Math.min(noseY(spec, box, eyes), floor - h);
  return { w, h, y, bottom: y - h };
}
// A square nose — a rounded square (a superellipse). The same position and fill as the bulb; only the silhouette is angular
function boxShape(spec, box, eyes) {
  const rx = Math.max(0.017, box.headRx * 0.09), ry = Math.max(0.017, box.headRy * 0.09);
  const floor = Math.min(eyeFloor(spec, eyes, -rx * 0.8), eyeFloor(spec, eyes, rx * 0.8)) - 0.006;
  const cy = Math.min(noseY(spec, box, eyes) + ry * 0.5, floor - ry);
  return { rx, ry, cy, bottom: cy - ry };
}
// Two nostrils — two watermelon seeds (teardrops pointed at the top, tilted outward). gap is half the distance between the two centres, rx/ry one seed's half-width and half-height
function nostrilsShape(spec, box, eyes) {
  const gap = Math.max(0.015, box.headRx * 0.065);
  const rx = Math.max(0.006, box.headRy * 0.026), ry = Math.max(0.011, box.headRy * 0.052);
  const floor = Math.min(eyeFloor(spec, eyes, -(gap + rx)), eyeFloor(spec, eyes, gap + rx)) - 0.006;
  const cy = Math.min(noseY(spec, box, eyes) + ry * 0.3, floor - ry);
  return { gap, rx, ry, cy, bottom: cy - ry * 1.05 };
}

// Cat noses — the nose slot is **read as a cat's** (the same way a dog reads it as a muzzle): dot a small triangle · wedge a heart · hook a triangle plus a philtrum (a Y) ·
// long a wide triangle plus a long philtrum · none nothing. Drawn as a single line it would be mistaken for the mouth, so it is a **filled** triangle. Pink (the same as the blush and tongue) plus a face-ink rim —
// it reads on a light face and on black fur alike. The philtrum is a short vertical line dropping from under the nose toward the mouth
function catNose(ink, fills, spec, box, eyes) {
  const kind = spec.parts.nose;
  const y = noseY(spec, box, eyes);
  const ink0 = spec.faceInk || spec.palette.ink;
  const w = Math.max(0.024, box.headRx * (kind === "long" ? 0.13 : 0.1));   // half-width
  const h = Math.max(0.017, box.headRy * (kind === "wedge" ? 0.085 : 0.072));
  let path;
  if (kind === "wedge") {
    // Heart nose — two peaks on top, a point below
    path = [];
    for (let i = 0; i <= 20; i += 1) {
      const a = (i / 20) * TAU;
      path.push([w * 0.95 * Math.pow(Math.sin(a), 3), y + h * (Math.cos(a) - 0.35 * Math.cos(2 * a) - 0.18 * Math.cos(3 * a) - 0.06 * Math.cos(4 * a)) * 0.75 + h * 0.15]);
    }
  } else {
    // Triangular nose — wide at the top, pointed below, corners slightly rounded
    path = [[-w, y + h * 0.55], [-w * 0.55, y + h * 0.8], [w * 0.55, y + h * 0.8], [w, y + h * 0.55], [w * 0.4, y - h * 0.35], [0, y - h * 0.8], [-w * 0.4, y - h * 0.35]];
  }
  paintPart(fills, spec, path, blushOf(spec), { own: true });
  ink.contour(path, { color: ink0 });
  // The philtrum — from under the nose toward the mouth. Short on hook, long on long (a Y-shaped face)
  const drop = kind === "hook" ? h * 1.1 : kind === "long" ? h * 2 : 0;
  if (drop) ink.line([[0, y - h * 0.7], [0.001, y - h * 0.7 - drop]], { color: ink0, size: "S" });
}

export function drawNose(ink, fills, spec, box, eyes) {
  if (spec.species === "cat" && spec.parts.nose !== "none") { catNose(ink, fills, spec, box, eyes); return; }
  if (spec.species === "pup") {
    const m = muzzleGeometry(spec, box);
    // The muzzle (the region the nose and mouth are grouped into) is **color only** — no outline is drawn round it. An outline makes it look like a board tacked onto the face (it has to stay a color patch)
    const muzzle = blobPath(0, m.my, m.rx, m.ry, { lumps: 3, amount: 0.1, noise: null });
    paintPart(fills, spec, muzzle, m.fill);   // the muzzle is fur — the creature's goofy material
    const nose = blobPath(0, m.noseY, m.noseR, m.noseR * 0.75, { lumps: 3, amount: 0.15, noise: null });
    paintPart(fills, spec, nose, spec.palette.ink, { own: true });   // the nose is an object — always black
    if (m.dark) ink.contour(nose, { color: m.ink, size: "S" });   // on a dark muzzle a light rim holds the nose (the same rule as the eyepatch)
    return;
  }

  const kind = spec.parts.nose;
  if (kind === "none") return;
  const y = noseY(spec, box, eyes);
  const ink0 = spec.faceInk || spec.palette.ink;
  const k = noseScale(box);   // every coordinate of hook, wedge and long takes this multiplier — the shape stays, only the size follows the head

  if (kind === "dot") {
    // Dot nose — **proportional to the head**. At a fixed size it ends up smaller than a speck on a huge or wide head and disappears on a face turn (the audit catches it)
    const half = Math.max(0.014, box.headRx * 0.055);
    ink.line([[-half, y], [half, y]], { color: ink0 });
  } else if (kind === "hook") {
    // Hook — comes down from between the brows and bends to the left (the reference's one-stroke nose)
    ink.line([[0.004 * k, y + 0.07 * k], [0.01 * k, y], [-0.035 * k, y - 0.012 * k]], { color: ink0 });
  } else if (kind === "wedge") {
    // Wedge — a ∧ pointing up
    ink.line([[-0.03 * k, y - 0.02 * k], [0.006 * k, y + 0.055 * k], [0.032 * k, y - 0.02 * k]], { color: ink0 });
  } else if (kind === "bulb") {
    // Bulb — a round **area**. Filled a little deeper than the skin tone with a face-ink rim (on an ink-black face only the rim is left and reads as a light ring).
    // Having a different silhouette from the four line noses is this nose's whole reason — at grid distance it separates as "the mass nose"
    const b = bulbShape(spec, box, eyes);
    const path = blobPath(0.003 * k, b.cy, b.rx, b.ry, { lumps: 3, amount: 0.1, noise: fills.noise, phase: 2.3 });
    paintPart(fills, spec, path, shade(spec.palette.skin, 0.86), { own: true });
    ink.contour(path, { color: ink0 });
  } else if (kind === "broad") {
    // Broad nose — a wide, low **filled triangle** (a ∇ with rounded corners). The same point layout as the cat's triangular nose but wider and in skin tones
    const { w, h, y: ny } = broadShape(spec, box, eyes);
    const path = [[-w, ny + h * 0.7], [-w * 0.2, ny + h], [w * 0.2, ny + h], [w, ny + h * 0.7], [w * 0.3, ny - h * 0.6], [0, ny - h], [-w * 0.3, ny - h * 0.6]];
    paintPart(fills, spec, path, shade(spec.palette.skin, 0.86), { own: true });
    ink.contour(path, { color: ink0 });
  } else if (kind === "box") {
    // Square nose — a **rounded square** area. The exponent goes higher (2.5) than the head's square (1.5) — at nose size, 1.5 just smears into a circle and does not separate from bulb
    const b = boxShape(spec, box, eyes);
    const path = blobPath(0.002 * k, b.cy, b.rx, b.ry, { lumps: 3, amount: 0.04, noise: fills.noise, phase: 6.7, square: 2.5 });
    paintPart(fills, spec, path, shade(spec.palette.skin, 0.86), { own: true });
    ink.contour(path, { color: ink0 });
  } else if (kind === "nostrils") {
    // Nostrils only — **two watermelon seeds** with no nose outline. Teardrops pointed at the top (taper +) tilted up and outward (left ＼ right ／).
    // A neighbour of the dot nose, separated by being two seeds, the tilt and the seed shape. The size is proportional to the head — at a fixed size it vanishes to a dot on a big head
    const s = nostrilsShape(spec, box, eyes);
    const tilt = 0.5;   // rad — the angle of the outward tilt
    for (const side of [-1, 1]) {
      const cx = side * s.gap;
      const pip = blobPath(0, 0, s.rx, s.ry, { lumps: 3, amount: 0.08, noise: null, taper: 0.55 });   // built about the origin, then rotated and moved
      const a = -side * tilt, cos = Math.cos(a), sin = Math.sin(a);
      paintPart(fills, spec, pip.map(([x, y]) => [cx + x * cos - y * sin, s.cy + x * sin + y * cos]), ink0, { own: true });
    }
  } else {
    // long — a long nose coming down from the forehead
    ink.line([[0.006 * k, y + 0.14 * k], [0.014 * k, y - 0.03 * k], [-0.03 * k, y - 0.045 * k]], { color: ink0 });
  }
}

// The nose's lower end — the upper limit for the mouth's position. With no nose, the (startle-widened) eye's lower edge or slightly below the head's centre
export function noseBottomY(spec, box, eyes) {
  const kind = spec.parts.nose;
  if (spec.species === "pup") return muzzleGeometry(spec, box).noseY - muzzleGeometry(spec, box).noseR;
  if (kind === "none") return Math.min(eyeFloor(spec, eyes, 0) - 0.01, box.headCy - box.headRy * 0.04);
  if (spec.species !== "cat") {   // area noses — they give the lower edge from their own coordinates (a cat reads even these values as a catNose triangle, so it uses the constants below)
    if (kind === "bulb") return bulbShape(spec, box, eyes).bottom;
    if (kind === "broad") return broadShape(spec, box, eyes).bottom;
    if (kind === "nostrils") return nostrilsShape(spec, box, eyes).bottom;
    if (kind === "box") return boxShape(spec, box, eyes).bottom;
  }
  // The cat nose (catNose) is drawn at its own dimensions and does not take the multiplier — the constants here are the old values, kept for cats
  const k = spec.species === "cat" ? 1 : noseScale(box);
  return noseY(spec, box, eyes) - (kind === "long" ? 0.045 * k : kind === "wedge" ? 0.02 * k : kind === "hook" ? 0.012 * k : 0.008);
}

// The fierce eye (anger) — the eye is **redrawn**: a thick slanted lid dropping on the inner (nose) side plus a glaring dot beneath it (a dot under ＼ ／). A cyclops gets a horizontal lid.
// Live eyes (the rig) and static eyes both use the same shape (scene/rig.js). Coordinates are relative to the eye's centre
export function angryEyeSketch(sketch, eye, ink, spec) {
  const r = eye.r;
  const inward = -eye.side;   // the nose side (0 on a cyclops)
  const lid = inward === 0 ? [[-r * 0.95, r * 0.45], [r * 0.95, r * 0.45]] : [[-inward * r * 0.95, r * 0.55], [inward * r * 0.95, r * 0.05]];
  sketch.line(lid, { color: ink });
  paintPart(sketch, spec, blobPath(0, -r * 0.3, r * 0.3, r * 0.3, { lumps: 3, amount: 0.12, noise: null }), ink, { own: true });
}
