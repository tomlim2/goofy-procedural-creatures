// Hair — three slots, combined freely: the FRONT (hairFront — what falls over the forehead), the BACK (hairBack — what hangs
// behind and beside the head) and the TOP (hairTop — what sits on the crown). Every piece is **filled**: the boundary drawn
// first, a closed form, and the inside painted with the hair's material, contoured in the pencil's dark ink — the same pen as
// a hat. A scalp cap is drawn under any front or back (its hairline the front kind's); the strand kinds (spikes, tufts, the
// apple tops, curls) are small filled shapes too — a spike a wedge, a strand a leaf, a curl a disc — since a hair drawn as a
// bare line beside a filled head read as a smudge. drawHair (the end of the file) composes the three; the tables FRONTS ·
// BACKS · TOPS are 1:1 with slots.js
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
import { blobPath, crumple } from "../../shape.js";
import { headShape, eyeGeometry } from "./layout.js";
import { browLine } from "./head.js";
import { paintPart } from "./body.js";
import { luminance, tint, deepen } from "../../color.js";

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
// Its outer edge is **the head's own drawn outline** (h.headPath — the very path drawHead inked, lumps and all), not a
// grown copy of the head shape: the scalp sits in FRONT of the head (the crown layer), and grown 5% it lay a band of hair
// colour outside the head's ink line down both temples, with the head's line running through the hair and no line of its
// own at the edge — the same-colour way of vanishing (a dark contour on dark hair). On the head's own path the fill stays
// inside the head's line and the contour re-inks that same line
// The middle boundary is the front kind's business: under a blunt panel it sits a shade above the
// bangs hem (the doubled line hides under the panel); behind a curtain parting it rises high — the parting
// gap has to show the forehead's skin up to the hairline, or the parting reads as one solid panel
// frontY: the hairline's y in the middle — a number, or a function of x for a hairline that slants (sweep). hemAt(x, y): the hem
// pulled off its smooth line — ragged (mop) or wavy (scribble)
const scalp = (h, frontY, topLine, hemAt) => {
  const { crown, crownFills, spec, box, rx, ry, cy } = h;
  const brow = frontY ?? browLine(spec, box) + ry * 0.1;
  const frontAt = (x) => (typeof brow === "function" ? brow(x) : brow);
  const sideBottom = Math.max(cy - ry * 0.45, eyeSafeY(h));
  const bottomAt = (x) => {
    const u = Math.abs(x) / rx;
    const k = u <= 0.5 ? 0 : u >= 0.98 ? 1 : (() => { const q = (u - 0.5) / 0.48; return q * q * (3 - 2 * q); })();
    const base = frontAt(x) * (1 - k) + sideBottom * k;
    return hemAt ? hemAt(x, base) : base;
  };
  const outline = h.headPath || grownOutline(h, 1.0, 1.0, 3, 0.04);   // the head's drawn path; a caller without one gets the head shape at 1
  const upper = outline.filter(([x, y]) => y >= bottomAt(x)).sort(arcSort(cy));
  const hem = [];
  const N = hemAt ? 24 : 10;   // a jagged or wavy hem needs the points to show it
  for (let i = 0; i <= N; i += 1) { const x = -rx * 0.97 + (i / N) * rx * 1.94; hem.push([x, bottomAt(x)]); }
  const poly = [...upper, ...hem];   // right → crown → left, then the hairline left → right
  paintPart(crownFills, spec, poly, h.ink0, { part: "hair", own: true, concave: true });   // a cap with side lobes is not visible from its centre
  // **Only the hairline gets a line when a mass sits behind the skull.** The scalp's top arc is the head's own
  // line, and the mass behind carries the silhouette a little outside it in the same colour, so the arc needs no
  // line of its own there. With nothing behind (the sheets back) the arc is re-inked with the hairline — the same
  // path the head drew, so it is one line, not two
  if (topLine) crown.contour(poly, { color: h.lineInk });
  else crown.line(hem, { color: h.lineInk });
};

