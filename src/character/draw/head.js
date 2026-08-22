// Head — the outline, ears, anchors on the outline, the brow line. Hair is hair.js; hats and horns are headgear.js. Docs: guidelines/character/parts.md § head

import { blobPath, arcPath } from "../../stroke.js";
import { headShape, eyeGeometry } from "./layout.js";
import { shade, isDark } from "../../color.js";
import { LENS_SCALE } from "./face.js";
import { calicoColors } from "./body.js";

export function drawHead(ink, fills, spec, box, noise) {
  const p = spec.proportions;
  const shape = headShape(spec);
  const path = blobPath(0, box.headCy, box.headRx, box.headRy, {
    lumps: p.headLumps,
    amount: p.headLump,
    noise,
    phase: p.wobbleSeed * 0.01,
    square: shape.square,
    taper: shape.taper
  });

  // The material slot — how the head is filled. A spec without the slot (an older tree's, in drawdiff) is flat, like every late slot's default
  fills.paint(path, (spec.parts.material || "flat").toUpperCase(), { color: spec.palette.skin, offset: spec.palette.fillOffset });

  // The head's pencil scribble (a tilted zigzag in a darker tone over the fill) is **off**: scribbleFill shades an ellipse it cannot
  // clip to the contour, so on a tapered or squared head its corners poked past the outline. It comes back as the light's shade
  // (guidelines/drawing.md § the light) — a shadow computed from a light direction and clipped to the contour, like a material's texture

  // Outline jitter is halved on humans too — a smooth skull (the line's own wobble stays)
  // The goofy outline — PENCIL (stroke.js GOOFY_OUTLINES); the head's contour runs a little heavier than the body's (weight)
  ink.contour(path, "PENCIL", { color: spec.palette.ink, closed: true, weight: 1.15 });
  return path;
}

// Ear size multipliers. Mid and Big are the same shape, only longer and wider. earKind() turns the value back into the base shape
const EAR_SIZE = { round: 1, roundMid: 1.4, roundBig: 1.8, pointy: 1, pointyMid: 1.4, pointyBig: 1.85, fold: 1, foldMid: 1.4, foldBig: 1.8, perk: 1, perkMid: 1.4, perkBig: 1.8 };
const earKind = (value) => value.replace(/(Mid|Big)$/, "");

export function drawEars(ink, fills, spec, box) {
  const kind = earKind(spec.parts.ears);
  const size = EAR_SIZE[spec.parts.ears] || 1;
  if (kind === "none") return;
  // Dog ears are drawn **on top of the head**, not behind it (drawPupEars, after the head) — so an inward-leaning ear is not hidden by the face
  if (spec.species === "pup") return;
  if (spec.species === "cat") return;   // cat ears are the layer in front of the head (drawCatEars) — being filled triangular bumps, they have to sit on top of the head

  const y = box.headCy - box.headRy * 0.05;

  for (const side of [-1, 1]) {
    const x = side * box.headRx * 0.98;
    if (kind === "round") {
      ink.outline(blobPath(x, y, 0.035 * size, 0.045 * size, { lumps: 3, amount: 0.15, noise: null }), {
        color: spec.palette.ink, width: 0.011
      });
    } else if (kind === "pointy") {
      // A pointy ear to the side — the size multipliers (pointyMid, pointyBig) make it longer and wider
      ink.stroke([[x - 0.01, y + 0.05 * size], [x + side * 0.075 * size, y + 0.02], [x - 0.01, y - 0.05 * size]], {
        color: spec.palette.ink, width: 0.011
      });
    } else if (kind === "long") {
      // A long hanging ear — it can go on something other than a dog
      const lobe = blobPath(x + side * 0.012, y - box.headRy * 0.32, 0.035, box.headRy * 0.45, {
        lumps: 3, amount: 0.12, noise: null
      });
      ink.outline(lobe, { color: spec.palette.ink, width: 0.01, passes: 2 });
    } else if (kind === "fold") {
      // A folded ear — the tip bends over (size multipliers)
      ink.stroke([
        [x - side * 0.01, y + 0.04 * size],
        [x + side * 0.055 * size, y + 0.055 * size],
        [x + side * 0.05 * size, y - 0.01 * size],
        [x + side * 0.015 * size, y - 0.03 * size]
      ], { color: spec.palette.ink, width: 0.011 });
    } else {
      // flap — an ear hanging downward
      ink.stroke(arcPath(x, y, 0.05, 0.09, -Math.PI * 0.6, Math.PI * 0.6), {
        color: spec.palette.ink, width: 0.011
      });
    }
  }
}

