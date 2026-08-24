// Hair — 21 kinds. Docs: guidelines/character/parts.md § hair
//
// Hair is drawn across **three layers** — layers = { back, crown, front } (all ink sketches):
//   back  back hair — **behind** the head and face (1.55). Only what shows outside the head silhouette and above the shoulders is left (long hair, twintails, ponytail, big masses)
//   crown on the scalp — above the head ink, below the face (2.06, the same depth as the horns). Crown caps, spikes, buns, apple tops
//   front bangs — **over** the face (6.55). Bangs and side curtains. The brows (6.6) are drawn above the bangs
// On a face turn (fake 3D) each layer shifts by its depth (scene/rig.js DEPTH) — bangs and scalp +0.12 (a little toward the face), back hair −0.12 (behind the head, so the other way). Horns and hats 0.45, ears −0.4
// One drawing function per kind — the HAIR table. New hair means adding a function here and putting the name in slots.js SLOTS.hair.
// A function takes h (the context): { back, crown, front, spec, box, noise, ink0 (the hair color), rx, ry, cy (the head's half-width, half-height and centre), shoulder (the floor for back hair) }

import { blobPath, arcPath } from "../../shape.js";
import { headShape } from "./layout.js";
import { browLine } from "./head.js";

// A scribble cap covering the crown — several kinds share the same shape. depth is how far down the sides it comes (0.5 = ear height)
const cap = (h, depth, steps, passes, spread, size = "L") => {
  const arc = arcPath(0, h.cy, h.rx * 0.98, h.ry * 0.98, Math.PI * (0.5 + depth), Math.PI * (0.5 - depth), steps);
  h.crown.fur(arc, "SCRIBBLE", { color: h.ink0, passes, size, spread });
};

// Hanging hair (curtains) — each stroke starts **on the head outline** and flows down: the middle strokes start near the crown, the side strokes at ear height,
// so it reads as a mass laid on the head and flowing down. Start every stroke at the same height (a straight horizontal top edge, constant width) and it becomes **a folding screen**.
//   hem the hem's y · grow the multiplier for spreading outward on the way down (against the head half-width) · inner strokes starting inside this (× rx) are skipped (to leave the chest clear) · count strokes per side
function curtain(h, hem, { grow = 1.14, inner = 0, count = 15, size = "S" }) {
  const { back, ink0, rx, ry, cy, noise, spec } = h;
  const shape = headShape(spec);
  const n = 2 + shape.square;
  // A point on the head outline (a superellipse). a: 0 = the right side, π/2 = the crown
  const outline = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    const ux = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const uy = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    return [ux * rx * (1 - shape.taper * uy), cy + uy * ry];
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);                       // 0 = toward the crown · 1 = the side (ear height)
      const base = Math.PI * 0.5 * (1 - t * 0.97);     // crown (π/2) → side (≈0.015π)
      const a = side > 0 ? base : Math.PI - base;
      const [ox, oy] = outline(a);
      if (Math.abs(ox) < inner * rx) continue;         // the front of the chest is left clear (very long hair)
      const top = oy - ry * 0.02;                      // starts slightly inside the outline — embedded in the head
      const jag = Math.abs(noise(i * 7.3 + side * 2.1 + spec.seed * 0.002)) * (cy - hem) * 0.12;
      const bottom = hem + jag;
      // Outward on the way down — the further to the side the more (the tip is x·grow). The middle strokes fall almost straight
      const endX = ox * grow;
      const midX = ox + (endX - ox) * 0.4;
      back.line([[ox, top], [midX, (top + bottom) * 0.5], [endX, bottom]], { color: ink0, size });
    }
    // The outer outline — from the side of the head (ear height) to the hem. It flows slightly away from the head
    const [ex, ey] = outline(side > 0 ? 0.06 : Math.PI - 0.06);
    back.line([[ex, ey], [ex * (grow * 0.98), (ey + hem) * 0.5], [ex * grow, hem]], { color: ink0 });   // the side lock is the fuller one — M against the curtain's S
  }
}

