// Hair — 28 kinds. Docs: guidelines/character/parts.md § hair
//
// Hair is drawn across **three layers** — layers = { back, crown, front } (ink sketches), and the filled
// family also gets each layer's fills sketch (backFills, crownFills, frontFills — the fur kinds never fill):
//   back  back hair — **the backmost layer an individual has (0.4)**: behind the head and face, and behind the body and legs too. Only what shows outside those silhouettes is left (long hair, twintails, ponytail, big masses)
//   crown on the scalp — above the head ink, below the face (2.06, the same depth as the horns). Crown caps, spikes, buns, apple tops
//   front bangs — **over** the face (6.55). Bangs and side curtains. The brows (6.6) are drawn above the bangs
// On a face turn (fake 3D) each layer shifts by its depth (scene/rig.js DEPTH) — bangs and scalp +0.12 (a little toward the face), back hair −0.12 (behind the head, so the other way). Horns and hats 0.45, ears −0.4
// One drawing function per kind — the HAIR table. New hair means adding a function here and putting the name in slots.js SLOTS.hair.
// A function takes h (the context): { back, crown, front, spec, box, noise, ink0 (the hair color), rx, ry, cy (the head's half-width, half-height and centre), shoulder (the floor for back hair) }

import { paintOf } from "../vocabulary/paint.js";
import { blobPath, arcPath, crumple } from "../../shape.js";
import { headShape, eyeGeometry } from "./layout.js";
import { browLine } from "./head.js";
import { paintPart } from "./body.js";
import { luminance, tint, deepen } from "../../color.js";

// A scribble cap covering the crown — several kinds share the same shape. depth is how far down the sides it comes (0.5 = ear height)
// **Hair is drawn at L**, the goofy fur's thickest — every fur on the head, cap, tail, bun and bangs alike. It used to run S~L by kind,
// and the thin ones read as a smudge beside the head's own line rather than as strands
const cap = (h, depth, steps, passes, spread) => {
  const arc = arcPath(0, h.cy, h.rx * 0.98, h.ry * 0.98, Math.PI * (0.5 + depth), Math.PI * (0.5 - depth), steps);
  h.crown.fur(arc, "SCRIBBLE", { color: h.ink0, passes, size: "L", spread });
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
      const jag = Math.abs(noise(i * 7.3 + side * 2.1 + spec.roll * 0.002)) * (cy - hem) * 0.12;
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
    back.fur(tail, "SCRIBBLE", { color: ink0, passes: 12, size: "L", spread: 0.028 });
    back.line([[tx - side * 0.012, ty + 0.03], [tx + side * 0.03, ty - 0.02]], { color: ink0 });   // the tie
    if (ball) {
      // The end bunch — a round scribble mass at the end of the tail plus an outline
      const bx = tx + side * 0.05, by = ty - 0.34;
      back.fur(arcPath(bx, by, 0.05, 0.055, Math.PI * 0.5, Math.PI * 2.5, 12), "SCRIBBLE", { color: ink0, passes: 9, size: "L", spread: 0.032 });
      back.contour(blobPath(bx, by, 0.057, 0.06, { lumps: 4, amount: 0.15, noise: null }), { color: ink0 });
    }
  }
};
function ponytail(h) {
  const { back, ink0, rx, ry, cy, spec } = h;
  cap(h, 0.52, 22, 12, ry * 0.24);
  // Ponytail — tied as one behind the crown, rising up and hanging back (which side it is tied on is per individual)
  const s = spec.roll % 2 ? 1 : -1;
  const px0 = s * rx * 0.25, py0 = cy + ry * 0.92;
  const tail = [[px0, py0], [px0 + s * 0.06, py0 + 0.06], [px0 + s * 0.13, py0 + 0.02], [px0 + s * 0.15, py0 - 0.14], [px0 + s * 0.11, py0 - 0.3]];
  back.fur(tail, "SCRIBBLE", { color: ink0, passes: 12, size: "L", spread: 0.026 });
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
      const len = len0 + Math.abs(noise(i * 3.1 + rad * 7 + spec.roll * 0.001)) * lenVar;
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
      const jag = (noise(x * 40 + spec.roll * 0.003) * 0.9 + 0.3) * ry * 0.09;   // −0.05ry ~ +0.11ry
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
    crown.fur(arc, "SCRIBBLE", { color: ink0, passes: 20, size: "L", spread: ry * 0.36 });
    for (let i = 0; i < 11; i += 1) {
      const k = i / 10;
      const angle = Math.PI * (1.0 - 1.0 * k);
      const bx = Math.cos(angle) * rx * grow * 0.96;
      const by = cy + Math.sin(angle) * ry * grow * 0.96;
      if (by < bottomAt(bx)) continue;
      const r = 0.03 + noise(i * 4.4 + spec.roll * 0.002) * 0.012;
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
    back.fur(arcPath(bx, by, 0.045, 0.06, Math.PI * 0.5, Math.PI * 2.5, 12), "SCRIBBLE", { color: ink0, passes: 7, size: "L", spread: 0.03 });
    back.line([[bx - side * 0.02, by + 0.05], [bx + side * 0.01, by + 0.075]], { color: ink0 });
  }
  // A light crown — an arc smaller than the cap (0.9)
  h.crown.fur(arcPath(0, cy, rx * 0.9, ry * 0.9, Math.PI * 0.72, Math.PI * 0.28, 10), "SCRIBBLE", { color: ink0, passes: 5, size: "L", spread: ry * 0.12 });
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
    const bottom = fringeBottom + Math.abs(noise(i * 2.7 + spec.roll * 0.002)) * ry * 0.09;
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
  cap(h, 0.32, 16, 7, ry * 0.14);
  const bx = 0.01, by = cy + ry * 1.05;
  crown.fur(arcPath(bx, by, 0.045, 0.04, 0, Math.PI * 2, 14), "SCRIBBLE", { color: ink0, passes: 8, size: "L", spread: 0.028 });
  crown.contour(blobPath(bx, by, 0.048, 0.042, { lumps: 4, amount: 0.15, noise: null }), { color: ink0 });
  crown.line([[bx - 0.07, by + 0.02], [bx + 0.06, by - 0.01]], { color: ink0, size: "S" });
}