// Cat ears — **bumps** in the head silhouette. Filled triangles stand at the two corners of the crown (~35° from the crown) with the base tucked inside the outline
// so they attach to the head as one mass (the reference: the outline continues into the ear and a colored head has the ear in the same color). The outline is the same weight as the head's, drawn twice.
// Drawn on the layer in front of the head (front) so the fill covers the head outline. Three proportions — pointy the default · pointyMid narrow and tall · pointyBig wide and big.
// The inner ear is per individual: 60% a small inner triangle (a double line), 15% a dark fill, the rest none (tufts read as an owl and were dropped).
// It follows the **normal** at the attachment point: the base is laid along the outline's tangent there (inset by 0.02), and the ear's axis is halfway between the normal and vertical
// (half the normal's tilt, plus a slight left/right difference) — on a round head it opens out naturally, on a flat head it stands straight. The tip is slightly blunt.
// On a square head (square, block), sitting on the corner would make horns on a box, so it stands slightly inside it (θ 0.52).
// round, fold, flap and long do not exist on cats (species forbid → pointy).
//   pointy    the default triangle — sides slightly concave (a hand-drawn ear), a blunt tip
//   pointyMid a narrow, tall triangle — it opens further (+0.15 rad; the reference's long ears open about 30°)
//   pointyBig a wide, low ear — a round tip and convex sides (the colored brown and grey cats' ears)
// The inner ear is per individual: double line 50% · ink fill 15% · one crease stroke 15% · none 20%.
const CAT_EAR = {
  pointy: { w: 0.05, h: 0.1, theta: 0.6, lean: 0, tip: 0.006, bow: -0.12 },
  pointyMid: { w: 0.04, h: 0.14, theta: 0.55, lean: 0.15, tip: 0.005, bow: -0.1 },
  pointyBig: { w: 0.062, h: 0.11, theta: 0.6, lean: -0.02, tip: 0.016, bow: 0.12 }
};
// A point on the head outline (a superellipse plus the top/bottom width ratio — the exact shape drawHead draws) and the outward unit normal.
// theta: the parameter angle measured from the crown (0 = the crown, π/2 = the side), side: ±1. Things that "attach to the outline", like ears and horns, use this rather than an ellipse —
// on a square head a point on the ellipse is buried inside the outline. A square head's vertex (the corner) is at θ = π/4.
export function headAnchor(spec, box, theta, side) {
  const shape = headShape(spec);
  const n = 2 + shape.square;
  const pt = (th) => {
    const c = Math.sin(th), sn = Math.cos(th);   // blobPath's angle = π/2 − θ
    const ux = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const uy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
    return [side * ux * box.headRx * (1 - shape.taper * uy), box.headCy + uy * box.headRy];
  };
  const [x, y] = pt(theta);
  const [x0, y0] = pt(theta - 0.01), [x1, y1] = pt(theta + 0.01);
  let tx = x1 - x0, ty = y1 - y0;
  const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  let nx = ty, ny = -tx;                                   // of the two 90° rotations of the tangent, the one going away from the head centre
  if (nx * x + ny * (y - box.headCy) < 0) { nx = -nx; ny = -ny; }
  return { x, y, nx, ny };
}

