// The goofy materials — what a surface is made of: how its area is filled. The tables (GOOFY_MATERIALS, VALUES) and the procedures that paint a
// sketch with them. A Sketch delegates paint() here; nothing here imports stroke.js — the sketch is handed in.
// Docs: guidelines/drawing.md § the goofy material, § values; how.html § the goofy material

import { hexToRgb, shade, isDark, luminance, tint, deepen, headroom } from "../color.js";
import { blobPath } from "../shape.js";

const TAU = Math.PI * 2;

// Goofy materials — what a surface is made of, the way a 3D material is: **how its area is filled**, as channels. `base` is the base
// color — the fill-up (flat) — always opaque (on the board the one in front has to hide the one behind), printed out of
// register, in the part's color or a tone of it — and it carries the creature's pattern (stripes, dots, spots, hatching: the `pattern`
// slot), drawn inside it and clipped to the contour, the way a pattern is part of an albedo. `texture` is the base color's texture —
// hatch, scratch, dab, speckle or wash — the medium's pattern laid over it, clipped to the contour. Both paint the same thing, the color of the surface; a channel that would be a
// different thing (opacity — the reference's 62% graphite; grain — the paper showing through) is not built, and would be a new key,
// not a second texture. That is the goofy material, and nothing else: the contour is a separate concept (GOOFY_OUTLINES, below). The
// color always comes from the part; every tone the texture adds is a shade of that color (lighter on a dark color, darker on a
// light one). A part names a goofy material and hands over the path and the color — it never picks a technique itself. The medium page
// draws one shader ball per entry, and its channels under it. Docs: guidelines/drawing.md § the goofy material.
// (Goofy, to keep them apart from the GPU materials — those live in scene/mesh.js.)
export const GOOFY_MATERIALS = {
  // Flat — the fill-up alone: the fan from the centre. What every creature is made of today
  FLAT:        { base: { kind: "flat" } },
  // Graphite — the part's color hatched with the pencil (the reference's ground is paper because its color is paper; ours keeps the
  // part's color — a lightened ground bleached pale parts and left them a different color from their neighbours): rules
  // laid with the **side of the lead**, nearly upright and a little slanted, each one drawn as a few strokes — the pencil lifts and comes
  // down again (lift: the strokes' lengths and the gaps between), now and then doubled. Their spacing is the step's.
  // `mark` is what the rules are drawn in — the same watering of the ground that ink scratches with, so the pencil's lines come
  // **up** out of the surface instead of pressing further down into it. The ground itself is the part's colour at every step
  // Scaled up **×1.6 as one piece** — the gap between rules, the stroke width and the lift's lengths together, so
  // it is the same hand drawing bigger and not a different one. At the old size the rules of the dense steps fell
  // close enough together to read as a flat grey wash on a creature rather than as hatching; a cell is 144 device
  // pixels across a world unit, and a 0.0115 gap is under two of them. The medium page's ball, being far bigger
  // on screen, never showed it — the board did
  // `scribble` is the scribble step's wave: its length and swing (world units) and its gap as a multiple of the ruling gap. At
  // 0.02 long and 0.0032 of swing the wave fell under the pencil's own wander and the rules read as straight; a third longer and
  // nearly twice the swing, with the rules set further apart so the crests do not meet, and it reads as the pencil going side to side
  GRAPHITE:    { base: { kind: "flat" }, texture: { kind: "hatch", angle: 1.42, gap: 0.0184, width: 0.0038, mark: 0.34, lift: { length: [0.112, 0.32], gap: [0.008, 0.022] }, double: 0.18, scribble: { wave: 0.034, amp: 0.0055, gap: 1.35 } } },
  // Ink — solid, scratched **open**: a few long light lines dragged across it, taking the ink away. The darkest step is the least
  // scratched (the ink still covers it), the lightest the most. It used to run the other way — the black step laid the most light
  // lines and came out the palest of the five
  // `tone` is a scratch's own tone — a mild watering of the part's colour, because a bleached mark is not a watered one
  INK:         { base: { kind: "flat" }, texture: { kind: "scratch", lines: 6, width: 0.005, tone: 1.35 } },
  // Oil — thick paint laid in blunt strokes: round-ended capsules of one width and many lengths, all along one diagonal, scattered
  // and overlapping, cut flat by the contour (the reference's ball: calm, dense, a knife's work). `washes` is the spread the paint is
  // laid in — four **waterings of the ground**, the same light ink scratches with, so every stroke reads as paint sitting on the
  // surface. On a dark ground the whole spread drops so the first of them go on **darker** than the ground instead (the dab case below)
  OIL:         { base: { kind: "flat" }, texture: { kind: "dab", angle: 0.5, spread: 0.12, width: 0.026, length: [0.08, 0.26], per: 400, washes: [0.06, 0.16, 0.28, 0.42], spreadEach: 0.5 } },
  // Charcoal — a ground dusted with dark specks, each a short stroke at its own angle rather than a square
  CHARCOAL:    { base: { kind: "flat" }, texture: { kind: "speckle", per: 900, size: [0.0025, 0.0055], tone: 0.55 } },
  // Watercolour — a wash, and how it dries. The ground is the part's colour at every step; the step is how loaded the brush is
  // (`strokes.load`) and how much the drying leaves. Over it, the things a wash does as it dries, and nothing a wash does not:
  //   `bloom` — a backrun, water dropped into the damp wash pushing the pigment out: a pale centre fading outward through nested
  //     lobes (`rings` tints, `shrink` per lobe — a gradient, no edge of its own), and the pigment it pushed gathered on **one side**
  //     as a soft deeper arc (`rim`, over `arc` of the turn). One to three of them, a fifth to two fifths of the part across —
  //     the touches of a brush, smaller than the part, larger than a speck. And the whole bloom is gone round **once with a
  //     broken hairline** (`sketch` — the `kind` at S, cut into dashes of `dash` length with `gap` between, at `opacity` of a
  //     pencil line: there is no opacity channel, so the line is the ground carried that share of the way to black, in the part's
  //     own family): the hand noting where the water went, the way a sketch under a wash shows through it. Not pigment — a thin
  //     line in pieces, so it does not read as a cell
  //   `edge` — pigment walks to where a wash stops drying: a thin deeper line just inside the contour, along a **run** of it
  //     (`run`, a share of the way round), never all the way — all the way round is a second outline
  //   `grain` — granulation, heavy pigment settling into the paper's tooth: fine deeper specks, more in the loaded steps
  //   `glaze` — a second wash laid over one side once the first has dried (wet on dry): a large lobe a little deeper, its inner
  //     boundary a soft hard edge, the rest of it cut by the contour. The loaded steps only — the shadow side of the part
  //   `drip` — a run: at the two heaviest steps, sometimes, paint runs down from the bloom, tapering to a bead
  //   `sparkle` — dry brush: at the thin steps a band of tiny pale flecks where the brush skipped the paper's tooth
  //   `strokes` — the brush itself: a few broad sweeps across the part along the hand's swing, each a rounded stroke a shade
  //     deeper or lighter than the ground (`tone`, a spread either side of it), laid under everything else so the blooms happen in
  //     them, and trailing off one end in dry bristle marks (`bristles`). `load` is how the count follows the step: a light
  //     wash is one or two sweeps, a loaded one is the brush going back over itself — the sweeps overlapping, each a shade off
  //     the last, which is where a wash shows its layers
  //   `lineMax` — the widest any line of the wash may be drawn (world units): the rim band, the dried edge, the glaze's edge,
  //     the bristles and the drip are all clamped to it, and the pencil-drawn edge holds its breath (breathe 0.5) so its swell
  //     stays under it too. A line wider than that reads as a stroke of paint rather than an edge
  // A wash never draws closed dark cells: the first wash here ringed every pool and ran the edge line the whole way round, and the
  // network of closed boundaries read as cracked earth. Blooms are the wash's lights (opened, like the ink's); the rim, the edge and
  // the grain are the one place besides charcoal a mark goes deeper, because that is what dried pigment is
  WATERCOLOUR: { base: { kind: "flat" }, texture: { kind: "wash", blooms: [1, 3], size: [0.22, 0.4], squash: [0.7, 1.15],
                                                    bloom: { rings: [0.07, 0.14, 0.22], shrink: 0.68 }, rim: { tone: 0.975, arc: 0.36, width: 0.0085 }, lineMax: 0.0045, sketch: { opacity: 0.08, kind: "PENCIL_SLINE", size: "S", dash: [0.03, 0.07], gap: [0.012, 0.028] },
                                                    edge: { inset: 0.05, width: 0.006, tone: 0.94, run: [0.3, 0.55] }, grain: { per: 360, size: [0.0015, 0.0028], tone: 0.74 },
                                                    glaze: { size: 0.46, tone: 0.96, edgeTone: 0.985, edgeWidth: 0.006, from: 0.35 },
                                                    drip: { chance: 0.55, length: [0.3, 0.6], width: 0.0034, from: 0.5 },
                                                    sparkle: { per: 260, size: [0.0018, 0.0036], tone: 0.3, until: 0.42 },
                                                    strokes: { count: [2, 4], length: [0.9, 1.5], width: [0.16, 0.28], tone: [-0.025, 0.06], spread: 0.5, bristles: 5, load: [0.4, 2.6] } } }
};