// Hair with a back layer (long hair, twintails, ponytail) — a crown cap (crown) plus hair falling behind (back)
function longHair(h) {
  cap(h, 0.52, 22, 12, h.ry * 0.24);
  // Long straight hair — from the head outline to the shoulders. It only spreads slightly around the shoulders
  curtain(h, h.shoulder, { grow: 1.14, count: 15 });
}
// Very long straight hair — down to mid-torso. It comes over the shoulders on both sides of the face and flows down beside the chest (the middle of the chest is left clear — covering the whole board makes it a cape)
function veryLong(h) {
  cap(h, 0.52, 22, 12, h.ry * 0.24);
  curtain(h, (h.box.bodyTop + h.box.legTop) / 2, { grow: 1.2, inner: 0.5, count: 17 });
}
// Twintails — two bunches tied high on either side of the head, hanging back. With ball, a round bunch at the ends
const twintailsOf = (ball) => (h) => {
  const { back, ink0, rx, ry, cy } = h;
  cap(h, 0.52, 22, 12, ry * 0.24);
  for (const side of [-1, 1]) {
    const tx = side * rx * 0.95, ty = cy + ry * 0.35;
    const tail = [[tx, ty], [tx + side * 0.05, ty - 0.06], [tx + side * 0.06, ty - 0.18], [tx + side * 0.04, ty - 0.3]];
    back.fur(tail, "SCRIBBLE", { color: ink0, passes: 12, size: "M", spread: 0.028 });
    back.line([[tx - side * 0.012, ty + 0.03], [tx + side * 0.03, ty - 0.02]], { color: ink0 });   // the tie
    if (ball) {
      // The end bunch — a round scribble mass at the end of the tail plus an outline
      const bx = tx + side * 0.05, by = ty - 0.34;
      back.fur(arcPath(bx, by, 0.05, 0.055, Math.PI * 0.5, Math.PI * 2.5, 12), "SCRIBBLE", { color: ink0, passes: 9, size: "M", spread: 0.032 });
      back.contour(blobPath(bx, by, 0.057, 0.06, { lumps: 4, amount: 0.15, noise: null }), { color: ink0 });
    }
  }
};
function ponytail(h) {
  const { back, ink0, rx, ry, cy, spec } = h;
  cap(h, 0.52, 22, 12, ry * 0.24);
  // Ponytail — tied as one behind the crown, rising up and hanging back (which side it is tied on is per individual)
  const s = spec.seed % 2 ? 1 : -1;
  const px0 = s * rx * 0.25, py0 = cy + ry * 0.92;
  const tail = [[px0, py0], [px0 + s * 0.06, py0 + 0.06], [px0 + s * 0.13, py0 + 0.02], [px0 + s * 0.15, py0 - 0.14], [px0 + s * 0.11, py0 - 0.3]];
  back.fur(tail, "SCRIBBLE", { color: ink0, passes: 12, size: "M", spread: 0.026 });
  back.line([[px0 - s * 0.01, py0 - 0.02], [px0 + s * 0.035, py0 + 0.03]], { color: ink0 });   // the tie
}

// Apple top — a bunch right in the middle of the crown rising like an apple stem. The hair is smooth, with one tie. size 1 the small one (four strands) · 1.7 the big one (six strands, long and thick)
const appleOf = (size) => (h) => {
  const { crown, ink0, ry, cy } = h;
  const bx = 0.005, by = cy + ry * 1.0;
  const count = size > 1 ? 6 : 4, spread = size > 1 ? 0.15 : 0.1;   // strand count and spread (× π)
  for (let i = 0; i < count; i += 1) {
    const a = Math.PI * (0.5 + spread * (i - (count - 1) / 2));
    crown.line([[bx, by], [bx + Math.cos(a) * 0.05 * size, by + Math.sin(a) * 0.055 * size + 0.01]], { color: ink0 });
  }
  crown.line([[bx - 0.018 * size, by - 0.006], [bx + 0.018 * size, by - 0.002]], { color: ink0 });   // the tie
};