// bob / mop / scribble / sweep — a scribble covering the scalp. It has to have **volume**, like the reference: the arc comes down to the side of the head
// (ear height, depth 0.6) and the scribble spreads wide. The end coming down the side covers the ear without reaching the eyes (the eyes are within x ±0.4rx), and the spread toward the crown is above the brow line.
// depth how far down the sides it comes · passes the number of back-and-forths · spread the spread (× ry) · size the strand's size (medium/fur.js FUR_SIZES) · backCap one more layer behind the head (volume outside the silhouette)
const mopCap = ({ depth, passes, spread, backCap = true }) => (h) => {
  const { back, ink0, rx, ry, cy } = h;
  cap(h, depth, 22, passes, ry * spread);
  // Back hair — one more arc, slightly bigger than the head, **behind** it (volume poking outside the silhouette). sweep has none
  if (backCap) {
    const arc = arcPath(0, cy, rx * 1.1, ry * 1.08, Math.PI * (0.5 + depth + 0.05), Math.PI * (0.5 - depth - 0.05), 22);
    back.fur(arc, "SCRIBBLE", { color: ink0, passes: 8, size: "L", spread: ry * 0.16 });
  }
};

// ---- The filled family — hair as SHAPES, not fur ---------------------------------------------------------
// The two kinds below (bobSwept · sheetsSwept) are built the other way round from
// everything above: the fur pen scribbles a mass with no boundary, these draw the boundary first — a closed
// form — and the inside is painted with the creature's goofy material (the line material), exactly like a hat
// (paintPart + contour). The hair splits into two regions:
//   the BACK (뒷머리)  — what hangs behind the head, on the back layer: the 단발 mass to just under the chin,
//                        with a small A-line flare. One piece, always (there is no 장발 — see backMass below)
//   the FRONT (앞머리) — the bangs panel over the forehead, on the bangs layer, and the named half of the
//                        value: blunt the straight 일자 hem · curtain parted in the middle, two sweeps framing
//                        the face, the tips dropping past the brow only outside the front zone (the browLine
//                        rule's side allowance)
// A scalp piece (crown layer) fills the head's own top to the hairline — the head fill covers the back dome
// inside the silhouette, so without it the scalp between the two regions reads bare.
// The fill is the hair's color (pop when pop targets hair); the outline is always the pencil's dark ink.