export function drawCatEars(ink, fills, spec, box) {
  if (spec.species !== "cat") return;
  const value = spec.parts.ears;
  if (value === "none") return;
  const def = CAT_EAR[value] || CAT_EAR.pointy;
  const rx = box.headRx, ry = box.headRy, cy = box.headCy;
  const ink0 = spec.palette.ink;
  const skin = spec.palette.skin;
  const seed = spec.proportions.wobbleSeed;
  const roll = seed % 100;
  // The inner ear — line (a double line) 45% · fill 30% · crease 15% · none 10%. The fill color is per individual, either pink (the same as the nose and blush) or a tone in the same family
  const inner = roll < 45 ? "line" : roll < 75 ? "dark" : roll < 90 ? "notch" : "none";
  const innerFill = (seed >> 7) % 2 ? "#d9968a" : shade(skin, isDark(skin) ? 1.5 : 0.62);
  // The inner line is **a mark drawn on fur**, so it uses face ink — a black line on black fur is lost and invisible (the outline meets the background, so it stays black)
  const innerInk = spec.faceInk || ink0;
  const cal = calicoColors(spec);   // on a calico, the ear on the side is black (the same side as the head patch — body.js drawHeadMarks)
  const boxy = headShape(spec).square >= 1.4;   // square and block — slightly inside the corner
  const theta = boxy ? Math.min(def.theta, 0.52) : def.theta;
  for (const side of [-1, 1]) {
    const earDark = !!cal && cal.side === side;
    const earFill = earDark ? cal.dark : skin;
    const earInnerInk = earDark ? "#e9e3d5" : innerInk;   // a mark on a black ear uses light ink (the face ink rule)
    // The root on the outline (the real head shape) and, at that point, the outward normal n and tangent t (outward positive)
    const anchor = headAnchor(spec, box, theta, side);
    const bx = anchor.x, by = anchor.y, nx = anchor.nx, ny = anchor.ny;
    const tx = side * ny, ty = -side * nx;
    // The ear axis — half the normal's tilt plus the per-kind opening plus a per-individual left/right difference. A round head opens out, a flat head stands straight
    const normalTilt = Math.atan2(nx * side, ny);
    const lean = normalTilt * 0.5 + 0.02 + def.lean + ((seed >> (side > 0 ? 3 : 5)) % 3) * 0.02;
    const ax = side * Math.sin(lean), ay = Math.cos(lean);
    // The base follows the tangent (to attach to the outline), inset inward. The tip is h along the axis, of width tip. The sides bow inward (−) or outward (+) by bow at their midpoint
    const baseAt = (v, inset) => [bx + tx * v - nx * inset, by + ty * v - ny * inset];
    const tipAt = (v) => [bx + ax * def.h + tx * v, by + ay * def.h + ty * v];
    const sideAt = (v0, v1, k) => {   // the point at k (0~1) between base v0 and tip v1, including the side bow
      const [x0, y0] = baseAt(v0, 0);
      const [x1, y1] = tipAt(v1);
      const bow = def.bow * def.w * Math.sin(Math.PI * k) * Math.sign(v0);
      return [x0 + (x1 - x0) * k + tx * bow, y0 + (y1 - y0) * k + ty * bow];
    };
    const path = [
      baseAt(-def.w, 0.02), sideAt(-def.w, -def.tip, 0.5), tipAt(-def.tip), tipAt(def.tip), sideAt(def.w, def.tip, 0.5), baseAt(def.w, 0.02)
    ];
    fills.fill(path, earFill);
    ink.stroke([
      baseAt(-def.w * 1.02, 0.024), sideAt(-def.w, -def.tip, 0.5), tipAt(-def.tip), tipAt(def.tip), sideAt(def.w, def.tip, 0.5), baseAt(def.w * 1.02, 0.024)
    ], { color: ink0, width: 0.014, passes: 2, step: 0.008 });
    // The inner ear — **its base attaches to the ear's root** (float it above the root and it becomes a patch hanging mid-ear). Width 0.62× the ear, tip 0.7× the height
    const innerTip = [bx + ax * def.h * 0.7, by + ay * def.h * 0.7];
    const innerBase = [baseAt(-def.w * 0.62, 0.012), innerTip, baseAt(def.w * 0.62, 0.012)];
    if (inner === "line") ink.stroke(innerBase, { color: earInnerInk, width: 0.008 });
    else if (inner === "dark") fills.fill(innerBase, innerFill);
    // The crease — one line from the middle of the root to half the ear's height (it reads as a fold mark)
    else if (inner === "notch") ink.stroke([baseAt(0, 0.012), [bx + ax * def.h * 0.5, by + ay * def.h * 0.5]], { color: earInnerInk, width: 0.008 });
  }
}