// The back mass — the grown dome falling to a hem. bob wears it alone (hem just under the chin, a small
// A-line flare); long wears it cut at the chin and hangs the side sheets from it
const backMass = (h, hem, flare, { grow = [1.16, 1.08], lumps = 4, amount = 0.05 } = {}) => {
  const { back, backFills, spec, rx, ry, cy } = h;
  const arc = grownOutline(h, grow[0], grow[1], lumps, amount).filter(([, y]) => y >= cy - ry * 0.05).sort(arcSort(cy));
  const [rx0] = arc[0];
  const [lx0] = arc[arc.length - 1];
  const poly = crumple([...arc,
    [lx0 * 1.02, cy - ry * 0.6], [lx0 * flare, hem + ry * 0.03],
    [lx0 * 0.6, hem], [0, hem + ry * 0.015], [rx0 * 0.6, hem - ry * 0.01],
    [rx0 * flare, hem + ry * 0.03], [rx0 * 1.02, cy - ry * 0.6]
  ], 0.0035, spec.roll * 0.0011);
  paintPart(backFills, spec, poly, h.ink0, { part: "hair", own: true, concave: true });
  back.contour(poly, { color: h.lineInk });
};

// **No 장발 (a dome plus two side sheets to the chest).** Two filled sheets flanking a gap down the middle of the TORSO is a
// silhouette to stay away from: the long back once hung a sheet at each side from the shoulder to the chest, and the narrow strip
// left between them framed the torso — which tapers and ends round — into an obscene shape on slim, skin-coloured bodies. A
// back that put the shoulder-length mass and the sheets together (verylong) was tried and taken out by eye. The sheets on
// their own (below) are fine: they hang beside the HEAD and the face, not the torso
const FRINGE_END = (h) => h.cy - h.ry * 0.82;   // down past the cheek, about the jaw line — where the front's locks stop
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
    paintPart(backFills, spec, poly, h.ink0, { part: "hair", own: true, concave: true });   // the tassels are notches — fanned, they filled in
    back.contour(poly, { color: h.lineInk });
    for (const k of [1.02, 1.26]) {   // the strand grain — following the splay, out where the sheet actually shows
      back.line([[side * rx * (k * 0.8), top - ry * 0.04], [side * rx * k, hem + span * 0.22]], { color: h.grainInk, size: "S" });
    }
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
    paintPart(fills, h.spec, [L[i], L[i + 1], R[i + 1], R[i]], h.ink0, { part: "hair", own: true });
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
  const tipY = Math.max(brow - ry * 0.24, eyeSafeY(h));   // the tips may drop past the brow but never into the eye band: with a 0.1·ry grace they grazed a big eye's white on a turned face
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
  const lockX = Math.max(eyeOuter + ry * 0.2, rx * 0.9);   // a fifth of the head's half-height clear of the eye — at 0.12 the near lock sat on a big eye's outer line
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


// ---- The filled family, the rest — the kinds that used to be fur -----------------------------------------
// Every piece here is painted `concave` (stroke.js fillPolygon): a cap with side lobes, a hood, a ragged sheet are not
// visible from their centre, and the fan from the centre spilled across their notches onto the face

// One filled blob — a bun, a bunch, the ball at a twintail's end
const blobPiece = (h, ink, fills, x, y, bx, by, phase) => {
  const p = blobPath(x, y, bx, by, { lumps: 4, amount: 0.15, noise: null, phase });
  paintPart(fills, h.spec, p, h.ink0, { part: "hair", own: true });
  ink.contour(p, { color: h.lineInk });
};
// A tail — a ribbon along a spine on the back layer, contoured
const tailPiece = (h, spine, widths, phase) => h.back.contour(fillStrip(h, h.backFills, spine, widths, phase), { color: h.lineInk });