// Sort a filtered outline arc right → crown → left without a seam at the bottom (atan2 flips sign there)
const arcSort = (cy) => (p, q) => {
  const key = ([x, y]) => { let a = Math.atan2(y - cy, x); if (a < -Math.PI / 2) a += Math.PI * 2; return a; };
  return key(p) - key(q);
};

// The head outline grown a touch — every filled piece hugs the real head shape (square heads stay square)
const grownOutline = (h, gx, gy, lumps, amount) => {
  const shape = headShape(h.spec);
  return blobPath(0, h.cy, h.rx * gx, h.ry * gy,
    { lumps, amount, noise: null, phase: h.spec.roll * 0.0013, square: shape.square, taper: shape.taper });
};

// The lowest y any face-covering filled piece may reach: the highest eye's top, plus the whole travel a
// face turn has left against a head-attached layer (shiftY 0.16·ry at parallax 0.12 ≈ 0.14·ry) and the
// pencil's bite. The fur kinds never needed this — a scribble leaks pixels, so a grazed eye still read —
// but these pieces are OPAQUE, and an eye slid behind one on a turned face is gone (and a dark-ink eye
// DRAWN OVER a dark fill is just as gone — the audit's on-the-same-color class)
const eyeSafeY = (h) => {
  const eyes = eyeGeometry(h.spec, h.box);
  return Math.max(...eyes.map((e) => e.y + e.r)) + h.ry * 0.22;
};

// The scalp — the upper head filled to the hairline, easing toward below-the-ear at the sides (voluminous's
// easing) but never into the eye band (eyeSafeY — high-set or wide-set eyes pull the side lobes up).
// The middle boundary is the front kind's business: under a blunt panel it sits a shade above the
// bangs hem (the doubled line hides under the panel); behind a curtain parting it rises high — the parting
// gap has to show the forehead's skin up to the hairline, or the parting reads as one solid panel
const scalp = (h, frontY, topLine) => {
  const { crown, crownFills, spec, box, rx, ry, cy } = h;
  const brow = frontY ?? browLine(spec, box) + ry * 0.1;
  const sideBottom = Math.max(cy - ry * 0.45, eyeSafeY(h));
  const bottomAt = (x) => {
    const u = Math.abs(x) / rx;
    const k = u <= 0.5 ? 0 : u >= 0.98 ? 1 : (() => { const q = (u - 0.5) / 0.48; return q * q * (3 - 2 * q); })();
    return brow * (1 - k) + sideBottom * k;
  };
  const upper = grownOutline(h, 1.05, 1.04, 3, 0.04).filter(([x, y]) => y >= bottomAt(x)).sort(arcSort(cy));
  const hem = [];
  for (let i = 0; i <= 10; i += 1) { const x = -rx * 0.97 + (i / 10) * rx * 1.94; hem.push([x, bottomAt(x)]); }
  const poly = [...upper, ...hem];   // right → crown → left, then the hairline left → right
  paintPart(crownFills, spec, poly, h.ink0, { own: true });
  // **Only the hairline gets a line when a mass sits behind the skull.** The scalp's top arc runs a hair
  // inside that mass's own arc, and both being drawn put two dark lines side by side over one patch of hair.
  // The mass carries the silhouette there and its fill is the same colour, so the arc needs no line of its
  // own. With nothing behind (the sheets back) that arc IS the silhouette and keeps its contour
  if (topLine) crown.contour(poly, { color: h.lineInk });
  else crown.line(hem, { color: h.lineInk });
};

