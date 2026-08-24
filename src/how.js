// The medium page — draws how.html's legend live with the board's own code (stroke.js, mesh.js, the palette).
// Nothing here is an illustration OF the system; every figure runs THROUGH it, so the page cannot drift from the truth.
//
// One hidden WebGL renderer paints every figure's small 2D canvas (one context, many views — a page of
// per-figure contexts would hit the browser's context cap). Each figure is baked BOIL_FRAMES times like a
// creature layer, differing only in jitter phase. The figures hold still; INK BOIL cycles them at the board's own pace (rig.js boilFps).

import * as THREE from "three";
import { Sketch } from "./stroke.js";
import { blobPath, arcPath } from "./shape.js";
import { GOOFY_MATERIALS, VALUES } from "./medium/materials.js";
import { GOOFY_OUTLINES, BOARD_LINES, SIZE_NAMES } from "./medium/outlines.js";
import { GOOFY_FUR } from "./medium/fur.js";
import { sketchMesh } from "./scene/mesh.js";
import { makeRng, makeNoise } from "./rng.js";
import { BOIL_FRAMES } from "./scene/rig.js";
import { runLoop, bindSeg } from "./ui.js";
import { PAPER, INKS, FILLS, POPS, DARKS } from "./character/index.js";
import { FURS, ACCENTS, MARKS } from "./character/vocabulary/palette.js";

const TAU = Math.PI * 2;
const INK = INKS[0];
const BLUSH = MARKS.blush;   // the blush/tongue pink
const CARD = "#f2ecdf";    // the figure card's back (styles.css .how figure) — the pencil's bites take it here, paper on the board

// A different hand on every load — the page rolls its own noise the way a creature rolls its wobbleSeed, so a reload draws the
// same figures again in another hand. Nothing here is compared against anything, so nothing needs it pinned
const noise = makeNoise(makeRng((Math.random() * 0xffffffff) >>> 0));

// ---------------------------------------------------------------- figures
// A figure: world [x0, y0, x1, y1] (left, bottom, right, top) and draw(sk), called once per boil variant.
// sk(wobble) hands out a Sketch whose jitter phase is already scattered by variant and figure —
// the draw functions only decide fills-before-ink order, exactly like a creature layer.
const FIGS = {};
function fig(name, world, draw) { FIGS[name] = { name, world, draw }; }

// Three columns, one drawing each — the comparison figures (widths, wobble, blob knobs)
const col = (i) => (i - 1) * 0.5;

// **The sample line.** One shape for every figure that shows a line, so the figures can be read against each other: a sine, handed
// over smooth at 6 points per tenth of a unit — a shade denser than a head contour (blobPath lays 48 round one) and well under
// a mouth arc, so the row shows the density a part really hands over. Each pen then samples it at its own step. It runs deep,
// and every figure that takes it is given the height for it — the habits are read along the line's own edge, not off how tall
// the row is
const sine = (x0, x1, amp, cycles = 1.5) => {
  const n = Math.max(9, Math.round((x1 - x0) * 60));
  return Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, Math.sin((i / n) * TAU * cycles) * amp]);
};


// The hand — drawn with the pencil, which is what every line on the board is drawn with
fig("hands", [-0.75, -0.2, 0.75, 0.2], (sk) => {
  [0.45, 1, 1.9].forEach((wobble, i) => {
    const s = sk(wobble);                                             // one sketch per column — its own hand
    const x = col(i);
    s.pencil(blobPath(x, 0, 0.14, 0.12, { lumps: 5, amount: 0.08, noise, phase: 2 + i }), { color: INK, width: 0.011, closed: true, paper: CARD });
    for (const side of [-1, 1]) s.pencil([[x + side * 0.05 - 0.012, 0.03], [x + side * 0.05 + 0.012, 0.03]], { color: INK, width: 0.016, paper: CARD });   // shorter than 0.05 — the pencil keeps its ends and sheds nothing
    s.pencil(arcPath(x, -0.03, 0.05, 0.035, Math.PI, TAU), { color: INK, width: 0.011, paper: CARD });
  });
});


