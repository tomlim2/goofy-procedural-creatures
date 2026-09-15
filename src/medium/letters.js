// The goofy letters — an uppercase alphabet, the digits and a few marks, drawn with the pencil the creatures are drawn with.
// Not a font file: every glyph is a list of strokes, the way a hand letters a sign, and each stroke goes down as one pencil line
// (stroke.js) — so a word wanders, sheds and boils like the drawing it sits on. The name screen's card writes with it (src/card.js).
//
// A glyph is drawn in cap heights: x from 0 to its width `w`, y from the baseline (0) to the cap (1), a tail or a comma below.
// **A corner is two strokes, never one bent line**: the pencil re-samples a line at a fixed step (PENCIL.step) and cuts every
// corner it walks round, and on a letter a few cap heights across a cut corner is a round A. Two strokes meeting keep the corner —
// and where the pen runs past a stroke's end it runs past the way a hand does. A curve is one stroke.
// Docs: guidelines/name.md § the letters

const deg = (d) => (d * Math.PI) / 180;

// An elliptical arc from angle a0 to a1 in degrees, anticlockwise from +x (a1 below a0 runs clockwise), as `n` segments
function arc(cx, cy, rx, ry, a0, a1, n = 12) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = deg(a0 + ((a1 - a0) * i) / n);
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
}

// A closed loop — an ellipse all the way round, starting at a0
const loop = (cx, cy, rx, ry, a0 = 90, n = 24) => ({ points: arc(cx, cy, rx, ry, a0, a0 + 360, n).slice(0, -1), closed: true });
// A dot — a small closed loop, filled: at a card's size a ring would read as an o
const dot = (cx, cy, r = 0.07) => ({ ...loop(cx, cy, r, r, 90, 8), fill: true });

// Five points of a star, outer radius r, inner ri, the first point up
function star(cx, cy, r, ri) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = deg(90 + i * 36);
    const k = i % 2 ? ri : r;
    return [cx + Math.cos(a) * k, cy + Math.sin(a) * k];
  });
}

// The heart the ♥ eye is (the classic sin³ curve), in a box w × h from the baseline
function heart(w, h, n = 28) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const x = Math.sin(t) ** 3;                                                               // -1 … 1
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);  // about -17 … 12
    return [w / 2 + (x * w) / 2, ((y + 17) / 29) * h];
  });
}

// A stroke is a point list (an open line) or { points, closed, fill } (a loop); a glyph's `fill` paints every loop it has (♥ ★), a loop's its own (a dot)
const G = {};
const glyph = (chars, w, strokes, fill = false) => { for (const ch of chars) G[ch] = { w, strokes, fill }; };