// Dog ears — drawn **on top of** the head (fill and outline). Being inward-leaning ears, drawn behind the head they get buried in the face.
export function drawPupEars(ink, fills, spec, box) {
  if (spec.species !== "pup") return;   // dogs only. (Leave it out and dog ears stack on every species' head and look like horns)
  const kind = earKind(spec.parts.ears);
  const size = EAR_SIZE[spec.parts.ears] || 1;
  if (kind === "none") return;
  // Dog ears — they differ per kind. The root is one of two places **on the head outline**, and the ear rides that point's normal **at the opposite tilt**
  // (an axis mirrored about the vertical — it gathers inward rather than opening out):
  //   the upper corner (a bit below the crown, θ≈50°) — pointy a perked triangular ear · round a round ear · fold a folded ear. They stand tilted up and inward
  //   the side (slightly out from beside the eyes, θ≈88°) — flap a lobe (the reference beagle) · long a basset. They hang, with the tip gathering toward the face
  // θ is the polar angle on the ellipse (headRx, headRy), measured from the crown. A filled lobe plus an outline drawn twice. none is nothing.
  const earFill = shade(spec.palette.skin, 0.8);
  const cal = calicoColors(spec);   // on a piebald (calico), the ear on the side is black (the same side as the head patch)
  const earInk = { color: spec.palette.ink, width: 0.011, passes: 2 };
  // The inner ear — per individual (wobbleSeed, no rng): a tone in the same family 45% · pink (the same as the nose and blush) 30% · none 25%.
  // Not drawn on hanging ears (flap, long) or on a folded side's flap — those poses show the ear's **outer** face
  const innerRoll = spec.proportions.wobbleSeed % 100;
  const innerFill = innerRoll < 45 ? shade(earFill, isDark(earFill) ? 1.95 : 0.62) : innerRoll < 75 ? "#d9968a" : null;
  const upper = kind === "pointy" || kind === "round" || kind === "fold" || kind === "perk";
  // The upper position starts at θ≈50° on a round head and at **the vertex** (θ = 45°) on a square head (square, block) — so the triangular ear reaches out from the corner
  const boxy = Math.min(1, headShape(spec).square / 1.5);
  const theta = upper ? 0.88 - boxy * (0.88 - Math.PI / 4) : 1.53;
  const rx = box.headRx, ry = box.headRy;
  // Rotates a point list about (cx, cy) by angle (counter-clockwise positive)
  const rotate = (pts, cx, cy, angle) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
  };
  for (const side of [-1, 1]) {
    // The point on the outline and its outward normal n and tangent t (+ toward the crown). The root sits OUT along the normal, **outside** that point —
    // the ear's body has to lie on the paper outside the head to be visible (overlapping the head, the similar fill loses it).
    // Triangular and folded ears pull the base back to the outline (u = −OUT) and reach outward while embedded in the head; a lobe touches the outline with its inner edge.
    const anchor = headAnchor(spec, box, theta, side);   // the point on the real outline (the corner on a square head) and its normal
    const nx = anchor.nx, ny = anchor.ny;
    const OUT = upper ? 0.02 : 0.09;   // an upper ear (pointy, round, fold) hugs the head; a long ear (flap, long) hangs clearly clear of the face
    const bx = anchor.x + nx * OUT;
    const by = anchor.y + ny * OUT;
    // The ear axis = the normal's opposite tilt (mirrored about the vertical), but the inward tilt is capped at 0.35 rad — tilt further and the tip goes
    // inside the crown and is buried in the head. The tangent is the root point's, unchanged.
    const normalTilt = Math.atan2(nx * side, ny);          // the angle from vertical to the normal (outward positive)
    const lean = Math.min(normalTilt, 0.35);                // the ear axis's inward tilt
    const ax = -side * Math.sin(lean), ay = Math.cos(lean);
    // Ear-local coordinates: u is the ear axis (up and inward), v is perpendicular to it (outward positive). It has to be perpendicular to the axis or triangular and folded ears flatten
    const px = side * ay, py = -side * ax;
    const local = (u, v) => [bx + ax * u + px * v, by + ay * u + py * v];
    let path;
    let flap = null;    // a folded ear's flap — drawn over the root
    let crease = null;  // the fold line — on black fur the two pieces are the same color, so without the line the fold is invisible
    // Used when drawing the root outline as **an open path**. Within one layer the ink sits above the fills (guidelines/rig.md), so the flap's fill cannot hide the root outline —
    // the stretch that would be hidden (under the flap) is simply never stroked
    let baseOutline = null;
    if (kind === "pointy") {
      // Triangular ear — **its vertex attaches to the head** (not its base). The topmost vertex is embedded in the outline (the corner on a square head)
      // and the body droops outward and down from there: the base is the outer end. The size multipliers make it long and wide
      const len = ry * 0.55 * size;
      const w = 0.045 * (0.8 + 0.2 * size);                  // base half-width
      const drop = 0.6;                                       // the angle the axis droops below horizontal (rad)
      const ex = side * Math.cos(drop), ey = -Math.sin(drop); // the ear axis: outward and down
      const qx = -ey * side, qy = ex * side;                  // perpendicular to the axis (up and outward positive)
      const tipX = anchor.x - nx * 0.012, tipY = anchor.y - ny * 0.012;   // the vertex sits slightly inside the outline — embedded
      path = [
        [tipX, tipY],
        [tipX + ex * len + qx * w, tipY + ey * len + qy * w],
        [tipX + ex * len - qx * w * 0.9, tipY + ey * len - qy * w * 0.9]
      ];
    } else if (kind === "round") {
      // A round ear elongated along the ear axis — its inner side just laps onto the outline (size multipliers)
      const [cx, cy] = local(-OUT + 0.055 * size, 0);
      path = rotate(blobPath(cx, cy, 0.036 * size, 0.046 * size, { lumps: 3, amount: 0.15, noise: null }), cx, cy, side * lean);
    } else if (kind === "fold" || kind === "perk") {
      // The folded ear (fold) — two pieces: **a standing base plus a flap that bends over it and hangs**. It **folds on one side only while the other stands**.
      // The standing ear (perk) — a triangle standing straight on both sides. A tip curving upward reads as a horn — the flap has to come **below** the crease to be a folded ear. Size multipliers
      const k = size;
      // The standing and folded ears are drawn in **head-normal coordinates** — the base follows the tangent at its attachment point exactly and the ear grows along the normal.
      // (Use an inward-leaning axis like the other ears and the base lifts off the scalp, looking like a box glued on top of the head)
      //   nu the normal direction (the height growing out of the head) · nv the tangent direction (the base — it folds toward +)
      const tX = side * ny, tY = -side * nx;
      const nAt = (nu, nv) => [anchor.x + nx * nu + tX * nv, anchor.y + ny * nu + tY * nv];
      const halfW = 0.048 * k;         // the root's half-width (along the tangent)
      // A folded ear **folds on one side only** — the other is a standing ear (differing left from right is what makes it doglike). Which side folds is per individual (wobbleSeed, no rng)
      const foldSide = spec.proportions.wobbleSeed % 2 ? 1 : -1;
      if (kind === "perk" || side !== foldSide) {
        // The standing ear — **a triangle standing straight** along the normal. The root is generous (so the ear feels seated on the head) and the tip is **round and blunt**
        // (a razor point reads as a horn; wide and low becomes the round ear)
        const len = 0.155 * k, base = halfW * 1.1, tip = base * 0.34;   // tip is the tip's half-width — that much becomes the rounded end
        path = [
          nAt(-0.014, base), nAt(len * 0.55, base * 0.62), nAt(len * 0.86, tip * 1.15),
          nAt(len, tip * 0.55), nAt(len * 1.02, 0), nAt(len, -tip * 0.55),
          nAt(len * 0.86, -tip * 1.15), nAt(len * 0.55, -base * 0.62), nAt(-0.014, -base)
        ];
      } else {
        const stand = 0.085 * k;         // the standing height up to the crease (along the normal)
        const drop = 0.075 * k;          // how far the flap folds down
        // The root — a trapezoid whose base embeds inside the outline (−0.014) and narrows going up (the same grammar as the triangular ear)
        path = [nAt(-0.014, halfW), nAt(stand, halfW * 0.66), nAt(stand, -halfW * 0.66), nAt(-0.014, -halfW)];
        // The flap — bends at the crease along the tangent (+nv) and hangs **beside and below** the root. The tip has to be lower than the crease for it to be a folded ear
        flap = [
          nAt(stand + 0.006 * k, -halfW * 0.6),
          nAt(stand + 0.004 * k, halfW * 1.15),
          nAt(stand - drop, halfW * 1.05)
        ];
        crease = [nAt(stand, -halfW * 0.66), nAt(stand + 0.004 * k, halfW * 1.1)];
        // The root outline — inner top → inner bottom → outer bottom → up to the flap's tip height only. The top edge and the outer edge above it are covered by the flap, so they are not stroked
        baseOutline = [nAt(stand, -halfW * 0.66), nAt(-0.014, -halfW), nAt(-0.014, halfW), nAt(stand - drop - 0.004 * k, halfW * 0.72)];
      }
    } else {
      // flap / long — a lobe hanging from the side of the head at the opposite tilt (0.25 rad inward), its tip gathering toward the face
      const len = ry * (kind === "long" ? 0.95 : 0.65);
      const tilt = -0.25;
      const cx = bx + side * Math.sin(tilt) * (len * 0.5 - 0.005);
      const cy = by - Math.cos(tilt) * (len * 0.5 - 0.005);
      path = rotate(blobPath(cx, cy, 0.045, len * 0.5 + 0.02, { lumps: 3, amount: 0.12, noise: null }), cx, cy, -side * tilt);
    }
    fills.fill(path, cal && cal.side === side ? cal.dark : earFill);
    // The inner ear — the ear shape scaled **about its root (where it meets the face)**. Its base attaches right at the root and it narrows going up
    // (scale about the centroid and it becomes a patch hanging mid-ear — the reference's inner ear starts at the root). There is no outline — being a filled patch, it reads even when small.
    // Only hanging ears (flap, long) are skipped — that pose shows the ear's **outer** face. A folded ear is drawn here too, because **its root (the standing part) is the inner face**
    if (innerFill && kind !== "flap" && kind !== "long") {
      const root = [anchor.x + nx * 0.004, anchor.y + ny * 0.004];   // just outside the outline — the root position
      fills.fill(path.map(([x, y]) => [root[0] + (x - root[0]) * 0.72, root[1] + (y - root[1]) * 0.72]), innerFill);
    }
    if (baseOutline) ink.stroke(baseOutline, earInk);
    else ink.outline(path, earInk);
    if (flap) {
      // The flap is **the ear's back (outer) face** folded over — so it takes a fur tone, not the inner-ear color (a shade darker, to separate it from the root).
      // On light fur it reads by tone, on black fur by the crease. The inner face (pink or a tone) is drawn on the standing part **under** the flap, from the root up, and the flap covers it
      fills.fill(flap, shade(earFill, 0.82));
      ink.outline(flap, earInk);
      ink.stroke(crease, { color: spec.palette.ink, width: 0.009 });
    }
  }
}

// The brow line — just above the eyes (including eyewear, goggle, monocle and patch rims). A hat brim and the hem of the bangs stop here.
export function browLine(spec, box) {
  const { headCy: cy, headRy: ry } = box;
  const eyes = eyeGeometry(spec, box);
  const rim = LENS_SCALE[spec.parts.eyewear] || (spec.parts.eyewear === "monocle" ? 1.5 : spec.parts.eyewear === "patch" ? 1.35 : 1);
  const eyeTop = eyes.reduce((m, e) => Math.max(m, e.y + e.r * rim), cy);
  return Math.max(cy + ry * 0.42, eyeTop + ry * 0.1);
}