// Every tone a goofy material makes is **in the part's own family** — `tint` and `deepen` in color.js move lightness and leave the
// hue alone, so a blue part gets lighter and deeper blues. Lightening by mixing toward the light ink was tried and dropped: a blue
// part's marks came out grey, a red part's pink-beige, and the mark stopped belonging to the thing it was drawn on


// Values — how dark a surface is drawn, in five steps, named for the way graphite makes each (the reference's scale): black,
// hatch, scribble, stipple, light. A goofy material renders a step its own way — graphite changes technique step by step (cross-hatch →
// hatch → a wavy scribble → stipple → one thin set three gaps apart), ink, oil, charcoal and the watercolour wash change how much of
// their texture they lay down. **No step lays nothing**: half the board's surfaces are pale, and a material invisible there is a material unused.
// A part draws at the step its creature's `density` slot names (stepOf); the medium page names one outright per ball.
// A step is an **amount** of the medium — how much of its texture a material lays down — and never a tone of the ground: the ground is
// the part's colour at every step. It used to pull the ground toward the technique's own tone as well, so the five steps would survive
// the board's scale (carried by marks alone they measured 0.7~4.4 of luminance apart there), and with it a creature's palette colour
// darkened as its density rose — a skin at black was not the skin the palette named
export const VALUES = [
  { name: "black", v: 1 },
  { name: "hatch", v: 0.72 },
  { name: "scribble", v: 0.62 },
  { name: "stipple", v: 0.5 },
  { name: "light", v: 0.34 }
];
// The step a name asks for. The `density` slot holds one of the five outright (character/vocabulary/slots.js), so every step is
// reachable on any creature — a pale skin can be hatched black and a black one grazed light, and the colour decides the marks'
// tone rather than how many there are. An unknown name is the middle rung
export function stepOf(name) {
  const i = VALUES.findIndex((v) => v.name === name);
  return i < 0 ? 2 : i;
}

// The step a color would ask for on its own — its darkness. Only the fallback for a caller that names no step (the medium page's
// untextured ball); on the board the step is the creature's, from its density slot (stepOf, above)
function valueStep(color) {
  const lum = luminance(color);
  let i = lum < 70 ? 0 : lum < 120 ? 1 : lum < 160 ? 2 : lum < 200 ? 3 : 4;
  return Math.max(0, Math.min(VALUES.length - 1, i));
}