// Spiky hair. hedgehog puts short spikes radially over **the whole** crown (an outline row plus an inner row) — it reads as a mass, like a hedgehog's back.
// rings: [radius multiplier, count, spread (× π), base length, length variation]
const spiky = (rings) => (h) => {
  const { crown, ink0, rx, ry, cy, noise, spec } = h;
  for (const [rad, count, span, len0, lenVar] of rings) {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const angle = Math.PI * (0.5 + span * (t - 0.5));
      const bx = Math.cos(angle) * rx * rad;
      const by = cy + Math.sin(angle) * ry * rad;
      const len = len0 + Math.abs(noise(i * 3.1 + rad * 7 + spec.seed * 0.001)) * lenVar;
      crown.line([[bx, by], [bx + Math.cos(angle) * len, by + Math.sin(angle) * len]], { color: ink0 });
    }
  }
};

// Volume types — a mass slightly bigger than the head wraps from the crown down to **the brow line** at the front and below the ears at the sides (the reference's hood and cloud types).
// Not filled as an area: helmet uses dense vertical strokes (straight hair), cloud a scalloped outline plus loop scribbles (curls). It cannot cover the eyes — the lower boundary is the brow line
const voluminous = (kind) => (h) => {
  const { back, crown, front, ink0, rx, ry, cy, noise, spec, box } = h;
  const brow = browLine(spec, box);
  const shape = headShape(spec);
  const grow = kind === "cloud" ? 1.2 : 1.06;
  const sideBottom = cy - ry * 0.45;   // the floor for side hair (below the ear)
  // The outer boundary — the upper part of a closed curve grown along the head outline shape (sideBottom at the sides, down to brow within the front x)
  const outer = blobPath(0, cy, rx * grow, ry * grow, { lumps: kind === "cloud" ? 9 : 3, amount: kind === "cloud" ? 0.13 : 0.04, noise: null, square: shape.square, taper: shape.taper });
  // The lower boundary — the brow line in the middle, easing **smoothly** to below the ear toward the sides (a step there reads as a square box)
  const bottomAt = (x) => {
    const u = Math.abs(x) / rx;
    const k = u <= 0.5 ? 0 : u >= 0.98 ? 1 : (() => { const q = (u - 0.5) / 0.48; return q * q * (3 - 2 * q); })();
    return brow * (1 - k) + sideBottom * k;
  };
  const upper = outer.filter(([x, y]) => y >= bottomAt(x));
  upper.sort((a, b) => Math.atan2(a[1] - cy, a[0]) - Math.atan2(b[1] - cy, b[0]));
  // The outer outline — the upper arc of a mass bigger than the head. **The back hair layer** (behind the head) — only what comes outside the head silhouette shows
  if (kind === "cloud") back.line(upper, { color: ink0 });
  else back.line(upper, { color: ink0 });
  if (kind === "helmet") {
    // The hair's grain — dense strokes falling from the crown. From the upper boundary to the lower one (the brow line in the middle → below the ear at the sides),
    // with ragged tips (no straight line drawn along the hem — that would make it a helmet with a brim), spreading slightly outward toward the sides
    const step = 0.012;
    const topAt = (x) => {
      const u = Math.min(0.999, Math.abs(x) / (rx * grow));
      return cy + ry * grow * Math.pow(1 - Math.pow(u, 2 + shape.square), 1 / (2 + shape.square));
    };
    for (let x = -rx * grow + step * 0.5; x < rx * grow; x += step) {
      const top = topAt(x) - 0.004;
      const jag = (noise(x * 40 + spec.seed * 0.003) * 0.9 + 0.3) * ry * 0.09;   // −0.05ry ~ +0.11ry
      const bottom = bottomAt(x) + jag;
      if (top - bottom < 0.02) continue;
      const fan = x * 0.08;   // outward on the way down
      // The front (|x| < 0.8rx) is the bangs covering the forehead → the over-the-face layer; the sides are the scalp layer
      const target = Math.abs(x) < rx * 0.8 ? front : crown;
      target.line([[x, top], [x + fan * 0.5, (top + bottom) / 2], [x + fan + noise(x * 17) * 0.004, bottom]], { color: ink0, size: "S" });
    }
  } else {
    // The cloud type — the inside filled with loop scribbles (curls) and small loops along the scalloped edge
    const arc = arcPath(0, cy, rx * 1.02, ry * 1.0, Math.PI * 1.04, -Math.PI * 0.04, 24);
    crown.fur(arc, "SCRIBBLE", { color: ink0, passes: 20, size: "M", spread: ry * 0.36 });
    for (let i = 0; i < 11; i += 1) {
      const k = i / 10;
      const angle = Math.PI * (1.0 - 1.0 * k);
      const bx = Math.cos(angle) * rx * grow * 0.96;
      const by = cy + Math.sin(angle) * ry * grow * 0.96;
      if (by < bottomAt(bx)) continue;
      const r = 0.03 + noise(i * 4.4 + spec.seed * 0.002) * 0.012;
      back.contour(blobPath(bx, by, r, r, { lumps: 4, amount: 0.25, noise: null }), { color: ink0 });
    }
  }
};