fig("hair", [-0.45, -0.26, 0.45, 0.26], (sk) => {
  const ink = sk();
  ink.pencil(blobPath(0, -0.06, 0.24, 0.18, { lumps: 5, amount: 0.07, noise, phase: 17 }), { color: INK, width: 0.01, closed: true, paper: CARD });
  ink.fur(arcPath(0, 0.06, 0.16, 0.09, Math.PI * 0.15, Math.PI * 0.85, 12), "SCRIBBLE", { color: INK, width: 0.008, spread: 0.045 });
});

// The blobPath knobs — one knob per figure, three values each
function blobRow(sk, phase, make) {
  const fills = sk(), ink = sk();
  for (let i = 0; i < 3; i += 1) {
    const path = make(i, col(i), phase + i * 3);
    fills.fill(path, FILLS[1]);
    ink.pencil(path, { color: INK, width: 0.011, closed: true, paper: FILLS[1] });
  }
}
fig("lumps", [-0.75, -0.19, 0.75, 0.19], (sk) => blobRow(sk, 23, (i, x, phase) =>
  blobPath(x, 0, 0.14, 0.13, { lumps: 5, amount: [0, 0.08, 0.2][i], noise: i ? noise : null, phase })));
fig("square", [-0.75, -0.19, 0.75, 0.19], (sk) => blobRow(sk, 31, (i, x, phase) =>
  blobPath(x, 0, 0.14, 0.13, { lumps: 5, amount: 0.06, noise, phase, square: [0, 0.9, 1.8][i] })));
fig("taper", [-0.75, -0.19, 0.75, 0.19], (sk) => blobRow(sk, 41, (i, x, phase) =>
  blobPath(x, 0, 0.14, 0.13, { lumps: 5, amount: 0.06, noise, phase, taper: [-0.35, 0, 0.35][i] })));

fig("arcs", [-0.75, -0.14, 0.75, 0.14], (sk) => {
  const ink = sk();
  ink.pencil(arcPath(col(0), 0.02, 0.12, 0.08, Math.PI, TAU), { color: INK, width: 0.012, paper: CARD });         // smile
  ink.pencil(arcPath(col(1), -0.04, 0.1, 0.07, 0, Math.PI), { color: INK, width: 0.012, paper: CARD });           // frown
  ink.pencil(arcPath(col(2), 0.02, 0.1, 0.06, Math.PI * 1.1, Math.PI * 1.9, 10), { color: INK, width: 0.012, paper: CARD });   // a shut lid (rig.js LID_STYLE)
});

// Swatch strips — the palette groups, each color a small lumpy mass (a circle would break this page's own rules)
function swatches(name, list) {
  const n = list.length;
  fig(name, [-n * 0.11, -0.105, n * 0.11, 0.105], (sk) => {
    const fills = sk(), ink = sk();
    list.forEach((hex, i) => {
      const x = (i - (n - 1) / 2) * 0.22;
      const path = blobPath(x, 0, 0.075, 0.075, { lumps: 4, amount: 0.12, noise, phase: 53 + i * 2.6 });
      fills.fill(path, hex);
      ink.pencil(path, { color: INK, width: 0.006, closed: true, paper: hex });
    });
  });
  FIGS[name].labels = list;
}
swatches("paperink", [PAPER, ...INKS]);
swatches("fillsRow", FILLS);
swatches("pops", POPS);
swatches("darks", DARKS);
swatches("furs", FURS);
swatches("accents", ACCENTS);
swatches("marks", Object.values(MARKS));

// A ball figure made from a table entry — the figures are created here, from the tables, so an entry cannot go unshown
function ballFigure(box, key, label, phase, draw) {
  const el = document.createElement("figure");
  el.dataset.fig = key;
  el.innerHTML = `<canvas></canvas><div class="subs"><span>${label}</span></div>`;
  box.appendChild(el);
  fig(key, [-0.33, -0.26, 0.33, 0.26], (sk) => draw(sk(), sk(), blobPath(0, 0, 0.2, 0.2, { lumps: 5, amount: 0.05, noise, phase })));
}
// The size the kinds' row draws at — read by the three figures below, set by the control under the row
// (how.html § the goofy outline). M is the board's own line
let kindSize = "M";
const KIND_FIGS = [];