// Bangs — the cap, and a panel over the forehead on the front layer (a hat sits above it), rooted inside the cap so the two
// read as one mass: the panel's top edge lies in the cap's fill and draws no line, its sides and its ragged hem do. The
// hem clears the brow and never enters the eye band (the panel is opaque)
const bangsPanel = (h) => {
  const { front, frontFills, spec, box, rx, ry, cy, noise } = h;
  const hemY = Math.max(browLine(spec, box) + ry * 0.04, eyeSafeY(h));
  const top = cy + ry * 0.66;
  const hem = [];
  for (let i = 0; i <= 8; i += 1) hem.push([-rx * 0.76 + (i / 8) * rx * 1.52, hemY + Math.abs(noise(i * 2.7 + spec.roll * 0.002)) * ry * 0.09]);
  const poly = [[-rx * 0.8, top], [-rx * 0.82, hemY + ry * 0.06], ...hem, [rx * 0.82, hemY + ry * 0.06], [rx * 0.8, top]];
  paintPart(frontFills, spec, poly, h.ink0, { part: "hair", own: true, concave: true });
  front.line(poly, { color: h.lineInk });   // open — the top edge, inside the cap, draws no line
  for (const sx of [-0.4, -0.05, 0.3]) front.line([[sx * rx, top - ry * 0.04], [sx * rx * 1.04, hemY + ry * 0.12]], { color: h.grainInk, size: "S" });
};
// A side lock — one lock falling from a parting down one cheek to the jaw line, the side per individual; the other side bare.
// The lock runs outside the widest eye (it is opaque, over the face); a very wide-set eye leaves no lane, and then it stops at
// the temple
const sideLock = (h) => {
  const { front, frontFills, spec, box, rx, ry, cy } = h;
  const side = spec.roll % 2 ? 1 : -1;
  const eyes = eyeGeometry(spec, box);
  const eyeOuter = Math.max(...eyes.map((e) => Math.abs(e.x) + e.r));
  const lockX = Math.max(eyeOuter + ry * 0.2, rx * 0.9);   // the swept's lane
  const spine = [[side * rx * 0.2, cy + ry * 0.94], [side * rx * 0.5, cy + ry * 0.8], [side * rx * 0.78, Math.max(browLine(spec, box) + ry * 0.12, eyeSafeY(h))]];
  if (lockX < rx * 1.04) spine.push([side * lockX, cy + ry * 0.06], [side * lockX, FRINGE_END(h)]);
  front.contour(fillStrip(h, frontFills, spine, [ry * 0.07, ry * 0.15, ry * 0.13, ry * 0.1, ry * 0.05], spec.roll * 0.0023 + 11), { color: h.lineInk });
};

// Bun — one bunch on top and a pin (the thin cap under it is drawHair's)
const bunTop = (h) => {
  const { crown, cy, ry, spec } = h;
  const bx = 0.01, by = cy + ry * 1.05;
  blobPiece(h, crown, h.crownFills, bx, by, 0.048, 0.042, spec.roll * 0.0031);
  crown.line([[bx - 0.07, by + 0.02], [bx + 0.06, by - 0.01]], { color: h.lineInk, size: "S" });   // the pin
};
// Pigtails — two bunches at the sides, behind the ears, each with a tie
const pigtailsBack = (h) => {
  const { rx, ry, cy, spec } = h;
  for (const side of [-1, 1]) {
    const bx = side * rx * 1.02, by = cy + ry * 0.3;
    blobPiece(h, h.back, h.backFills, bx, by, 0.045, 0.06, spec.roll * 0.0021 + side);
    h.back.line([[bx - side * 0.02, by + 0.05], [bx + side * 0.01, by + 0.075]], { color: h.lineInk });   // the tie
  }
};

// The hood types — a mass a little bigger than the head, from the crown down to the brow at the front and below the ears
// at the sides, on the front layer (a hat sits above it); the hem never enters the eye band. helmet straight — a smooth
// outline and strokes falling from the crown toward the hem · cloud curly — a scalloped outline with curls along it
const hood = ({ grow, lumps, amount, grain = false, curls = false }) => (h) => {
  const { front, frontFills, spec, box, rx, ry, cy, noise } = h;
  const safe = eyeSafeY(h);
  const mid = Math.max(browLine(spec, box) + ry * 0.04, safe);
  const sideBottom = Math.max(cy - ry * 0.45, safe);
  const bottomAt = (x) => {
    const u = Math.abs(x) / rx;
    const k = u <= 0.5 ? 0 : u >= 0.98 ? 1 : (() => { const q = (u - 0.5) / 0.48; return q * q * (3 - 2 * q); })();
    return mid * (1 - k) + sideBottom * k;
  };
  const outer = grownOutline(h, grow, grow, lumps, amount).filter(([x, y]) => y >= bottomAt(x)).sort(arcSort(cy));
  const hem = [];
  for (let i = 0; i <= 16; i += 1) { const x = -rx * grow * 0.97 + (i / 16) * rx * grow * 1.94; hem.push([x, bottomAt(x) + Math.abs(noise(i * 3.3 + spec.roll * 0.002)) * ry * 0.035]); }
  const poly = [...outer, ...hem];
  paintPart(frontFills, spec, poly, h.ink0, { part: "hair", own: true, concave: true });
  front.contour(poly, { color: h.lineInk });
  if (grain) {   // straight hair — strokes falling from the crown, fanning a little outward, to a ragged end above the hem
    for (let x = -rx * grow * 0.85; x < rx * grow * 0.86; x += 0.028) {
      const u = Math.min(0.999, Math.abs(x) / (rx * grow));
      const top = cy + ry * grow * Math.sqrt(1 - u * u) - ry * 0.06;
      const bottom = bottomAt(x) + ry * (0.05 + Math.abs(noise(x * 31 + spec.roll * 0.003)) * 0.08);
      if (top - bottom < ry * 0.15) continue;
      front.line([[x, top], [x + x * 0.04, (top + bottom) / 2], [x + x * 0.09, bottom]], { color: h.grainInk, size: "S" });
    }
  }
  if (curls) {   // small curls along the scalloped edge, and a few loops inside in the hair's own tone
    for (let i = 0; i < 11; i += 1) {
      const a = Math.PI * (1 - i / 10);
      const bx = Math.cos(a) * rx * grow * 0.96, by = cy + Math.sin(a) * ry * grow * 0.96;
      if (by < bottomAt(bx) + ry * 0.04) continue;
      const r = 0.026 + noise(i * 4.4 + spec.roll * 0.002) * 0.01;
      front.contour(blobPath(bx, by, r, r, { lumps: 4, amount: 0.25, noise: null }), { color: h.lineInk });
    }
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI * (0.85 - 0.7 * (i / 5));
      const bx = Math.cos(a) * rx * 0.6, by = cy + Math.sin(a) * ry * 0.75;
      const r = 0.018 + noise(i * 3.3 + 7) * 0.006;
      front.contour(blobPath(bx, by, r, r * 0.9, { lumps: 3, amount: 0.2, noise: null }), { color: h.grainInk, size: "S" });
    }
  }
};