// The back mass — the grown dome falling to a hem. bob wears it alone (hem just under the chin, a small
// A-line flare); long wears it cut at the chin and hangs the side sheets from it
const backMass = (h, hem, flare) => {
  const { back, backFills, spec, rx, ry, cy } = h;
  const arc = grownOutline(h, 1.16, 1.08, 4, 0.05).filter(([, y]) => y >= cy - ry * 0.05).sort(arcSort(cy));
  const [rx0] = arc[0];
  const [lx0] = arc[arc.length - 1];
  const poly = crumple([...arc,
    [lx0 * 1.02, cy - ry * 0.6], [lx0 * flare, hem + ry * 0.03],
    [lx0 * 0.6, hem], [0, hem + ry * 0.015], [rx0 * 0.6, hem - ry * 0.01],
    [rx0 * flare, hem + ry * 0.03], [rx0 * 1.02, cy - ry * 0.6]
  ], 0.0035, spec.roll * 0.0011);
  paintPart(backFills, spec, poly, h.ink0, { own: true });
  back.contour(poly, { color: h.lineInk });
};

// There is no 장발 in this family, and the reason is a rule, not a taste: **two filled sheets flanking a gap
// down the middle of the TORSO is a silhouette to stay away from.** The long back hung a sheet at each side
// from the shoulder to the chest, and the narrow strip left between them framed the torso — which tapers and
// ends round — into an obscene shape on slim, skin-coloured bodies. The fur curtains (long, verylong) do not
// have the problem: they are open scribble, they hang from the whole head outline rather than two side lobes,
// and verylong deliberately skips the strokes over the middle of the chest. If a filled 장발 is wanted, the
// mass has to read as ONE piece across the back, never as a pair

// Where each piece stops on the side of the face. The reference head measures a bare gap between them — the
// fringe's last hair at y233, the sheets' first at y282, 48 rows of skin in between — but the fringe reads
// better on these proportions carried down to the jaw, so it keeps the longer run and the two overlap.
const FRINGE_END = (h) => h.cy - h.ry * 0.82;   // down past the cheek, about the jaw line
const SHEET_TOP = (h) => h.cy - h.ry * 0.55;    // mid-cheek, about the nose — the sheets start here

// The sheets back (뒷머리) — a pair of sheets falling at the sides of the FACE to frayed, tasselled ends.
// A pair is fine here where the 장발 pair was not, and the difference is where they stop: these hang beside
// the head and end **at or above the shoulder** (the hem is clamped to box.bodyTop), so what shows between
// them is the head, never the torso. Back hair also draws behind the body now (rig.js 0.4), so a hem that
// does reach the shoulder is covered rather than laid over the chest.
// Ragged hem: the sheet's bottom edge is a run of tassel points, alternating deep and shallow
const backSheets = (h) => {
  const { back, backFills, spec, box, rx, ry, cy, noise } = h;
  // The sheets are drawn ALONE — no dome behind the skull, no scalp piece over it. This value is stripped to
  // the reference's two parts, the 앞머리 and the 뒷머리, and nothing else, so each can be judged on its own.
  const top = SHEET_TOP(h);
  const hem = box.legTop;          // the hip — the reference's sheets end level with it, and it is a landmark
  const span = Math.max(ry * 0.5, top - hem);   // that already scales with each individual's build
  for (const side of [-1, 1]) {
    // The head fill is opaque and hides everything inside its own silhouette, so the inner edge is tucked
    // behind the cheek and only the splay shows — widest low, where the head has already narrowed
    const rag = [];
    const teeth = 5;
    for (let i = 0; i <= teeth; i += 1) {   // outer → inner along the hem, tassels cut alternately deep and shallow
      const t = i / teeth;
      const x = side * rx * (1.44 - t * 0.8);
      const deep = i % 2 === 0 ? 1 : 0.48;
      rag.push([x, hem + (1 - deep) * span * 0.13 + Math.abs(noise(i * 5.3 + side * 3.1 + spec.roll * 0.002)) * span * 0.06]);
    }
    const poly = crumple([
      [side * rx * 0.64, top + ry * 0.2],
      [side * rx * 0.98, top + ry * 0.02],
      [side * rx * 1.28, top - span * 0.38],
      [side * rx * 1.44, hem + span * 0.16],
      ...rag,
      [side * rx * 0.56, top - span * 0.5]
    ], 0.004, spec.roll * 0.0015 + side * 4);
    paintPart(backFills, spec, poly, h.ink0, { own: true });
    back.contour(poly, { color: h.lineInk });
    for (const k of [1.02, 1.26]) {   // the strand grain — following the splay, out where the sheet actually shows
      back.line([[side * rx * (k * 0.8), top - ry * 0.04], [side * rx * k, hem + span * 0.22]], { color: h.grainInk, size: "S" });
    }
  }
};