// The goofy outlines — one line per entry of GOOFY_OUTLINES: the same gentle path drawn open with that kind, at
// whatever size the control is on. A line shows what a contour is made of better than a ball does
Object.keys(GOOFY_OUTLINES).forEach((name, i) => {
  const el = document.createElement("figure");
  el.dataset.fig = `outline:${name}`;
  el.className = "wide";   // one kind to a row, whatever the width: three in a two-column grid leaves the third alone
  el.innerHTML = `<canvas></canvas><div class="subs"><span>${name.toLowerCase()}</span></div>`;
  document.getElementById("outlineBalls").appendChild(el);
  fig(`outline:${name}`, [-0.7, -0.13, 0.7, 0.13], (sk) => {
    const ink = sk();
    // The kind and the size named outright — the one place either is. The kind's own ladder decides the width, so the
    // figure is the kind itself rather than a copy of it: the hold does not change with the size, only the width
    ink.line(sine(-0.58, 0.58, 0.075), { outline: name, color: INK, paper: CARD, size: kindSize });
  });
  // A row to itself, so it may fill it: 620 px per world unit against the page's 300 cap. The anatomy rows already
  // run near this and it is the same pen — the cap is there for the board's own scale, and these are one line each
  FIGS[`outline:${name}`].zoom = 620;
  KIND_FIGS.push(`outline:${name}`);
});
// The anatomy — each pen built up **one habit at a time**, a row per habit. The same path in every row; each row is the
// row above plus one habit. Drawn by the very
// pencil() and stroke() the board draws with, told which habits to leave out (stroke.js: the anatomy switch) — a row is
// not an illustration of the line, it is the line, short a habit. Docs: how.html § the goofy outline
const ANATOMY_PATH = sine(-0.58, 0.58, 0.058);
const DOT = POPS[2];   // the brick red of the palette — the handed points, so they never read as ink
const ANATOMY = {
  pencil: [
    ["the points", "what you hand it", null],
    ["the ribbon", "two rails, filled", {}],
    ["the wander", "the spine, on two sines", { wander: true }],
    ["the breath", "the width, on two more", { wander: true, breathe: true }],
    ["the flick", "past both ends, blunt", { wander: true, breathe: true, over: true }],
    ["the shed", "crumbs on the edge, bites inside", { wander: true, breathe: true, over: true, shed: true }],
    ["the ghost", "again underneath, thinner and faint", { wander: true, breathe: true, over: true, shed: true }, { passes: 2 }]
  ]
};
// The points row — the path as it is handed over: a dot at each point (a blob, like everything else here) on a hairline
function handedPoints(fills, ink) {
  ink.pencil(ANATOMY_PATH, { color: DOT, width: 0.0022, anatomy: {} });
  ANATOMY_PATH.forEach(([x, y], i) => fills.fill(blobPath(x, y, 0.0075, 0.0075, { lumps: 3, amount: 0.12, noise, phase: 211 + i }), DOT));
}
// The quads — what a stroke is actually made of. Each pair of samples becomes four corners (each sample pushed to both sides along
// its normal by the half width) and those four are cut into two triangles. Drawn as a wireframe: the pen lays the shape in a pale
// tone and every triangle edge is then **read back out of the triangles it just wrote** (a Sketch keeps them in positions: 9 floats
// a triangle) and drawn as a hairline. The lines are the geometry, not a picture of it. Magnified past the board's scale on
// purpose — at the board's scale a pencil's quad is 3 px long
function edgesOf(sketch, from, out, color) {
  const p = sketch.positions;
  const edge = (ax, ay, bx, by) => out.pencil([[ax, ay], [bx, by]], { color, width: 0.00045, anatomy: {} });
  for (let i = from; i + 9 <= p.length; i += 9) {
    edge(p[i], p[i + 1], p[i + 3], p[i + 4]);
    edge(p[i + 3], p[i + 4], p[i + 6], p[i + 7]);
    edge(p[i + 6], p[i + 7], p[i], p[i + 1]);
  }
}
// One period of a sine, handed over smooth (33 points): the pens part company wherever the line turns, and a line is what they
// draw. Each pen then samples it at its own step — the coarse one cuts the curve into chords, the fine one follows it
const CORNER = Array.from({ length: 49 }, (_, i) => [-0.12 + (i / 48) * 0.24, Math.sin((i / 48) * TAU * 1.5) * 0.028]);
const MESH = FILLS[2];   // the shape in a pale tone, so the edges on top of it are what you read
// Every habit off: the pen's quads and nothing else
fig("quads", [-0.135, -0.05, 0.135, 0.05], (sk) => {
  const shape = sk(), lines = sk();
  shape.pencil(CORNER, { color: MESH, width: 0.014, anatomy: {}, paper: CARD });
  edgesOf(shape, 0, lines, INK);
});
FIGS.quads.zoom = 2800;   // px per world unit — the seams are the subject here, so this one goes past the 300 the rest keep to