// Twintails — two tails tied high at the sides, hanging back, each with a tie
const twintailsBack = (h) => {
  const { back, rx, ry, cy, spec } = h;
  for (const side of [-1, 1]) {
    const tx = side * rx * 0.95, ty = cy + ry * 0.35;
    const spine = [[tx, ty], [tx + side * 0.05, ty - 0.06], [tx + side * 0.06, ty - 0.18], [tx + side * 0.04, ty - 0.3]];
    tailPiece(h, spine, [0.018, 0.03, 0.028, 0.01], spec.roll * 0.0029 + side * 5);
    back.line([[tx - side * 0.012, ty + 0.03], [tx + side * 0.03, ty - 0.02]], { color: h.lineInk });   // the tie
  }
};
// The twin buns — two big balls and nothing else (the reference's space buns), behind the head, each with a tie across its
// neck where it meets the head. Where they are tied is the kind: on top of the head, low behind the jaw, or out at the sides
const twinBuns = ({ x, y, r }) => (h) => {
  const { back, backFills, rx, ry, cy, spec } = h;
  for (const side of [-1, 1]) {
    const bx = side * rx * x, by = cy + ry * y, br = ry * r;
    blobPiece(h, back, backFills, bx, by, br, br * 0.94, spec.roll * 0.0043 + side * 7);
    // the tie — a short line across the neck, on the ball's edge toward the head's centre
    const dx = -bx, dy = cy - by, l = Math.hypot(dx, dy) || 1;
    const nx = bx + (dx / l) * br * 0.85, ny = by + (dy / l) * br * 0.85;
    const tx = -dy / l, ty = dx / l;
    back.line([[nx - tx * br * 0.45, ny - ty * br * 0.45], [nx + tx * br * 0.45, ny + ty * br * 0.45]], { color: h.lineInk });
  }
};
// Ponytail — tied on one side behind the crown (per individual), rising and hanging back
const ponytailBack = (h) => {
  const { back, rx, ry, cy, spec } = h;
  const s = spec.roll % 2 ? 1 : -1;
  const px0 = s * rx * 0.25, py0 = cy + ry * 0.92;
  const spine = [[px0, py0], [px0 + s * 0.06, py0 + 0.06], [px0 + s * 0.13, py0 + 0.02], [px0 + s * 0.15, py0 - 0.14], [px0 + s * 0.11, py0 - 0.3]];
  tailPiece(h, spine, [0.02, 0.03, 0.03, 0.026, 0.012], spec.roll * 0.0041);
  back.line([[px0 - s * 0.01, py0 - 0.02], [px0 + s * 0.035, py0 + 0.03]], { color: h.lineInk });   // the tie
};