// Two bunches — two bunches tied at the sides of the head (behind the head, behind the ears) plus a light crown
function pigtails(h) {
  const { back, ink0, rx, ry, cy } = h;
  for (const side of [-1, 1]) {
    const bx = side * rx * 1.02;
    const by = cy + ry * 0.3;
    back.fur(arcPath(bx, by, 0.045, 0.06, Math.PI * 0.5, Math.PI * 2.5, 12), "SCRIBBLE", { color: ink0, passes: 7, size: "S", spread: 0.03 });
    back.line([[bx - side * 0.02, by + 0.05], [bx + side * 0.01, by + 0.075]], { color: ink0 });
  }
  // A light crown — an arc smaller than the cap (0.9)
  h.crown.fur(arcPath(0, cy, rx * 0.9, ry * 0.9, Math.PI * 0.72, Math.PI * 0.28, 10), "SCRIBBLE", { color: ink0, passes: 5, size: "S", spread: ry * 0.12 });
}

// Curly — small circular bunches along the crown
function curly(h) {
  const { crown, ink0, rx, ry, cy, noise } = h;
  for (let i = 0; i < 7; i += 1) {
    const k = i / 6;
    const angle = Math.PI * (0.8 - 0.6 * k);
    const bx = Math.cos(angle) * rx * 0.88;
    const by = cy + Math.sin(angle) * ry * 0.92;
    const r = 0.03 + noise(i * 4.4) * 0.012;
    crown.contour(blobPath(bx, by, r, r, { lumps: 4, amount: 0.25, noise: null }), { color: ink0 });
  }
}

// A few strands — wisp seven, tuft four
const strands = (count) => (h) => {
  const { crown, ink0, rx, ry, cy, noise } = h;
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const angle = Math.PI * (0.25 + 0.5 * t);
    const bx = Math.cos(angle) * rx * 0.8;
    const by = cy + Math.sin(angle) * ry * 0.9;
    crown.line([[bx, by], [bx + noise(i * 5.5) * 0.07, by + 0.09 + t * 0.03]], { color: ink0, size: "S" });
  }
};

// Bangs — a crown scribble plus dense vertical strokes covering the forehead (a bowl cut with a ragged fringe). Only down to the brow line —
// the hem is the brow line (only above eyewear and goggle rims, the same calculation as a hat brim). longbob is a bob coming down the sides to the jaw line
const fringe = (kind) => (h) => {
  const { front, ink0, rx, ry, cy, noise, spec, box } = h;
  const fringeBottom = browLine(spec, box);
  cap(h, 0.42, 20, 11, ry * 0.2);
  // A forehead band — a zigzag running up and down, overlaid as a scribble into a dense mass of bangs. The lower vertices are the ragged hem
  const teeth = 8;
  const zig = [];
  for (let i = 0; i <= teeth * 2; i += 1) {
    const t = (i / (teeth * 2)) * 2 - 1;
    const x = t * rx * 0.74;
    const top = cy + ry * (0.78 - t * t * 0.14);
    const bottom = fringeBottom + Math.abs(noise(i * 2.7 + spec.seed * 0.002)) * ry * 0.09;
    zig.push([x, i % 2 === 0 ? top : bottom]);
  }
  front.fur(zig, "SCRIBBLE", { color: ink0, passes: 6, size: "L", spread: 0.014 });   // bangs — over the face
  if (kind === "longbob") {
    // A bob coming down the sides to the jaw line — thick vertical scribbles wrapping both sides of the face (the bangs layer — over the cheeks and ears)
    for (const side of [-1, 1]) {
      const x = side * rx * 0.9;
      const col = [[x - side * 0.03, cy + ry * 0.62], [x + side * 0.02, cy + ry * 0.1], [x + side * 0.03, cy - ry * 0.7]];
      front.fur(col, "SCRIBBLE", { color: ink0, passes: 14, size: "L", spread: 0.045 });
    }
  }
};