Object.entries(ANATOMY).forEach(([pen, rows]) => {
  const box = document.getElementById(`${pen}Anatomy`);
  rows.forEach(([name, sub, habits, extra], r) => {
    const key = `anatomy:${pen}:${r}`;
    const el = document.createElement("figure");
    el.dataset.fig = key;
    el.innerHTML = `<div class="who"><b>${name}</b><span>${sub}</span></div><div class="ln"><canvas></canvas></div>`;
    box.appendChild(el);
    fig(key, [-0.66, -0.088, 0.66, 0.088], (sk) => {
      const fills = sk(), ink = sk();
      if (!habits) return handedPoints(fills, ink);
      ink.pencil(ANATOMY_PATH, { color: INK, width: 0.015, anatomy: habits, paper: CARD, ...extra });
    });
  });
});

// Fur balls — one per entry of GOOFY_FUR: the same FLAT ball, the board's contour, the fur grown along its crown as hair is
Object.keys(GOOFY_FUR).forEach((name, i) => ballFigure(document.getElementById("furBalls"), `fur:${name}`, name.toLowerCase(), 131 + i * 3, (fills, ink, ball) => {
  fills.paint(ball, "FLAT", { color: FILLS[2] });
  ink.contour(ball, { color: INK, paper: CARD });   // the board's contour, whatever the switch says
  ink.fur(arcPath(0, 0.02, 0.17, 0.17, Math.PI * 0.15, Math.PI * 0.85, 12), name, { color: INK });
}));
// What the board draws each role with today — read live off the switch (BOARD_LINES), so the page cannot drift from the board.
// The same path drawn by each role's procedure: a contour closes it, a line runs it open — down to a dot. The counts in the captions are read off the code (how.html)
const USE_PATH = sine(-0.58, 0.58, 0.075);
const IN_USE = [
  { key: "use:contour", label: `contour → ${BOARD_LINES.contour} · S / M`, box: [-0.7, -0.14, 0.7, 0.14], draw: (ink) => ink.contour([[-0.5, -0.09], [0, -0.1], [0.5, -0.08], [0.52, 0.09], [0, 0.1], [-0.5, 0.08]], { color: INK, paper: CARD }) },
  { key: "use:line", label: `line → ${BOARD_LINES.line} · S / M / L · down to a dot`, box: [-0.7, -0.13, 0.7, 0.13], draw: (ink) => { ink.line(USE_PATH, { color: INK, paper: CARD }); for (const x of [-0.45, -0.15, 0.15, 0.45]) ink.line([[x - 0.012, -0.105], [x + 0.012, -0.103]], { color: INK, size: "S", paper: CARD }); } },
];
IN_USE.forEach(({ key, label, box, draw }) => {
  const el = document.createElement("figure");
  el.dataset.fig = key;
  el.innerHTML = `<canvas></canvas><div class="subs"><span>${label}</span></div>`;
  document.getElementById("outlineUse").appendChild(el);
  fig(key, box, (sk) => draw(sk()));
});