// -- the letters --
glyph("A", 0.66, [[[0, 0], [0.33, 1]], [[0.33, 1], [0.66, 0]], [[0.12, 0.36], [0.54, 0.36]]]);
glyph("B", 0.57, [[[0, 0], [0, 1]], [[0, 1], [0.3, 1], ...arc(0.3, 0.765, 0.235, 0.235, 90, -90, 10), [0, 0.53]], [[0, 0.53], [0.3, 0.53], ...arc(0.3, 0.265, 0.265, 0.265, 90, -90, 10), [0, 0]]]);
glyph("C", 0.64, [arc(0.32, 0.5, 0.32, 0.5, 45, 315, 18)]);
glyph("D", 0.62, [[[0, 0], [0, 1]], [[0, 1], [0.22, 1], ...arc(0.22, 0.5, 0.4, 0.5, 90, -90, 16), [0, 0]]]);
glyph("E", 0.52, [[[0, 0], [0, 1]], [[0, 1], [0.52, 1]], [[0, 0.52], [0.42, 0.52]], [[0, 0], [0.52, 0]]]);
glyph("F", 0.5, [[[0, 0], [0, 1]], [[0, 1], [0.5, 1]], [[0, 0.53], [0.4, 0.53]]]);
glyph("G", 0.66, [arc(0.33, 0.5, 0.33, 0.5, 50, 355, 18), [[0.66, 0.46], [0.38, 0.46]]]);
glyph("H", 0.58, [[[0, 0], [0, 1]], [[0.58, 0], [0.58, 1]], [[0, 0.52], [0.58, 0.52]]]);
glyph("I", 0, [[[0, 0], [0, 1]]]);
glyph("J", 0.48, [[[0.48, 1], [0.48, 0.28], ...arc(0.24, 0.28, 0.24, 0.28, 0, -180, 10).slice(1)]]);
glyph("K", 0.56, [[[0, 0], [0, 1]], [[0.56, 1], [0, 0.4]], [[0.2, 0.61], [0.58, 0]]]);
glyph("L", 0.5, [[[0, 1], [0, 0]], [[0, 0], [0.5, 0]]]);
glyph("M", 0.78, [[[0, 0], [0, 1]], [[0, 1], [0.39, 0.32]], [[0.39, 0.32], [0.78, 1]], [[0.78, 1], [0.78, 0]]]);
glyph("N", 0.62, [[[0, 0], [0, 1]], [[0, 1], [0.62, 0]], [[0.62, 0], [0.62, 1]]]);
glyph("O", 0.7, [loop(0.35, 0.5, 0.35, 0.5)]);
glyph("P", 0.56, [[[0, 0], [0, 1]], [[0, 1], [0.3, 1], ...arc(0.3, 0.74, 0.26, 0.26, 90, -90, 10), [0, 0.48]]]);
glyph("Q", 0.7, [loop(0.35, 0.5, 0.35, 0.5), [[0.42, 0.22], [0.74, -0.06]]]);
glyph("R", 0.58, [[[0, 0], [0, 1]], [[0, 1], [0.3, 1], ...arc(0.3, 0.74, 0.26, 0.26, 90, -90, 10), [0, 0.48]], [[0.26, 0.48], [0.6, 0]]]);
glyph("S", 0.56, [[...arc(0.28, 0.75, 0.26, 0.25, 15, 270, 12), ...arc(0.28, 0.25, 0.28, 0.25, 90, -165, 12).slice(1)]]);
glyph("T", 0.6, [[[0, 1], [0.6, 1]], [[0.3, 1], [0.3, 0]]]);
glyph("U", 0.6, [[[0, 1], ...arc(0.3, 0.3, 0.3, 0.3, 180, 360, 12), [0.6, 1]]]);
glyph("V", 0.62, [[[0, 1], [0.31, 0]], [[0.31, 0], [0.62, 1]]]);
glyph("W", 0.86, [[[0, 1], [0.2, 0]], [[0.2, 0], [0.43, 0.7]], [[0.43, 0.7], [0.66, 0]], [[0.66, 0], [0.86, 1]]]);
glyph("X", 0.6, [[[0, 1], [0.6, 0]], [[0.6, 1], [0, 0]]]);
glyph("Y", 0.6, [[[0, 1], [0.3, 0.5]], [[0.6, 1], [0.3, 0.5]], [[0.3, 0.5], [0.3, 0]]]);
glyph("Z", 0.58, [[[0, 1], [0.58, 1]], [[0.58, 1], [0, 0]], [[0, 0], [0.58, 0]]]);

// -- the digits --
glyph("0", 0.56, [loop(0.28, 0.5, 0.28, 0.5)]);
glyph("1", 0.42, [[[0.04, 0.8], [0.26, 1]], [[0.26, 1], [0.26, 0]], [[0.04, 0], [0.46, 0]]]);
glyph("2", 0.56, [[...arc(0.27, 0.72, 0.27, 0.28, 160, -20, 10), [0, 0]], [[0, 0], [0.56, 0]]]);
glyph("3", 0.52, [[...arc(0.25, 0.76, 0.25, 0.24, 150, -90, 10), ...arc(0.25, 0.26, 0.27, 0.26, 90, -155, 10).slice(1)]]);
glyph("4", 0.58, [[[0.44, 0], [0.44, 1]], [[0.44, 1], [0, 0.3]], [[0, 0.3], [0.58, 0.3]]]);
glyph("5", 0.54, [[[0.5, 1], [0.08, 1]], [[0.08, 1], [0.05, 0.56]], [[0.05, 0.56], ...arc(0.27, 0.33, 0.27, 0.33, 125, -150, 12).slice(1)]]);
glyph("6", 0.56, [arc(0.3, 0.5, 0.28, 0.5, 70, 200, 10), loop(0.28, 0.3, 0.28, 0.3, 170, 20)]);
glyph("7", 0.54, [[[0, 1], [0.54, 1]], [[0.54, 1], [0.2, 0]]]);
glyph("8", 0.54, [loop(0.27, 0.76, 0.23, 0.24, 270, 20), loop(0.27, 0.27, 0.27, 0.27, 90, 20)]);
glyph("9", 0.56, [loop(0.28, 0.7, 0.28, 0.3, 0, 20), [[0.56, 0.7], [0.5, 0.25], [0.34, 0]]]);