// Bun — thinly covers the crown with one bunch on top plus a hairpin stroke
function bun(h) {
  const { crown, ink0, ry, cy } = h;
  cap(h, 0.32, 16, 7, ry * 0.14, "M");
  const bx = 0.01, by = cy + ry * 1.05;
  crown.fur(arcPath(bx, by, 0.045, 0.04, 0, Math.PI * 2, 14), "SCRIBBLE", { color: ink0, passes: 8, size: "M", spread: 0.028 });
  crown.contour(blobPath(bx, by, 0.048, 0.042, { lumps: 4, amount: 0.15, noise: null }), { color: ink0 });
  crown.line([[bx - 0.07, by + 0.02], [bx + 0.06, by - 0.01]], { color: ink0, size: "S" });
}

// bob / mop / scribble / sweep — a scribble covering the scalp. It has to have **volume**, like the reference: the arc comes down to the side of the head
// (ear height, depth 0.6) and the scribble spreads wide. The end coming down the side covers the ear without reaching the eyes (the eyes are within x ±0.4rx), and the spread toward the crown is above the brow line.
// depth how far down the sides it comes · passes the number of back-and-forths · spread the spread (× ry) · size the strand's size (medium/fur.js FUR_SIZES) · backCap one more layer behind the head (volume outside the silhouette)
const mopCap = ({ depth, passes, spread, size = "L", backCap = true }) => (h) => {
  const { back, ink0, rx, ry, cy } = h;
  cap(h, depth, 22, passes, ry * spread, size);
  // Back hair — one more arc, slightly bigger than the head, **behind** it (volume poking outside the silhouette). sweep has none
  if (backCap) {
    const arc = arcPath(0, cy, rx * 1.1, ry * 1.08, Math.PI * (0.5 + depth + 0.05), Math.PI * (0.5 - depth - 0.05), 22);
    back.fur(arc, "SCRIBBLE", { color: ink0, passes: 8, size: "M", spread: ry * 0.16 });
  }
};

// Kind → drawing function. 1:1 with the names in slots.js SLOTS.hair (none has none)
export const HAIR = {
  bob: mopCap({ depth: 0.56, passes: 14, spread: 0.26 }),
  mop: mopCap({ depth: 0.62, passes: 20, spread: 0.3 }),
  scribble: mopCap({ depth: 0.6, passes: 22, spread: 0.26, size: "S" }),
  sweep: mopCap({ depth: 0.4, passes: 14, spread: 0.18, backCap: false }),
  spikes: spiky([[0.95, 11, 0.95, 0.06, 0.09]]),
  mohawk: spiky([[0.95, 7, 0.35, 0.06, 0.09]]),
  hedgehog: spiky([[0.96, 15, 0.9, 0.05, 0.07], [0.74, 10, 0.72, 0.045, 0.05]]),
  tuft: strands(4),
  wisp: strands(7),
  pigtails,
  curly,
  bangs: fringe("bangs"),
  longbob: fringe("longbob"),
  bun,
  helmet: voluminous("helmet"),
  cloud: voluminous("cloud"),
  long: longHair,
  verylong: veryLong,
  twintails: twintailsOf(false),
  twintailsBall: twintailsOf(true),
  ponytail,
  apple: appleOf(1),
  appleBig: appleOf(1.7)
};

export function drawHair(layers, spec, box, noise) {
  const kind = spec.parts.hair;
  const draw = HAIR[kind];
  if (!draw) return;   // none (or an unknown value)
  const pop = spec.palette.pop;
  draw({
    ...layers,
    spec, box, noise,
    ink0: pop && pop.target === "hair" ? pop.color : spec.palette.ink,
    rx: box.headRx, ry: box.headRy, cy: box.headCy,
    shoulder: box.bodyTop - 0.02   // the floor back hair comes down to (the shoulder)
  });
}