// Shader balls — one row per entry of GOOFY_MATERIALS, like a 3D material preview: the same ball in the same color at the five value
// steps (black · hatch · scribble · stipple · light), filled the goofy material's way at each — the contour is the board's outline,
// the board's contour; a goofy material is only the filling. FLAT has no texture, so one ball.
// A textured entry gets **the same five steps again underneath, on a dark ground**: a mark has to be lighter than what it is drawn
// on, so there every technique turns around and lays its marks light, and the step pulls the colour the other way (materials.js
// contrast, pull). One dark ball at the end of the row could only show it at one step; the scale is the point
const DARK_GROUND = DARKS[2];
Object.keys(GOOFY_MATERIALS).forEach((name, i) => {
  const m = GOOFY_MATERIALS[name];
  const steps = m.texture ? VALUES.map((_, k) => k) : [2];
  const grounds = m.texture ? [FILLS[2], DARK_GROUND] : [FILLS[2]];
  const el = document.createElement("figure");
  el.dataset.fig = `material:${name}`;
  if (m.texture) el.className = "wide";
  const label = (k) => (m.texture ? `${VALUES[k].name} · ${VALUES[k].v}` : name.toLowerCase());
  el.innerHTML = `<canvas></canvas><div class="subs">${steps.map((k) => `<span>${label(k)}</span>`).join("")}</div>`;
  document.getElementById("materialBalls").appendChild(el);
  const half = steps.length * 0.25;
  const rowY = (r) => (grounds.length === 1 ? 0 : (grounds.length - 1) / 2 * 0.5 - r * 0.5);
  fig(`material:${name}`, [-half, -0.25 * grounds.length, half, 0.25 * grounds.length], (sk) => {
    const fills = sk(), ink = sk();
    grounds.forEach((color, r) => {
      steps.forEach((k, j) => {
        const x = (j - (steps.length - 1) / 2) * 0.5;
        const ball = blobPath(x, rowY(r), 0.19, 0.19, { lumps: 5, amount: 0.05, noise, phase: 97 + i * 3 + j + r * 17 });
        fills.paint(ball, name, { color, value: k });
        ink.contour(ball, { color: INK, paper: CARD });   // the board's contour, whatever the switch says
      });
    });
  });
});

fig("boilface", [-0.9, -0.3, 0.9, 0.3], (sk) => {   // the demonstration of the boil — the one figure that never holds still (always, below)
  const fills = sk(), ink = sk();
  const head = blobPath(0, 0, 0.27, 0.24, { lumps: 5, amount: 0.07, noise, phase: 71, square: 0.4, taper: 0.08 });
  fills.fill(head, FILLS[2]);
  for (const side of [-1, 1]) fills.fill(blobPath(side * 0.17, -0.05, 0.04, 0.026, { lumps: 3, amount: 0.15, noise, phase: 5 + side }), BLUSH);   // the blush — a flat blob, as on the board
  ink.contour(head, { color: INK, paper: CARD });
  for (const side of [-1, 1]) ink.pencil([[side * 0.09 - 0.015, 0.05], [side * 0.09 + 0.015, 0.05]], { color: INK, width: 0.017, paper: CARD });
  ink.pencil(arcPath(0, -0.05, 0.06, 0.045, Math.PI, TAU), { color: INK, width: 0.011, paper: CARD });
});
FIGS.boilface.always = true;

// ---------------------------------------------------------------- machinery
const statusLabel = document.getElementById("status");
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

const figures = [];
document.querySelectorAll("figure[data-fig]").forEach((el, index) => {
  const entry = FIGS[el.dataset.fig];
  if (!entry) return;
  const [x0, y0, x1, y1] = entry.world;
  const scene = new THREE.Scene();
  if (entry.labels) {
    const subs = el.querySelector(".subs");
    for (const hex of entry.labels) {
      const span = document.createElement("span");
      span.textContent = hex;
      subs.appendChild(span);
    }
  }
  figures.push({
    el,
    canvas: el.querySelector("canvas"),
    subs: el.querySelector(".subs"),
    camera: new THREE.OrthographicCamera(x0, x1, y1, y0, -1, 1),
    entry, index, scene, frames: [], frame: 0, roll: 0,
    always: !!entry.always,
    aspect: (y1 - y0) / (x1 - x0),
    // The medium is tuned for the board's scale (about 230 px per world unit). Blown up much past it,
    // the ribbon shows its seams — the closed loop's taper pinch, the press fins — so a figure never
    // magnifies beyond 300 px per world unit; the canvas centres in its card instead of stretching
    maxW: Math.round((entry.zoom || 300) * (x1 - x0)),
    // The board's own cadence (rig.js) — staggered so the page never flips all at once
    boilFps: (8 + (index % 5) * 0.5) / 15,
    boilOffset: index % BOIL_FRAMES,
    width: 0
  });
});