// Blunt bangs — one panel rooted high on the crown, the hem a straight 일자 line above the brow (a light jag,
// so the pencil has something to bite), plus a few comb strands. The hem clears the brow line by 0.08·ry and
// the side corners never dip under it: a face turn shifts the eyes up to 0.14·ry against the bangs (the face
// moves at 1, the bangs layer at its 0.12 parallax) and the panel is OPAQUE — the fur fringe leaked scribble
// pixels through, this leaks nothing, so what it covers on a turned face is gone
const frontBlunt = (h) => {
  const { front, frontFills, spec, box, rx, ry, cy, noise } = h;
  const brow = browLine(spec, box);
  const hemY = Math.max(brow + ry * 0.08, eyeSafeY(h));
  const cornerY = hemY + ry * 0.01;
  const arcFloor = Math.max(cy + ry * 0.3, hemY + ry * 0.02);   // arc ends below the hem would hang side wings into the eye band
  const arc = grownOutline(h, 1.0, 1.0, 3, 0.03).filter(([, y]) => y >= arcFloor).sort(arcSort(cy));
  const hem = [];
  for (let i = 0; i <= 6; i += 1) {
    const x = -rx * 0.78 + (i / 6) * rx * 1.56;
    hem.push([x, hemY + Math.abs(noise(i * 3.7 + spec.roll * 0.002)) * ry * 0.04]);
  }
  const poly = crumple([...arc, [-rx * 0.8, cornerY], ...hem, [rx * 0.8, cornerY]], 0.0025, spec.roll * 0.0017);
  paintPart(frontFills, spec, poly, h.ink0, { own: true });
  front.contour(poly, { color: h.lineInk });
  for (const sx of [-0.34, 0.1, 0.44]) {
    front.line([[sx * rx, cy + ry * 0.5], [sx * rx * 1.05, hemY + ry * 0.1]], { color: h.grainInk, size: "S" });
  }
};

// A ribbon along a spine, filled fan-safe — a curved crescent fanned as one polygon spills across its own
// concave notch (the crown's filled-in-pieces rule), so each segment is painted as its own convex quad.
// Returns the outer boundary for the contour
// **Never hand this a crumpled spine.** crumple() is for closed polygons: it re-samples every segment (a
// 5-point path comes back ~100 points) and it wraps the last point round to the first. Both are wrong here —
// the wrap adds a segment that is not part of the ribbon, and the re-sample ran the spine past the end of
// `widths`, so `widths[i]` came back undefined and filled the rails with NaN (three of the four filled hair
// kinds shipped a NaN geometry that way, and three.js dropped the quads it could not measure). The widths are
// read at the spine's own resolution instead, interpolated, so any length is safe; the hand-drawn wobble is a
// per-point jitter here and the pencil's own shake on the contour.
const fillStrip = (h, fills, spine, widths, phase = 0) => {
  const L = [], R = [], n = spine.length;
  const widthAt = (i) => {
    if (widths.length === n) return widths[i];
    const t = n === 1 ? 0 : (i / (n - 1)) * (widths.length - 1);
    const a = Math.floor(t), b = Math.min(widths.length - 1, a + 1);
    return widths[a] + (widths[b] - widths[a]) * (t - a);
  };
  for (let i = 0; i < n; i += 1) {
    const [x, y] = spine[i];
    const [ax, ay] = spine[Math.max(0, i - 1)];
    const [bx, by] = spine[Math.min(n - 1, i + 1)];
    let dx = bx - ax, dy = by - ay;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = widthAt(i);
    const j = h.noise(i * 3.7 + phase) * 0.0045;   // the hand's swing, per rail point — crumple's job, done safely
    L.push([x - dy * (w + j), y + dx * (w + j)]);
    R.push([x + dy * (w - j), y - dx * (w - j)]);
  }
  for (let i = 0; i + 1 < n; i += 1) {
    paintPart(fills, h.spec, [L[i], L[i + 1], R[i + 1], R[i]], h.ink0, { own: true });
  }
  return [...L, ...R.slice().reverse()];
};