// -- the marks --
glyph(" ", 0.34, []);
glyph(".", 0.1, [dot(0.05, 0.05)]);
glyph(",", 0.12, [[[0.08, 0.08], [0.02, -0.14]]]);
glyph("'", 0.1, [[[0.05, 1], [0.03, 0.72]]]);
glyph("·", 0.18, [dot(0.09, 0.5, 0.09)]);
glyph("-", 0.4, [[[0.02, 0.46], [0.38, 0.46]]]);
glyph("_", 0.5, [[[0, -0.12], [0.5, -0.12]]]);
glyph("/", 0.42, [[[0, -0.04], [0.42, 1.04]]]);
glyph(":", 0.1, [dot(0.05, 0.62), dot(0.05, 0.08)]);
glyph("!", 0.1, [[[0.05, 1], [0.05, 0.3]], dot(0.05, 0.05)]);
glyph("?", 0.5, [[...arc(0.25, 0.74, 0.25, 0.26, 160, -60, 10), [0.25, 0.3]], dot(0.25, 0.05)]);
glyph("+", 0.5, [[[0.25, 0.2], [0.25, 0.72]], [[0, 0.46], [0.5, 0.46]]]);
glyph("(", 0.24, [arc(0.44, 0.48, 0.4, 0.62, 125, 235, 10)]);
glyph(")", 0.24, [arc(-0.2, 0.48, 0.4, 0.62, 55, -55, 10)]);
glyph("×", 0.5, [[[0.03, 0.1], [0.47, 0.66]], [[0.47, 0.1], [0.03, 0.66]]]);
glyph("♥", 0.74, [{ points: heart(0.74, 0.92), closed: true }], true);
glyph("★", 0.9, [{ points: star(0.45, 0.46, 0.48, 0.2), closed: true }], true);

export const GLYPHS = G;

// The space between two glyphs, in cap heights
export const LETTER_GAP = 0.22;
// A letter's pen — its width as a share of the cap height, by weight. The letters name their own ladder, as every outline kind
// does (medium/outlines.js): a line weight that is not on it is not drawn, and a word's pen grows with the word
export const LETTER_PENS = { S: 0.08, M: 0.11, L: 0.15 };

// A line of text laid out in cap heights: every character with a glyph stands alone, and the characters without one — Hangul,
// kana, an emoji, an accented letter — are gathered into runs the caller measures and writes in a font (`measure(text)` → its
// width in cap heights), so a syllable or an emoji sequence is never cut apart. → { items: [{ text, x, w, glyph }], width }
export function layOut(text, measure) {
  const items = [];
  let x = 0;
  let run = "";
  const place = (item) => {
    if (items.length) x += LETTER_GAP;
    items.push({ ...item, x });
    x += item.w;
  };
  const flush = () => {
    if (run) place({ text: run, w: measure(run), glyph: null });
    run = "";
  };
  for (const ch of text) {
    const g = G[ch];
    if (!g) {
      run += ch;
      continue;
    }
    flush();
    place({ text: ch, w: g.w, glyph: g });
  }
  flush();
  return { items, width: x };
}

// The letters' hand — the wobble a letter's sketch is made with: half the board's, so a word a few ink widths tall still reads
export const LETTER_HAND = 0.5;

// One glyph onto a sketch, its baseline's left end at world (x, y), `cap` world units tall, in the pencil at the weight's pen.
// `paper` is what the pencil's bites show through to (stroke.js — the board's paper unless said)
export function letterWith(sketch, glyph, x, y, cap, { color, pen = "M", paper }) {
  const width = (cap * LETTER_PENS[pen]) / sketch.inkScale;
  const at = ([gx, gy]) => [x + gx * cap, y + gy * cap];
  for (const stroke of glyph.strokes) {
    const loopStroke = !Array.isArray(stroke);
    const points = (loopStroke ? stroke.points : stroke).map(at);
    if (loopStroke && (glyph.fill || stroke.fill)) sketch.fill(points, color);
    sketch.pencil(points, { color, width, closed: loopStroke && stroke.closed, ...(paper ? { paper } : {}) });
  }
}

// A line of glyphs centred on world (cx, y) — its baseline at y, `cap` tall. Characters with no glyph are left out: this is for
// the pages that write only what the letters have (the medium page), not for a visitor's name (the card lays those out itself)
export function writeCentred(sketch, text, cx, y, cap, options) {
  const { items, width } = layOut(text, () => 0);
  const x0 = cx - (width * cap) / 2;
  for (const item of items) if (item.glyph) letterWith(sketch, item.glyph, x0 + item.x * cap, y, cap, options);
}