// ---- The strand kinds, filled -----------------------------------------------------------------------------
// The nearest point of the head's drawn outline at an angle round the head's centre (0 = the right, π/2 = the crown)
const outlineAt = (h, angle) => {
  const path = h.headPath || grownOutline(h, 1, 1, 3, 0.04);
  let best = path[0], bd = Infinity;
  for (const p of path) {
    let d = Math.abs(Math.atan2(p[1] - h.cy, p[0]) - angle);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
};
// A spiked band round the crown — the outer edge a zigzag of wedges standing out from the head's outline, the inner edge the
// outline itself, a little inside. The mohawk is a band on the crown layer, on the head: the whole hair, contoured all round —
// its inner edge is the head's own line, so that is one line, not two. The spiked rings (spikes · hedgehog) are **backs**: the
// band on the back layer, behind the head, so only the wedges standing out past the outline show and the head covers the rest
const spikedBand = ({ span, count, len0, lenVar, behind = false }) => (h) => {
  const layer = behind ? h.back : h.crown, fills = behind ? h.backFills : h.crownFills;
  const { spec, noise, cy } = h;
  const cap = undefined;
  const zig = [];
  const inside = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const a = Math.PI * (0.5 + span * (t - 0.5));
    const base = outlineAt(h, a);
    const len = len0 + Math.abs(noise(i * 3.1 + span * 7 + spec.roll * 0.001)) * lenVar;
    const tip = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
    if (i > 0) {   // the valley between two spikes sits on the outline, a hair inside it
      const am = Math.PI * (0.5 + span * ((t - 0.5 / (count - 1)) - 0.5));
      const v = outlineAt(h, am);
      zig.push([v[0] * 0.995, cy + (v[1] - cy) * 0.995]);
    } else {
      zig.push([base[0] * 0.995, cy + (base[1] - cy) * 0.995]);
    }
    zig.push(tip);
    if (i === count - 1) zig.push([base[0] * 0.995, cy + (base[1] - cy) * 0.995]);
    inside.push([base[0] * (cap !== undefined ? 0.9 : 1), cy + (base[1] - cy) * (cap !== undefined ? 0.9 : 1)]);
  }
  const poly = [...zig, ...inside.reverse()];
  paintPart(fills, spec, poly, h.ink0, { part: "hair", own: true, concave: true });
  layer.contour(poly, { color: h.lineInk });
};
// A leaf — one strand as a thin filled ribbon along a curve, from a root to a point
const leaf = (h, ink, fills, root, tip, width, phase) => {
  const mid = [(root[0] + tip[0]) / 2 + (tip[1] - root[1]) * 0.08, (root[1] + tip[1]) / 2];
  ink.contour(fillStrip(h, fills, [root, mid, tip], [width * 0.6, width, width * 0.15], phase), { color: h.lineInk });
};
// A few leaves standing off the crown — tuft four, wisp seven
const tuftsOf = (count) => (h) => {
  const { crown, crownFills, rx, ry, cy, noise, spec } = h;
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const a = Math.PI * (0.25 + 0.5 * t);
    const root = [Math.cos(a) * rx * 0.8, cy + Math.sin(a) * ry * 0.9];
    leaf(h, crown, crownFills, root, [root[0] + noise(i * 5.5) * 0.07, root[1] + 0.09 + t * 0.03], 0.011, spec.roll * 0.0019 + i);
  }
};
// Curly — seven small discs along the crown
const curlyF = (h) => {
  const { crown, crownFills, rx, ry, cy, noise, spec } = h;
  for (let i = 0; i < 7; i += 1) {
    const k = i / 6;
    const a = Math.PI * (0.8 - 0.6 * k);
    const r = 0.03 + noise(i * 4.4) * 0.012;
    blobPiece(h, crown, crownFills, Math.cos(a) * rx * 0.88, cy + Math.sin(a) * ry * 0.92, r, r, spec.roll * 0.0023 + i);
  }
};
// Apple top — a bunch rising from the middle of the crown like an apple stem, leaves in a fan with one tie. size 1 the small
// one (four leaves) · 1.7 the big one (six, long and thick)
const appleOfF = (size) => (h) => {
  const { crown, crownFills, ry, cy, spec } = h;
  const bx = 0.005, by = cy + ry * 1.0;
  const count = size > 1 ? 6 : 4, spread = size > 1 ? 0.15 : 0.1;
  for (let i = 0; i < count; i += 1) {
    const a = Math.PI * (0.5 + spread * (i - (count - 1) / 2));
    leaf(h, crown, crownFills, [bx, by - 0.006], [bx + Math.cos(a) * 0.05 * size, by + Math.sin(a) * 0.055 * size + 0.01], 0.012 * size, spec.roll * 0.0033 + i);
  }
  crown.line([[bx - 0.018 * size, by - 0.006], [bx + 0.018 * size, by - 0.002]], { color: h.lineInk });   // the tie
};