// Curtain bangs — the pretty one: parted in the middle, two sweeps framing the face. Each sweep is a ribbon
// from the part down past the temple; the parting gap widens downward (the forehead shows, with the scalp's
// hairline across it), and the tips drop past the brow only beside the eyes — the side zone the browLine
// rule leaves open
const frontCurtain = (h) => {
  const { front, frontFills, spec, box, rx, ry, cy } = h;
  const brow = browLine(spec, box);
  const tipY = Math.max(brow - ry * 0.24, eyeSafeY(h) - ry * 0.1);   // the tips may drop past the brow, but a turned wide-set eye must clear them (the strip is narrow — a 0.1·ry grace)
  for (const side of [-1, 1]) {
    const spine = [
      [side * rx * 0.1, cy + ry * 0.8],
      [side * rx * 0.38, cy + ry * 0.6],
      [side * rx * 0.62, cy + ry * 0.3],
      [side * rx * 0.8, Math.max(brow + ry * 0.08, tipY + ry * 0.16)],   // the rail under this point dips ~half its width — keep it tied above the tip
      [side * rx * 0.9, tipY]
    ];
    const boundary = fillStrip(h, frontFills, spine, [ry * 0.1, ry * 0.17, ry * 0.19, ry * 0.14, ry * 0.04], spec.roll * 0.0017 + side * 2);
    front.contour(boundary, { color: h.lineInk });
    front.line([[side * rx * 0.24, cy + ry * 0.62], [side * rx * 0.6, brow + ry * 0.16]], { color: h.grainInk, size: "S" });
  }
};

// Swept bangs (앞머리) — a **deep side parting**: the whole fringe starts at one temple and sweeps across the
// forehead as one diagonal mass, thick at the part and thinning to a tip past the far temple. Which side it
// parts on is per individual (the roll, like the ponytail's tie). The hem is a straight run from high at the
// part to low at the far tip, so the forehead shows as a wedge under it rather than a band — and both ends
// stay above eyeSafeY, since the panel is opaque
const frontSwept = (h) => {
  const { front, frontFills, spec, box, rx, ry, cy } = h;
  const brow = browLine(spec, box);
  const side = spec.roll % 2 ? 1 : -1;                        // which side the parting falls on
  const safe = eyeSafeY(h);
  // **A parting is two pieces, and neither one stops at the brow.** In the reference the fringe leaves one
  // parting high on the crown, and BOTH ends carry on round the temples and down the side of the face to the
  // **mouth** — which is exactly where the 양갈래 sheets pick up (backSheets anchors on the same mouthDrop).
  // Cut at the brow instead and the fringe reads as a patch laid on the forehead with the sheets floating
  // under it, unattached. Drawn as one diagonal slab there is no parting at all, just a wedge.
  const px = side * rx * 0.22;                                // the part — 2:3 across the head's width
  const py = cy + ry * 0.96;
  const stop = FRINGE_END(h);   // both locks run down to here
  // The lane the side locks run down: outside the widest eye (they are opaque, and the front layer is above
  // the face). A very wide-set eye leaves no lane, and then the locks stop at the temple as before
  const eyes = eyeGeometry(spec, box);
  const eyeOuter = Math.max(...eyes.map((e) => Math.abs(e.x) + e.r));
  const lockX = Math.max(eyeOuter + ry * 0.12, rx * 0.9);
  const runsDown = lockX < rx * 1.04;
  const W = [ry * 0.08, ry * 0.18, ry * 0.2, ry * 0.15, ry * 0.1, ry * 0.05];   // interpolated over the spine

  const far = [                                               // the long side (3) — across the brow, then down
    [px, py],
    [-side * rx * 0.14, cy + ry * 0.9],
    [-side * rx * 0.52, cy + ry * 0.66],
    [-side * rx * 0.82, Math.max(brow + ry * 0.06, safe)]
  ];
  if (runsDown) far.push([-side * lockX, cy + ry * 0.06], [-side * lockX, stop]);
  front.contour(fillStrip(h, frontFills, far, W, spec.roll * 0.0019), { color: h.lineInk });

  const near = [                                              // the short side (2) — straight down the near side
    [px, py],
    [side * rx * 0.5, cy + ry * 0.82],
    [side * rx * 0.76, Math.max(brow + ry * 0.14, safe)]
  ];
  if (runsDown) near.push([side * lockX, cy + ry * 0.08], [side * lockX, stop]);
  front.contour(fillStrip(h, frontFills, near, [ry * 0.07, ry * 0.14, ry * 0.13, ry * 0.1, ry * 0.05], spec.roll * 0.0023 + 7),
    { color: h.lineInk });

  // No grain lines on this fringe. They were drawn from the part across the sweep, but a straight line between
  // two points on a curved mass leaves the fill and lands on the bare face, where a hair stroke reads as a
  // stray whisker rather than as the hair's grain. The mass's own contour carries the shape.
};