// Bakes a figure's BOIL_FRAMES variants into its scene. Called again whenever a control changes what a figure draws
// (the kinds' size, AGAIN): the old groups are dropped and their geometries disposed — the materials are shared per
// opacity (scene/mesh.js) and are not ours to free. `roll` moves every phase at once, which is another hand
function bake(f) {
  for (const group of f.frames) {
    f.scene.remove(group);
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  f.frames = [];
  for (let k = 0; k < BOIL_FRAMES; k += 1) {
    const group = new THREE.Group();
    const sketches = [];
    const sk = (wobble = 1) => {
      const s = new Sketch(noise, wobble);
      s.phase = f.index * 131 + k * 997 + sketches.length * 17 + f.roll * 7919;   // the variant IS the phase — same drawing, different shiver
      sketches.push(s);
      return s;
    };
    f.entry.draw(sk);
    group.add(sketchMesh(sketches, 1, 0));
    group.visible = k === 0;
    f.scene.add(group);
    f.frames.push(group);
  }
  f.frame = 0;
}
for (const f of figures) bake(f);

const dpr = renderer.getPixelRatio();
function paint(f) {
  // 24 — the card's horizontal padding. An anatomy row holds its canvas in a column beside the label, so measure that column instead
  const holder = f.canvas.parentElement;
  const w = Math.min(holder === f.el ? holder.clientWidth - 24 : holder.clientWidth, f.maxW);
  if (w <= 0) return;
  const h = Math.max(36, Math.round(w * f.aspect));
  if (w !== f.width) {
    f.width = w;
    f.canvas.style.width = `${w}px`;
    f.canvas.style.height = `${h}px`;
    f.canvas.width = Math.round(w * dpr);
    f.canvas.height = Math.round(h * dpr);
    if (f.subs) f.subs.style.maxWidth = `${w}px`;
  }
  renderer.setSize(w, h, false);
  renderer.render(f.scene, f.camera);
  const ctx = f.canvas.getContext("2d");
  ctx.clearRect(0, 0, f.canvas.width, f.canvas.height);
  ctx.drawImage(renderer.domElement, 0, 0, f.canvas.width, f.canvas.height);
}

for (const f of figures) paint(f);
window.addEventListener("resize", () => { for (const f of figures) { f.width = 0; paint(f); } });
statusLabel.textContent = `${figures.length} FIGURES`;

// The kinds' row — the size the three draw at, and AGAIN for another hand. Both bake just those three again:
// a size is a different drawing, not a different camera, so it cannot be done by repainting
const kindFigures = figures.filter((f) => KIND_FIGS.includes(f.el.dataset.fig));
function redrawKinds() { for (const f of kindFigures) { bake(f); paint(f); } }
bindSeg(document.getElementById("sizeSeg"), "size", (value) => { kindSize = value; redrawKinds(); });
document.getElementById("again").addEventListener("click", () => {
  for (const f of kindFigures) f.roll += 1;
  redrawKinds();
});

// Ink — the board's own axis (rig.md § pose and ink): STILL pins boil frame 0, BOIL cycles. Still by default —
// a legend is read, not watched — except the boil's own figure, which is the demonstration and always cycles
let boil = false;
function setFrame(f, frame) {
  if (frame === f.frame) return;
  f.frame = frame;
  f.frames.forEach((group, k) => { group.visible = k === frame; });
  paint(f);
}
const ink = bindSeg(document.getElementById("inkSeg"), "ink", (value) => {
  boil = value === "boil";
  if (!boil) for (const f of figures) if (!f.always) setFrame(f, 0);
});
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "i") ink.set(boil ? "still" : "boil");
});

runLoop((t) => {
  for (const f of figures) {
    if (!boil && !f.always) continue;
    const frame = Math.floor(t * f.boilFps + f.boilOffset) % BOIL_FRAMES;
    setFrame(f, frame);
  }
}, () => { statusLabel.textContent = "ERROR"; });