// -- the fill procedures' geometry --
// Point in a closed polygon (even-odd)
function insidePath([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// The pieces of the segment a→b that lie inside the polygon — the marks of a fill stop at its contour
function clipSegment(a, b, poly) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const ts = [];
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const ex = q[0] - p[0];
    const ey = q[1] - p[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((p[0] - a[0]) * ey - (p[1] - a[1]) * ex) / den;
    const u = ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / den;
    if (u >= 0 && u < 1 && t >= 0 && t <= 1) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const pieces = [];
  let inside = insidePath(a, poly);
  let prev = 0;
  for (const t of ts) {
    if (inside) pieces.push([prev, t]);
    inside = !inside;
    prev = t;
  }
  if (inside) pieces.push([prev, 1]);
  return pieces
    .map(([t0, t1]) => [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]])
    .filter(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.006);
}
// A hash in [0, 1) — scattered, unlike the value noise, which is smooth: for specks and dabs that must not line up
function hash01(k) {
  let h = Math.imul(k | 0, 0x9e3779b1) ^ 0x7f4a7c15;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function bounds(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: Math.hypot(x1 - x0, y1 - y0) / 2, x0, y0, x1, y1 };
}
// Parallel lines at `angle` across the shape, `gap` apart, each one clipped to the contour. jitter(i) nudges a line off its rank
function rules(points, angle, gap, jitter) {
  const b = bounds(points);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const nx = -dy, ny = dx;
  const out = [];
  let i = 0;
  for (let s = -b.r; s <= b.r; s += gap, i += 1) {
    const o = s + jitter(i) * gap;
    const a = [b.cx + nx * o - dx * b.r, b.cy + ny * o - dy * b.r];
    const c = [b.cx + nx * o + dx * b.r, b.cy + ny * o + dy * b.r];
    for (const piece of clipSegment(a, c, points)) out.push(piece);
  }
  return out;
}


// Fills with a named goofy material — its base color (with the part's pattern, if any), then its texture at a value step, every mark
// clipped to the contour. pattern: { kind, color } — the creature's
// pattern, part of the base color. value: the step to draw at
// (draw/body.js reads the creature's density slot; the medium page's rows name one). only: "base" or
// "texture" draws that channel alone. strip: [left, right] — the base is cut as a strip between the two rails instead of a fan from the
// centre (a tube that bones will bend: the tail); the contour (points) still clips the texture. Every tone is a shade of the part's color —
// the goofy material knows no colors of its own
export function paintWith(sketch, points, name, { color, only, pattern, value, strip, stripT, skinT } = {}) {
  // stripT(i) / skinT: the skin tags of the base — per rung of a strip, or one t for a fill (a bead on the tail); the texture's marks stay untagged
  const base = (c) => (strip ? sketch.fillStrip(strip[0], strip[1], c, stripT) : sketch.fill(points, c, skinT));
  const m = GOOFY_MATERIALS[name];
  if (!m) throw new Error(`unknown goofy material: ${name}`);
  const step = value === undefined ? valueStep(color) : value;
  const V = VALUES[step];
  const wantBase = only === undefined || only === "base";
  if (m.base.kind === "flat" && !m.texture) {   // the fill-up alone — no randomness, the phase untouched (the pattern strokes advance it as any stroke does)
    if (wantBase) {
      base(color);
      if (pattern) patternOn(sketch, points, pattern);   // over the fill, as it goes over a texture on the other materials
    }
    return;
  }
  sketch.phase += 5.55;
  const b = bounds(points);
  // **The texture's roll is the part's own.** The phase alone is the sketch's stroke count, and a part is the *first* thing painted on
  // nearly every layer — head, ears, muzzle, hat, body — so they all reached this line at 5.55 and scattered their scratches, dabs and
  // dust to the same numbers in the same places: one stamp repeated down a creature. The part's place and size on the board join it, so
  // two parts are two rolls. It stays geometry, never the rng, so the roll still decides the drawing and the boil's three frames still
  // differ only in the noise's jitter
  const ph = sketch.phase + b.cx * 31.7 + b.cy * 57.3 + b.r * 13.1;
  const noise = sketch.noise;
  const dark = isDark(color);
  // A tone of the part's color, in its own family. Deeper is shade; lighter is a **tint** — the same hue carried toward white — never
  // a multiply, which clips a saturated color into neon (a pop red × 1.6), and never a mix toward a neutral, which greys it out
  const tone = (factor) => (factor >= 1 ? tint(color, Math.min(0.6, (factor - 1) * 0.45)) : shade(color, factor));
  // contrast(f): the mark's tone. On a light ground the technique's own factor stands — graphite hatches darker, ink scratches lighter.
  // On a **dark** ground every mark goes lighter, by as much as the factor asked for either way: there is nothing below a dark ground to
  // draw with. Only the amount is mirrored, never the direction — mirroring the direction turned ink's light scratches (1.35) into marks
  // *darker* than the ground they were scratched into, and a dark cat's tail went black on black
  const contrast = (factor) => (dark ? tone(1 + Math.abs(1 - factor) * 1.6) : tone(factor));   // tone(), not shade(): a factor above 1 waters the colour, and a multiply clipped it to white
  // How much lightness this colour has left. Ink is the one technique whose marks go lighter on a light ground (its scratches take the
  // ink away), and a part already near white has nowhere to go: multiplied up there it clipped, and #ffffff lines ran across a cream
  // creature. A colour with no room is inked the other way round — the ink laid on **deeper** at the solid steps, the scratch opening
  // back toward the part's own colour. Either way every tone is the part's own, tinted or laid on thick
  const waters = dark || headroom(color) > 0.36;
  const f = m.texture;

  // **The ground is the part's colour at every step.** The step is an amount of the medium — how many rules, scratches, dabs, specks
  // and sweeps — and never a tone of the ground. It used to pull the ground toward the technique's own tone as well (graphite and
  // charcoal darkened it, ink and the wash paled it, oil painted it deeper — `pull` × how far the step went), so that the five steps
  // would survive the board's scale, where the fine marks fall under a device pixel; but with it a creature's palette colour darkened
  // as its density rose, and a skin at black was not the skin the palette named. The marks are drawn as they were — the lights, the
  // per-step widths and counts — over the colour itself
  const weight = f ? Math.max(0, Math.min(1, (V.v - 0.28) * 1.15)) : 0;   // black 0.83 · hatch 0.51 · scribble 0.39 · stipple 0.25 · light 0.07
  const ground = color;

  if (wantBase) {
    if (m.base.kind === "flat") base(m.base.tone === undefined ? ground : shade(ground, dark ? 0.92 : m.base.tone));
    else throw new Error(`goofy material ${name}: unknown base kind ${m.base.kind}`);
  }

  // The pattern goes on **over** the material: it is the creature's own mark, not part of the surface, and under a hatched or
  // dusted texture its stripes and spots were being buried. Drawn last so it reads as something on the animal
  if (!f || (only !== undefined && only !== "texture")) {
    if (pattern && wantBase) patternOn(sketch, points, pattern);
    return;
  }
  {
    // The skin tag for the texture's marks. A fill at **one t** — a bead, a tuft, a pom on a bent part — carries its texture with it, so every
    // mark takes that same t and turns with the bead. A strip's marks are left untagged and the skinned mesh reads them from their position
    // (inside a tube that is its own t anyway). Untagged means untagged: without setting it here a mark would inherit the tag of whatever
    // was drawn before it — the tail's dabs and dust all took the tip's t and flew off the tail when it bent
    const markTag = typeof skinT === "number" ? [skinT, skinT] : null;
    const holdTag = () => { sketch.skinT = markTag ? skinT : NaN; };
    const u = (k) => noise(ph * 0.29 + k * 2.17) * 0.5 + 0.5;   // a number in [0, 1] per k, from the drawing noise — smooth in k
    const h = (k) => hash01(Math.round(ph * 997) + k * 7919);   // a scattered one — neighbours unrelated
    // **The hand's angle on this part** — a rotation keyed from the part itself, and the one every set the texture lays down turns by.
    // The table's angle is the technique's, not the hand's: with it fixed, every part of every creature was ruled in exactly the same
    // direction and the board came out combed. A leg is not met from the side a back is. ±34° is wide enough to see and narrow enough
    // that graphite still reads as upright hatching. Off the part's roll, never the rng
    const swing = (u(9000) - 0.5) * 1.2;   // ±34°
    // **The light the ink opens with** — the ground watered toward the light ink, which is the tone ink drags its scratches in and
    // the tone graphite rules and oil dabs in too — in the ground's own hue, so a blue part's marks are blue. A **negative** amount is
    // the other way — the ground laid on deeper — which only oil's spread asks for: paint is opaque and some of it goes on darker
    // than what is under it
    // On a **dark** ground the light is damped: there the ground is deep and the same tint carries a mark far further up than it does
    // on a light one — graphite's rules came out bright grey on a near-black part, a stripe rather than a pencil line. The same reason
    // the ground's pull is halved on dark. The deeper side (oil's darkest paint) is not damped: there is room below either way
    const opened = (amount) => (amount >= 0 ? tint(ground, amount * (dark ? 0.55 : 1)) : deepen(ground, Math.min(0.55, -amount * 1.8)));
    // How much of the surface the marks cover — the step, as an amount. The marks stay as fine as the hand would draw them: marks coarse
    // enough to carry a value on their own were tried and dropped — they turn a small part into blotches, and a face into camouflage
    const cover = Math.max(0.06, weight * 0.62);   // black 0.51 · hatch 0.31 · scribble 0.24 · stipple 0.15 · light 0.06
    switch (f.kind) {
      case "hatch": {
        // Graphite, step by step: black — cross-hatching, two sets of rules, close and dark · hatch — one set · scribble — wavy
        // rules, nearly level · stipple — dots · light — one set three gaps apart, thin and pale. Every rule is pencil strokes with gaps, the hand lifting
        const tone = opened(f.mark);
        const liftedRule = (pts, i, width) => {   // the polyline drawn as a few pencil strokes with small gaps — the hand lifts and comes down again
          const lens = [0];
          for (let k = 1; k < pts.length; k += 1) lens.push(lens[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
          const total = lens[lens.length - 1];
          const at = (t) => {   // the point t along the polyline
            let k = 1;
            while (k < lens.length - 1 && lens[k] < t) k += 1;
            const seg = (t - lens[k - 1]) / Math.max(1e-9, lens[k] - lens[k - 1]);
            return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * seg, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * seg];
          };
          let t = 0;
          for (let k = 0; t < total && k < 40; k += 1) {
            const r = (n) => h(i * 131 + k * 7 + n);
            const end = f.lift ? Math.min(total, t + f.lift.length[0] + (f.lift.length[1] - f.lift.length[0]) * r(0)) : total;
            if (end - t > 0.012) {
              const run = [];
              for (let q = t; q < end; q += 0.008) run.push(at(q));
              run.push(at(end));
              const w = width * (0.8 + 0.4 * r(1));
              sketch.pencil(run, { color: tone, width: w, skinT: markTag });
              if (f.double && r(2) < f.double) sketch.pencil(run.map(([x, y]) => [x + 0.0025, y]), { color: tone, width: w * 0.8, skinT: markTag });
            }
            t = f.lift ? end + f.lift.gap[0] + (f.lift.gap[1] - f.lift.gap[0]) * r(4) : total;
          }
        };
        const hatchAt = (angle, gap, width) => rules(points, angle, gap, (i) => (u(i) - 0.5) * 0.5).forEach(([p, q], i) => liftedRule([p, q], i, width));
        if (V.name === "black") {
          hatchAt(f.angle + swing, f.gap * 0.75, f.width * 1.1);
          hatchAt(f.angle + swing - 0.95, f.gap * 0.8, f.width);
        } else if (V.name === "hatch") {
          hatchAt(f.angle + swing, f.gap, f.width);
        } else if (V.name === "scribble") {
          // wavy rules, nearly level — the pencil going side to side
          rules(points, 0.08 + swing * 0.5, f.gap * f.scribble.gap, (i) => (u(i) - 0.5) * 0.5).forEach(([p, q], i) => {
            const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
            const dx = (q[0] - p[0]) / len, dy = (q[1] - p[1]) / len;
            const n = Math.max(2, Math.round(len / 0.005));
            const pts = [];
            for (let k = 0; k <= n; k += 1) {
              const t = (k / n) * len;
              const wave = Math.sin((t / f.scribble.wave) * TAU + i * 1.7) * f.scribble.amp;
              pts.push([p[0] + dx * t - dy * wave, p[1] + dy * t + dx * wave]);
            }
            liftedRule(pts, i + 500, f.width);
          });
        } else if (V.name === "stipple") {
          dust(sketch, points, b, { per: 1500, size: [0.0018, 0.003] }, h, opened(f.mark * 0.85), holdTag);
        } else {
          // light — the pencil barely touches: one set of rules three gaps apart, thin and pale. Not a bare ground: half the
          // board's surfaces land on this step, and a material that lays nothing there is a material you cannot see
          hatchAt(f.angle + swing + 0.14, f.gap * 3.2, f.width * 0.6);
        }
        break;
      }
      case "scratch": {
        // Ink is solid and the scratches take it **away**, so the surface lightens as it is opened up: the darkest step is barely
        // scratched, the lightest scratched most. It used to run the other way — the black step laid the most light lines and came out
        // the palest of the five. A scratch stays a **line**: widened into a wedge, a few of them tile the surface into camouflage, so
        // here the step moves the count and the tone rather than the width
        const open = 1 - cover;   // black 0.17 · hatch 0.49 · scribble 0.61 · stipple 0.75 · light 0.93
        // The scratch is the colour **watered**; on a colour with no light left to water (`waters` above) a lighter tint of it, a
        // little more the more open the step. Never a white line: that is the ink's colour taken away, not paint
        const tone = waters ? contrast(f.tone * (0.9 + open * 0.3)) : tint(color, 0.12 + open * 0.2);   // an open step scratches lighter as well as more often
        const width = f.width * (0.6 + open * 0.5);
        for (let i = 0; i < Math.round(f.lines * open); i += 1) {
          const angle = u(i) * Math.PI;
          const o = (u(i + 50) - 0.5) * b.r * 1.4;
          const dx = Math.cos(angle), dy = Math.sin(angle);
          const a = [b.cx - dy * o - dx * b.r, b.cy + dx * o - dy * b.r];
          const c = [b.cx - dy * o + dx * b.r, b.cy + dx * o + dy * b.r];
          for (const piece of clipSegment(a, c, points)) sketch.pencil(piece, { color: tone, width: width * (0.7 + 0.6 * u(i + 300)), skinT: markTag });
        }
        if (V.name === "black") {   // the darkest ink is worked over once more — a faint band across, under the scratches
          const faint = contrast(1.12);
          for (const [p, q] of rules(points, 1.5 + swing, 0.055, (i) => (u(i + 900) - 0.5) * 0.4)) sketch.pencil([p, q], { color: faint, width: 0.009, skinT: markTag });
        }
        break;
      }
      case "dab": {
        // Thick paint: capsules scattered over the surface (their centres inside it), all along one diagonal give or take a little,
        // of one width and many lengths, in tones close to the ground, overlapping as they fall. An end the contour cuts stays flat
        // The spread is four **waterings of the ground** — the light ink scratches with, laid as a spread rather than one tone so paint
        // still varies stroke to stroke. They used to straddle the ground, two above it and two below, and the two below painted dark on
        // dark: half the strokes vanished into a dark part. The step moves the whole set — paint close to the ground at black, standing
        // well off it at light — so the value is in the paint's colour and not only in how much of it there is
        const shift = (0.72 - V.v) * 0.45;   // black −0.13 · hatch 0 · light +0.17
        // On a **dark** ground the whole spread drops: the ground there is itself a lifted one (contrast), so there is room below it,
        // and the lowest strokes fall back toward the part's own deep colour. Without the drop every dab came out lighter than what it
        // sat on and a dark part read as one bright weave — paint that only ever lightens is not paint
        const spread = dark ? -0.22 : 0;
        // And on a **light** ground the spread is pulled back in: there the ground is already pale and the top of the spread ran all the
        // way to a cream white, which is a bleach, not thinned paint. The palest stroke stops well short of it and stays the colour
        const reach = dark ? 1 : 0.68;
        const tones = f.washes.map((t) => hexToRgb(opened(Math.max(-0.4, Math.min(0.7, (t + shift + spread) * reach)))));
        const count = Math.round(f.per * (0.35 + weight * 1.0) * (b.x1 - b.x0) * (b.y1 - b.y0));   // black: the ground covered · light: strokes with room between
        const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;
        for (let i = 0; i < count; i += 1) {
          const cx = b.x0 + (b.x1 - b.x0) * h(i * 4);
          const cy = b.y0 + (b.y1 - b.y0) * h(i * 4 + 1);
          if (!insidePath([cx, cy], points)) continue;
          const len = f.length[0] + (f.length[1] - f.length[0]) * h(i * 4 + 2);
          // Two rotations: the part's (swing) turns the whole knife, and each stroke has its own on top — paint laid by hand does not
          // come off a comb. `spread` is how far the set leans as a set, `spreadEach` how far one stroke may go off it
          const ang = f.angle + swing + (h(i * 4 + 3) - 0.5) * f.spread + (h(i * 9 + 811) - 0.5) * f.spreadEach;
          const dx = Math.cos(ang), dy = Math.sin(ang);
          const a = [cx - (dx * len) / 2, cy - (dy * len) / 2];
          const c = [cx + (dx * len) / 2, cy + (dy * len) / 2];
          const rgb = tones[Math.floor(h(i + 50000) * tones.length) % tones.length];
          holdTag();
          for (const [p, q] of clipSegment(a, c, points)) capsule(sketch, p, q, f.width, rgb, near(p, a), near(q, c));
        }
        break;
      }
      case "speckle": {
        dust(sketch, points, b, { ...f, per: f.per * (0.4 + V.v * 0.8) }, h, contrast(f.tone), holdTag);   // black: thick dust · light: a few specks
        break;
      }
      case "wash": {
        // How a wash dries. The step is the pigment's strength: at black the wash is loaded — a firm dried edge, heavy granulation,
        // one bloom; at light it is mostly water — a faint edge, hardly any grain, and the blooms large and pale, the one thing there
        // is to see. The ground is the part's colour at every step
        // First the brush — broad sweeps across the part along the hand's swing, each a rounded stroke a shade off the ground
        // either way (on a dark ground only lighter: there is nothing below it to draw with), clipped by the contour. The tail of
        // each sweep dries out into bristle marks: thin broken lines running on past the stroke's end. Under everything else
        {
          const S = f.strokes;
          const n = Math.round((S.count[0] + (S.count[1] - S.count[0]) * h(200)) * (S.load[0] + weight * S.load[1]));
          for (let i = 0; i < n; i += 1) {
            const cx = b.x0 + (b.x1 - b.x0) * (0.2 + 0.6 * h(210 + i * 5));
            const cy = b.y0 + (b.y1 - b.y0) * (0.2 + 0.6 * h(211 + i * 5));
            if (!insidePath([cx, cy], points)) continue;
            const ang = swing + 0.5 + (h(212 + i * 5) - 0.5) * S.spread;
            const dx = Math.cos(ang), dy = Math.sin(ang);
            const len = b.r * (S.length[0] + (S.length[1] - S.length[0]) * h(213 + i * 5));
            const wid = b.r * (S.width[0] + (S.width[1] - S.width[0]) * h(214 + i * 5));
            // Every sweep a shade off the last, and the loaded steps leaning a touch deeper — overlaps are what the layers show by
            let amount = S.tone[0] + (S.tone[1] - S.tone[0]) * h(215 + i * 5) - weight * 0.012;
            if (dark) amount = Math.abs(amount);
            const strokeTone = opened(amount);
            // The stroke as a polygon — a rounded rectangle, its long sides wandering a little — filled only inside the contour
            const poly = [];
            const nx = -dy, ny = dx;
            const half = len / 2, hw = wid / 2;
            const wob = (t, k) => (noise(ph * 0.07 + t * 9 + i * 3.3 + k) * 0.5) * hw * 0.35;
            for (let k = 0; k <= 10; k += 1) { const t = -half + len * (k / 10); poly.push([cx + dx * t + nx * (hw + wob(t, 1)), cy + dy * t + ny * (hw + wob(t, 1))]); }
            for (let k = 1; k < 6; k += 1) { const a = Math.PI / 2 - Math.PI * (k / 6); poly.push([cx + dx * (half + Math.cos(a) * hw) + nx * Math.sin(a) * hw, cy + dy * (half + Math.cos(a) * hw) + ny * Math.sin(a) * hw]); }
            for (let k = 10; k >= 0; k -= 1) { const t = -half + len * (k / 10); poly.push([cx + dx * t - nx * (hw + wob(t, 2)), cy + dy * t - ny * (hw + wob(t, 2))]); }
            for (let k = 1; k < 6; k += 1) { const a = -Math.PI / 2 - Math.PI * (k / 6); poly.push([cx + dx * (-half + Math.cos(a) * hw) + nx * Math.sin(a) * hw, cy + dy * (-half + Math.cos(a) * hw) + ny * Math.sin(a) * hw]); }
            holdTag();
            fillClipped(sketch, poly, points, strokeTone);
            // The bristles — past the stroke's end, a few thin lines in the stroke's own tone, each a different length
            const rgb = hexToRgb(strokeTone);
            for (let k = 0; k < S.bristles; k += 1) {
              const off = (k / (S.bristles - 1) - 0.5) * wid * 0.8;
              const from = half - hw * 0.4, to = half + hw * (0.3 + 1.1 * h(216 + i * 5 + k * 11));
              const a = [cx + dx * from + nx * off, cy + dy * from + ny * off], c = [cx + dx * to + nx * off, cy + dy * to + ny * off];
              holdTag();
              for (const [p, q] of clipSegment(a, c, points)) capsule(sketch, p, q, Math.min(f.lineMax, 0.0026), rgb, false, true);
            }
          }
        }
        // The blooms — a backrun: water dropped into the damp wash. Nested lobes, each smaller and paler than the last, so the centre
        // fades out through a gradient with no edge of its own; the body is free to run past the contour and be cut by it. The pigment
        // the water pushed out gathers on one side: a soft deeper arc over part of the outer lobe, the side chosen by the part
        const count = Math.round(f.blooms[0] + (f.blooms[1] - f.blooms[0]) * h(1) * (1 - weight * 0.5));
        const rimRgb = hexToRgb(contrast(f.rim.tone));
        for (let i = 0; i < count; i += 1) {
          const cx = b.x0 + (b.x1 - b.x0) * (0.15 + 0.7 * h(20 + i));
          const cy = b.y0 + (b.y1 - b.y0) * (0.15 + 0.7 * h(30 + i));
          if (!insidePath([cx, cy], points)) continue;
          const r0 = b.r * (f.size[0] + (f.size[1] - f.size[0]) * h(10 + i)) * (0.8 + (1 - weight) * 0.4);
          const squash = f.squash[0] + (f.squash[1] - f.squash[0]) * h(40 + i);
          let outer = null;
          f.bloom.rings.forEach((ring, k) => {
            const r = r0 * Math.pow(f.bloom.shrink, k);
            // Each lobe drifts a little off the last — a bloom is not concentric, the water ran
            const lobe = blobPath(cx + (h(50 + i * 3 + k) - 0.5) * r0 * 0.25 * k, cy + (h(60 + i * 3 + k) - 0.5) * r0 * 0.25 * k, r, r * squash, { lumps: 5, amount: 0.22, noise, phase: ph * 0.01 + i * 7.3 + k * 2.1 });
            holdTag();
            fillClipped(sketch, lobe, points, opened(ring * (0.8 + (1 - weight) * 0.5)));
            if (k === 0) outer = lobe;
          });
          // The rim — one side of the outer lobe, `arc` of the way round, starting where the part says. A soft band, wide and
          // barely off the ground, no line in it: a backrun's edge is a blur of pigment, not a stroke
          const start = Math.floor(h(70 + i) * outer.length);
          const span = Math.round(outer.length * f.rim.arc);
          holdTag();
          for (let k = start; k < start + span; k += 1) {
            for (const [p, q] of clipSegment(outer[k % outer.length], outer[(k + 1) % outer.length], points)) capsule(sketch, p, q, Math.min(f.lineMax, f.rim.width), rimRgb, false, false);
          }
          // The whole bloom, once, with the pencil's broken — faint, and only the part of it that lies inside the contour: the
          // vertices inside are gathered into runs, each run one open line; a bloom wholly inside is one closed loop
          // A pencil line at `opacity` over the ground — deepened that share of the way on a light ground. On a dark one a pencil
          // line at that opacity all but vanishes, and the mirrored lift the other marks take made it the strongest line in the
          // part, so it is lifted about half the share only: there, but barely
          const sketchTone = dark ? tint(ground, f.sketch.opacity * 0.47) : deepen(ground, f.sketch.opacity);
          // `paper: ground` — the pencil sheds its bites in the paper's colour, and on a dark ground those bites, not the line,
          // were what showed. Over a fill the bites take the ground
          const inside = outer.map((pnt) => insidePath(pnt, points));
          // A run of the bloom's outline, drawn in dashes — the pencil coming down for a stroke's length and lifting, again and
          // again, so the line is in pieces rather than one loop
          const dashed = (run, seed) => {
            const lens = [0];
            for (let k = 1; k < run.length; k += 1) lens.push(lens[k - 1] + Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]));
            const total = lens[lens.length - 1];
            const at = (t) => {
              let k = 1;
              while (k < lens.length - 1 && lens[k] < t) k += 1;
              const seg = (t - lens[k - 1]) / Math.max(1e-9, lens[k] - lens[k - 1]);
              return [run[k - 1][0] + (run[k][0] - run[k - 1][0]) * seg, run[k - 1][1] + (run[k][1] - run[k - 1][1]) * seg];
            };
            let t = h(seed) * f.sketch.gap[1];   // the first dash starts a little in, so two blooms do not start alike
            for (let d = 0; t < total && d < 60; d += 1) {
              const end = Math.min(total, t + f.sketch.dash[0] + (f.sketch.dash[1] - f.sketch.dash[0]) * h(seed + d * 3 + 1));
              if (end - t > 0.008) {
                const piece = [];
                for (let q = t; q < end; q += 0.006) piece.push(at(q));
                piece.push(at(end));
                sketch.line(piece, { outline: f.sketch.kind, size: f.sketch.size, color: sketchTone, paper: ground, skinT: markTag });
              }
              t = end + f.sketch.gap[0] + (f.sketch.gap[1] - f.sketch.gap[0]) * h(seed + d * 3 + 2);
            }
          };
          if (inside.every(Boolean)) {
            dashed([...outer, outer[0]], 700 + i * 90);
          } else {
            // start a run just after an outside vertex so no run is split at index 0
            const first = inside.indexOf(false);
            let run = [];
            let r = 0;
            for (let k = 1; k <= outer.length; k += 1) {
              const idx = (first + k) % outer.length;
              if (inside[idx]) run.push(outer[idx]);
              if ((!inside[idx] || k === outer.length) && run.length > 2) { dashed(run, 700 + i * 90 + (r += 1) * 7); run = []; }
              else if (!inside[idx]) run = [];
            }
          }
        }
        // The edge — pigment walks to where the wash stops drying: a deeper line just inside the contour (the shape pulled toward its
        // centre by `inset`, so the line stays inside; the contour ink covers what little crosses), along a run of it and not all the
        // way round. Firmer the more pigment
        const inset = points.map(([x, y]) => [b.cx + (x - b.cx) * (1 - f.edge.inset), b.cy + (y - b.cy) * (1 - f.edge.inset)]);
        const runLen = Math.round(inset.length * (f.edge.run[0] + (f.edge.run[1] - f.edge.run[0]) * h(80)));
        const runStart = Math.floor(h(81) * inset.length);
        const run = [];
        for (let k = 0; k <= runLen; k += 1) run.push(inset[(runStart + k) % inset.length]);
        sketch.pencil(run, { color: contrast(1 - (1 - f.edge.tone) * (0.5 + weight * 0.7)), width: Math.min(f.lineMax, f.edge.width * (0.7 + weight * 0.6)), breathe: 0.5, paper: ground, skinT: markTag });
        // The glaze — a second wash over one side, wet on dry. A large lobe pushed off-centre to the side the part chooses, a little
        // deeper than the ground, its inner boundary a soft hard edge (the line stops where the contour cuts the lobe). Only once
        // there is pigment enough for a second coat to show
        if (weight >= f.glaze.from) {
          const ga = h(83) * TAU;
          const gr = b.r * f.glaze.size;
          const glaze = blobPath(b.cx + Math.cos(ga) * b.r * 0.55, b.cy + Math.sin(ga) * b.r * 0.55, gr, gr * (0.8 + 0.4 * h(84)), { lumps: 4, amount: 0.18, noise, phase: ph * 0.013 + 4.4 });
          holdTag();
          fillClipped(sketch, glaze, points, contrast(1 - (1 - f.glaze.tone) * (0.6 + weight * 0.6)));
          const glazeRgb = hexToRgb(contrast(f.glaze.edgeTone));
          for (let k = 0; k < glaze.length; k += 1) {
            for (const [p, q] of clipSegment(glaze[k], glaze[(k + 1) % glaze.length], points)) capsule(sketch, p, q, Math.min(f.lineMax, f.glaze.edgeWidth), glazeRgb, false, false);
          }
        }
        // The drip — a run of paint down from the bloom, tapering to a bead at the bottom. Sometimes, and only where the wash is
        // loaded enough to run. Straight down the world, whatever the part's swing: water does not care which way the hand went
        if (weight >= f.drip.from && h(85) < f.drip.chance && count > 0) {
          const sx = b.x0 + (b.x1 - b.x0) * (0.15 + 0.7 * h(20));
          const sy = b.y0 + (b.y1 - b.y0) * (0.15 + 0.7 * h(30));
          const len = b.r * (f.drip.length[0] + (f.drip.length[1] - f.drip.length[0]) * h(86));
          const dripRgb = hexToRgb(contrast(f.rim.tone));
          holdTag();
          const n = 6;
          for (let k = 0; k < n; k += 1) {   // a few pieces, each thinner than the last, so the run tapers
            const a = [sx + (h(87 + k) - 0.5) * 0.002, sy - (len * k) / n], c = [sx + (h(88 + k) - 0.5) * 0.002, sy - (len * (k + 1)) / n];
            for (const [p, q] of clipSegment(a, c, points)) capsule(sketch, p, q, Math.min(f.lineMax, f.drip.width) * (1 - k / (n + 1)), dripRgb, false, false);
          }
          const bead = blobPath(sx, sy - len - f.drip.width * 0.6, f.drip.width * 1.1, f.drip.width * 1.3, { lumps: 3, amount: 0.1, noise, phase: ph * 0.02 + 9.1 });
          fillClipped(sketch, bead, points, contrast(f.rim.tone), 0.0015);
        }
        // Dry brush — at the thin steps the brush skips the paper's tooth and leaves flecks of the ground's own light along one
        // band of the part, the way the hand dragged
        if (weight < f.sparkle.until) {
          const band = h(89) * TAU;
          const bx = Math.cos(band), by = Math.sin(band);
          const rgb = hexToRgb(opened(f.sparkle.tone));
          const along = Math.round(f.sparkle.per * 0.8 * (b.x1 - b.x0) * (b.y1 - b.y0) * 4);
          for (let i = 0; i < along; i += 1) {
            const t = (h(i * 2 + 130000) - 0.5) * 2 * b.r, w = (h(i * 2 + 130001) - 0.5) * b.r * 0.5;
            const pnt = [b.cx + bx * t - by * w, b.cy + by * t + bx * w];
            if (!insidePath(pnt, points)) continue;
            const l = f.sparkle.size[0] + (f.sparkle.size[1] - f.sparkle.size[0]) * h(i + 140000);
            holdTag();
            capsule(sketch, [pnt[0] - bx * l * 0.5, pnt[1] - by * l * 0.5], [pnt[0] + bx * l * 0.5, pnt[1] + by * l * 0.5], l * 0.55, rgb);
          }
        }
        // Granulation — heavy pigment settling into the paper's tooth
        dust(sketch, points, b, { per: f.grain.per * (0.12 + weight * 1.2), size: f.grain.size }, (k) => h(k + 90000), contrast(f.grain.tone), holdTag);
        break;
      }
      default:
        throw new Error(`goofy material ${name}: unknown texture kind ${f.kind}`);
    }
  }

  if (pattern && wantBase) patternOn(sketch, points, pattern);   // last of all — over the texture (see above)
}