// The three tables — 1:1 with slots.js SLOTS.hairFront · hairBack · hairTop (none draws nothing of its own)
export const FRONTS = {
  hairline: () => {},       // the plain fringe — the cap itself down to a straight hairline; drawHair draws the cap
  blunt: bangsPanel,        // the straight fringe as a panel, its hem ragged
  swept: frontSwept,        // a deep side parting, both locks running down past the temples
  curtain: frontCurtain,    // a middle parting, two sweeps framing the face
  sideLock,                 // one lock down one cheek
  cap: () => {},            // the crown cap alone — drawHair draws it
  mohawk: spikedBand({ span: 0.35, count: 7, len0: 0.06, lenVar: 0.09 }),
  tuft: tuftsOf(4),
  wisp: tuftsOf(7),
  curly: curlyF,
  helmet: hood({ grow: 1.06, lumps: 3, amount: 0.04, grain: true }),
  cloud: hood({ grow: 1.2, lumps: 9, amount: 0.13, curls: true })
};
export const BACKS = {
  bob: (h) => backMass(h, h.cy - h.ry * 0.72, 1.02, { grow: [1.14, 1.07], lumps: 4, amount: 0.05 }),          // to the ear, straight
  mop: (h) => backMass(h, h.cy - h.ry * 0.95, 1.06, { grow: [1.24, 1.12], lumps: 6, amount: 0.09 }),          // to the jaw, shaggy
  long: (h) => backMass(h, h.shoulder, 1.14),                                                                    // to the shoulder, a little flare
  sheets: backSheets,                                                                                            // the side sheets to the hip
  twintails: twintailsBack,
  bunsTop: twinBuns({ x: 0.72, y: 0.98, r: 0.4 }),    // tied on top of the head, at the corners of the crown
  bunsLow: twinBuns({ x: 0.92, y: -0.4, r: 0.34 }),   // low, behind the jaw
  bunsSide: twinBuns({ x: 1.08, y: 0.22, r: 0.36 }),  // out at the sides, ear height
  ponytail: ponytailBack,
  pigtails: pigtailsBack,
  spikes: spikedBand({ span: 0.95, count: 11, len0: 0.06, lenVar: 0.09, behind: true }),    // long wedges round the upper half
  hedgehog: spikedBand({ span: 0.9, count: 15, len0: 0.05, lenVar: 0.07, behind: true })    // short and many — a hedgehog's back
};
export const TOPS = {   // what is tied ON the crown
  bun: bunTop,
  apple: appleOfF(1),
  appleBig: appleOfF(1.7)
};
// **A back is only what hangs behind the head.** The scalp cap — the piece IN FRONT of the head, on the crown layer — is the
// front's: the fringes bring it down to their hairline, the crown cap stops at 0.7 of the head above its centre (the forehead
// bare; at 0.78 the cap alone read as a skullcap rather than hair), and the strand fronts (mohawk, tufts, curls) and the hoods
// bring none — a mohawk stands on a bare head, a hood covers the crown itself. A bun on the top brings a
// thin cap of its own when the front brings none. A back never draws one: drawn with the back it was two pieces for one
// hairstyle, a mass behind and a cap in front, and the seam between them showed
const FRONT_CAP = { hairline: 0.5, blunt: 0.58, swept: 0.66, curtain: 0.55, sideLock: 0.6, cap: 0.7 };
const TOP_CAP = { bun: 0.82 };
const DOME_BACKS = new Set(["bob", "mop", "long"]);   // a mass behind the skull carries the silhouette — the cap draws only its hairline

export function drawHair(layers, spec, box, noise) {
  const front = spec.parts.hairFront || "none", back = spec.parts.hairBack || "none", top = spec.parts.hairTop || "none";
  if (front === "none" && back === "none" && top === "none") return;
  // The hair's own colour (palette.hair — HAIRS, or a POP when one is aimed here). It used to be palette.ink,
  // which is why every head on the board wore the same black
  const hairColor = paintOf(spec, "hair") || spec.palette.ink;   // paint: the hair's box, or one a hand chose
  const ink0 = hairColor;
  const h = {
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
  };
  if (BACKS[back]) BACKS[back](h);                                   // behind the head first
  const capLine = FRONT_CAP[front] ?? (front === "helmet" || front === "cloud" ? undefined : TOP_CAP[top]);
  if (capLine !== undefined) scalp(h, h.cy + h.ry * capLine, !DOME_BACKS.has(back));
  if (TOPS[top]) TOPS[top](h);                                       // on the crown
  if (FRONTS[front]) FRONTS[front](h);                               // over the face, last
}