// back kind × front kind → one hair value.
//   backs  bob a 단발 mass to just under the chin · sheets a pair falling beside the FACE to frayed ends
//   fronts blunt the straight 일자 hem · curtain a middle parting · swept one deep side parting across the brow
// The scalp's hairline in the middle is the front kind's business: a parting has to show the forehead up to
// it, a solid panel hides it
const HAIRLINE = { curtain: 0.55, swept: 0.66 };
const filledHair = (backKind, frontKind) => (h) => {
  const line = HAIRLINE[frontKind];
  // Every back gets the scalp. It follows the head's own outline (grownOutline reads headShape, so a square
  // skull keeps its corners), and without it the crown is bare skin between the fringe and the sheets — which
  // does not read as a hairstyle, it reads as balding
  scalp(h, line === undefined ? undefined : h.cy + h.ry * line, backKind === "sheets");
  if (backKind === "sheets") backSheets(h);
  else backMass(h, h.cy - h.ry * 1.14, 1.06);
  // **No fringe piece.** All four of these carried a filled panel over the forehead and it did more harm than
  // good: four values that read as one, and a slab whose lower edge the eye takes for a hat's brim. What tells
  // them apart now is the scalp's own hairline (HAIRLINE above) — blunt sits low over the forehead, curtain
  // mid, swept high. frontBlunt / frontCurtain / frontSwept are kept below, unused, until that is settled
};

// Kind → drawing function. 1:1 with the names in slots.js SLOTS.hair (none has none)
export const HAIR = {
  bob: mopCap({ depth: 0.56, passes: 14, spread: 0.26 }),
  mop: mopCap({ depth: 0.62, passes: 20, spread: 0.3 }),
  scribble: mopCap({ depth: 0.6, passes: 22, spread: 0.26 }),
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
  appleBig: appleOf(1.7),
  bobSwept: filledHair("bob", "swept"),
  sheetsSwept: filledHair("sheets", "swept")
};

export function drawHair(layers, spec, box, noise) {
  const kind = spec.parts.hair;
  const draw = HAIR[kind];
  if (!draw) return;   // none (or an unknown value)
  // The hair's own colour (palette.hair — HAIRS, or a POP when one is aimed here). It used to be palette.ink,
  // which is why every head on the board wore the same black
  const hairColor = paintOf(spec, "hair") || spec.palette.ink;   // paint: the hair's box, or one a hand chose
  const ink0 = hairColor;
  draw({
    ...layers,
    spec, box, noise,
    ink0,
    lineInk: spec.palette.ink,   // the filled family's contour — the board's outline, dark whatever the hair is
    // The strands drawn INSIDE a filled shape are a tone of the hair itself, not the board's ink: dark ink on
    // dark hair is the "on the same colour" way of vanishing. Light hair deepens, dark hair tints
    grainInk: luminance(hairColor) < 105
      ? tint(hairColor, 0.42)
      : deepen(hairColor, 0.4),
    rx: box.headRx, ry: box.headRy, cy: box.headCy,
    shoulder: box.bodyTop - 0.02   // the floor back hair comes down to (the shoulder)
  });
}