// The base color's pattern — the creature's pattern (the `pattern` slot), drawn inside the shape and clipped to its contour:
// stripes (three lines across at the quarter heights) · dots (four beans) · hatch (diagonals over the middle) · spots (three
// dalmatian rings) · patch (hatching on the left). color is the pattern's ink (light on a dark part — the caller's rule)
export function patternOn(sketch, points, { kind, color }) {
  const b = bounds(points);
  const w = (b.x1 - b.x0) / 2, h = b.y1 - b.y0;
  const hatchLines = (cx, cy, rx, ry, angle, lines, width) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (let i = 0; i < lines; i += 1) {
      const t = lines === 1 ? 0 : (i / (lines - 1)) * 2 - 1;
      const half = Math.sqrt(Math.max(0, 1 - t * t));
      const u = t * ry;
      const a = [cx + (-half * rx) * cos - u * sin, cy + (-half * rx) * sin + u * cos];
      const c = [cx + half * rx * cos - u * sin, cy + half * rx * sin + u * cos];
      for (const piece of clipSegment(a, c, points)) sketch.pencil(piece, { color, width });
    }
  };
  if (kind === "stripes") {
    for (let i = 1; i <= 3; i += 1) {
      const y = b.y0 + (h * i) / 4;
      for (const piece of clipSegment([b.x0 - 0.02, y], [b.x1 + 0.02, y + 0.004], points)) sketch.pencil(piece, { color, width: 0.011 });
    }
  } else if (kind === "dots") {
    for (let i = 0; i < 4; i += 1) {
      const x = b.cx - w * 0.5 + (i % 2) * w;
      const y = b.y0 + h * (0.3 + Math.floor(i / 2) * 0.35);
      if (insidePath([x - 0.01, y], points) && insidePath([x + 0.01, y], points)) sketch.pencil([[x - 0.008, y], [x + 0.008, y]], { color, width: 0.012 });
    }
  } else if (kind === "hatch") {
    hatchLines(b.cx, b.cy, w * 0.8, h * 0.35, Math.PI * 0.25, 5, 0.007);
  } else if (kind === "spots") {
    for (let i = 0; i < 3; i += 1) {
      const sx = b.cx + (i - 1) * w * 0.5;
      const sy = b.y0 + h * (0.35 + (i % 2) * 0.3);
      let spot = blobPath(sx, sy, 0.025 + (i % 2) * 0.01, 0.02, { lumps: 4, amount: 0.25, noise: null });
      if (spot.some((p) => !insidePath(p, points))) spot = spot.map(([x, y]) => [sx + (x - sx) * 0.6, sy + (y - sy) * 0.6]);   // a spot on the edge shrinks in
      if (spot.every((p) => insidePath(p, points))) sketch.pencil(spot, { color, width: 0.008, closed: true });
    }
  } else if (kind === "patch") {
    hatchLines(b.cx - w * 0.35, b.cy, w * 0.4, h * 0.25, 0, 4, 0.008);
  } else throw new Error(`unknown pattern: ${kind}`);
}


// Dust inside a shape — specks of a fixed size at a density per unit area, hashed so they never string into curves
// Crumbs scattered over a surface — a grain of charcoal, a dab of the pencil's point: each one a **short stroke at its own angle**,
// round-ended. Squares were fine while a speck was under a pixel; the moment a value step is carried by area they have to be big
// enough to see, and a square that size reads as a pixel, not as charcoal.
// holdTag (optional) sets the sketch's skin tag before each crumb — a crumb sits at one point, so one tag is right for it
export function dust(sketch, points, b, { per, size }, h, color, holdTag = null) {
  const rgb = hexToRgb(color);
  const count = Math.round(per * (b.x1 - b.x0) * (b.y1 - b.y0) * 4);
  for (let i = 0; i < count; i += 1) {
    const p = [b.x0 + (b.x1 - b.x0) * h(i * 2), b.y0 + (b.y1 - b.y0) * h(i * 2 + 1)];
    if (!insidePath(p, points)) continue;
    const len = size[0] + (size[1] - size[0]) * h(i + 7000);
    const ang = h(i + 3100) * Math.PI;
    const dx = Math.cos(ang) * len * 0.5, dy = Math.sin(ang) * len * 0.5;
    if (holdTag) holdTag();
    capsule(sketch, [p[0] - dx, p[1] - dy], [p[0] + dx, p[1] + dy], len * 0.6, rgb);
  }
}


// A polygon filled only where it lies inside another — the wash's pools, whose bodies run past the part's contour and are cut
// by it. Scanlines across the polygon's bounds, each cut to the polygon and then to the clip, laid as flat strips a little wider
// than the step so they seal. A fan fill cannot be clipped; this is the one place a fill is not a fan
export function fillClipped(sketch, poly, clip, color, step = 0.004) {
  const rgb = hexToRgb(color);
  const b = bounds(poly);
  for (let y = b.y0 + step / 2; y < b.y1; y += step) {
    for (const [p, q] of clipSegment([b.x0 - 0.01, y], [b.x1 + 0.01, y], poly)) {
      for (const piece of clipSegment(p, q, clip)) capsule(sketch, piece[0], piece[1], step * 1.3, rgb, false, false);
    }
  }
}

// A capsule from p to q — a blunt paint stroke: a strip of one width with a round cap at each end that is a real end (an end cut
// by the contour stays flat). No taper, no wander — thick paint does not tremble
export function capsule(sketch, p, q, width, rgb, capP = true, capQ = true) {
  let dx = q[0] - p[0];
  let dy = q[1] - p[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const r = width / 2;
  const nx = -dy * r, ny = dx * r;
  sketch.triangle(p[0] + nx, p[1] + ny, p[0] - nx, p[1] - ny, q[0] + nx, q[1] + ny, rgb);
  sketch.triangle(p[0] - nx, p[1] - ny, q[0] - nx, q[1] - ny, q[0] + nx, q[1] + ny, rgb);
  const cap = (c, sx, sy) => {   // a half-disc fan from the normal round past the end
    const steps = 6;
    for (let i = 0; i < steps; i += 1) {
      const a0 = Math.PI * (i / steps), a1 = Math.PI * ((i + 1) / steps);
      // from +normal, round through the stroke's direction, to −normal
      const px = (t) => c[0] + nx * Math.cos(t) + sx * r * Math.sin(t);
      const py = (t) => c[1] + ny * Math.cos(t) + sy * r * Math.sin(t);
      sketch.triangle(c[0], c[1], px(a0), py(a0), px(a1), py(a1), rgb);
    }
  };
  if (capP) cap(p, -dx, -dy);
  if (capQ) cap(q, dx, dy);
}

