// The medium page — draws how.html's legend live with the board's own code (stroke.js, mesh.js, the palette).
// Nothing here is an illustration OF the system; every figure runs THROUGH it, so the page cannot drift from the truth.
//
// One hidden WebGL renderer paints every figure's small 2D canvas (one context, many views — a page of
// per-figure contexts would hit the browser's context cap). Each figure is baked BOIL_FRAMES times like a
// creature layer, differing only in jitter phase. The figures hold still; INK BOIL cycles them at the board's own pace (rig.js boilFps).

import * as THREE from "three";
import { Sketch, blobPath, arcPath, MATERIALS, GOOFY_OUTLINES, GOOFY_FUR, VALUES } from "./stroke.js";
import { sketchMesh } from "./scene/mesh.js";
import { makeRng, makeNoise, seedFromString } from "./rng.js";
import { BOIL_FRAMES } from "./scene/rig.js";
import { runLoop, bindSeg } from "./ui.js";
import { PAPER, INKS, FILLS, POPS, DARKS } from "./character/index.js";
import { FURS, CALICO_MID, ACCENTS } from "./character/vocabulary/palette.js";

const TAU = Math.PI * 2;
const INK = INKS[0];
const BLUSH = "#d9968a";   // the blush/tongue pink (mouth.js PINK)
const CARD = "#f2ecdf";    // the figure card's back (styles.css .how figure) — the pencil's bites take it here, paper on the board

// The page draws the same picture on every load — one fixed noise, like a creature's wobbleSeed
const noise = makeNoise(makeRng(seedFromString("HOW")));

// ---------------------------------------------------------------- figures
// A figure: world [x0, y0, x1, y1] (left, bottom, right, top) and draw(sk), called once per boil variant.
// sk(wobble) hands out a Sketch whose jitter phase is already scattered by variant and figure —
// the draw functions only decide fills-before-ink order, exactly like a creature layer.
const FIGS = {};
function fig(name, world, draw) { FIGS[name] = { name, world, draw }; }

// Three columns, one drawing each — the comparison figures (widths, wobble, blob knobs)
const col = (i) => (i - 1) * 0.5;

fig("ribbon", [-0.8, -0.12, 0.8, 0.12], (sk) => {
  const ink = sk();
  [0.007, 0.012, 0.022].forEach((width, i) => {
    const x = col(i);
    ink.stroke([[x - 0.21, 0], [x - 0.07, 0.02], [x + 0.07, -0.015], [x + 0.21, 0.01]], { color: INK, width });
  });
});

fig("clipart", [-0.85, -0.1, 0.85, 0.1], (sk) => {
  const ink = sk();
  const wave = (x) => [[x - 0.3, 0], [x - 0.1, 0.035], [x + 0.1, -0.025], [x + 0.3, 0.01]];
  ink.stroke(wave(-0.42), { color: INK, width: 0.012, jitter: 0 });   // the noise alone turned off — clip art
  ink.stroke(wave(0.42), { color: INK, width: 0.012 });
});

fig("beans", [-0.5, -0.07, 0.5, 0.07], (sk) => {
  const ink = sk();
  for (let i = 0; i < 6; i += 1) {
    const x = -0.375 + i * 0.15;
    const half = i % 2 ? 0.005 : 0.015;                               // a freckle and a dot mouth
    ink.stroke([[x - half, 0], [x + half, 0]], { color: INK, width: i % 2 ? 0.012 : 0.017 });
  }
});

fig("hands", [-0.75, -0.2, 0.75, 0.2], (sk) => {
  [0.45, 1, 1.9].forEach((wobble, i) => {
    const s = sk(wobble);                                             // one sketch per column — its own hand
    const x = col(i);
    s.outline(blobPath(x, 0, 0.14, 0.12, { lumps: 5, amount: 0.08, noise, phase: 2 + i }), { color: INK, width: 0.011 });
    for (const side of [-1, 1]) s.stroke([[x + side * 0.05 - 0.012, 0.03], [x + side * 0.05 + 0.012, 0.03]], { color: INK, width: 0.016 });
    s.stroke(arcPath(x, -0.03, 0.05, 0.035, Math.PI, TAU), { color: INK, width: 0.011 });
  });
});

// The pencil — the reference's line next to ours (stroke.js PENCIL). Same widths as the ribbon figure, for the comparison
fig("pencil", [-0.8, -0.12, 0.8, 0.12], (sk) => {
  const ink = sk();
  [0.007, 0.012, 0.022].forEach((width, i) => {
    const x = col(i);
    ink.pencil([[x - 0.21, 0], [x - 0.07, 0.02], [x + 0.07, -0.015], [x + 0.21, 0.01]], { color: INK, width, paper: CARD });
  });
});

// The same face twice — contour and smile in our ribbon, then in the pencil. The eyes stay beans on both (the pencil is not for dots)
fig("twoLines", [-0.75, -0.2, 0.75, 0.2], (sk) => {
  const s = sk();
  [false, true].forEach((pen, i) => {
    const x = (i - 0.5) * 0.72;
    const head = blobPath(x, 0, 0.17, 0.15, { lumps: 5, amount: 0.08, noise, phase: 83 });
    const smile = arcPath(x, -0.035, 0.06, 0.04, Math.PI, TAU);
    if (pen) {
      s.pencil(head, { color: INK, width: 0.012, closed: true, paper: CARD });
      s.pencil(smile, { color: INK, width: 0.011, paper: CARD });
    } else {
      s.outline(head, { color: INK, width: 0.012 });
      s.stroke(smile, { color: INK, width: 0.011 });
    }
    for (const side of [-1, 1]) s.stroke([[x + side * 0.06 - 0.012, 0.035], [x + side * 0.06 + 0.012, 0.035]], { color: INK, width: 0.016 });
  });
});

fig("outline", [-0.75, -0.27, 0.75, 0.27], (sk) => {
  sk().outline(blobPath(0, 0, 0.42, 0.2, { lumps: 4, amount: 0.09, noise, phase: 7, square: 0.3 }), { color: INK, width: 0.012, passes: 2 });
});


fig("hair", [-0.45, -0.26, 0.45, 0.26], (sk) => {
  const ink = sk();
  ink.outline(blobPath(0, -0.06, 0.24, 0.18, { lumps: 5, amount: 0.07, noise, phase: 17 }), { color: INK, width: 0.01 });
  ink.fur(arcPath(0, 0.06, 0.16, 0.09, Math.PI * 0.15, Math.PI * 0.85, 12), "SCRIBBLE", { color: INK, width: 0.008, spread: 0.045 });
});

// The blobPath knobs — one knob per figure, three values each
function blobRow(sk, phase, make) {
  const fills = sk(), ink = sk();
  for (let i = 0; i < 3; i += 1) {
    const path = make(i, col(i), phase + i * 3);
    fills.fill(path, FILLS[1], [0.012, -0.01]);
    ink.outline(path, { color: INK, width: 0.011 });
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
  ink.stroke(arcPath(col(0), 0.02, 0.12, 0.08, Math.PI, TAU), { color: INK, width: 0.012 });         // smile
  ink.stroke(arcPath(col(1), -0.04, 0.1, 0.07, 0, Math.PI), { color: INK, width: 0.012 });           // frown
  ink.stroke(arcPath(col(2), 0.02, 0.1, 0.06, Math.PI * 1.1, Math.PI * 1.9, 10), { color: INK, width: 0.012 });   // a shut lid (rig.js LID_STYLE)
});

// Swatch strips — the palette groups, each color a small lumpy mass (a circle would break this page's own rules)
function swatches(name, list) {
  const n = list.length;
  fig(name, [-n * 0.11, -0.105, n * 0.11, 0.105], (sk) => {
    const fills = sk(), ink = sk();
    list.forEach((hex, i) => {
      const x = (i - (n - 1) / 2) * 0.22;
      const path = blobPath(x, 0, 0.075, 0.075, { lumps: 4, amount: 0.12, noise, phase: 53 + i * 2.6 });
      fills.fill(path, hex, [0.007, -0.006]);
      ink.outline(path, { color: INK, width: 0.006 });
    });
  });
  FIGS[name].labels = list;
}
swatches("paperink", [PAPER, ...INKS]);
swatches("fillsRow", FILLS);
swatches("pops", POPS);
swatches("darks", DARKS);
swatches("furs", [...FURS, CALICO_MID]);
swatches("accents", ACCENTS);

// A ball figure made from a table entry — the figures are created here, from the tables, so an entry cannot go unshown
function ballFigure(box, key, label, phase, draw) {
  const el = document.createElement("figure");
  el.dataset.fig = key;
  el.innerHTML = `<canvas></canvas><div class="subs"><span>${label}</span></div>`;
  box.appendChild(el);
  fig(key, [-0.33, -0.26, 0.33, 0.26], (sk) => draw(sk(), sk(), blobPath(0, 0, 0.2, 0.2, { lumps: 5, amount: 0.05, noise, phase })));
}
// The goofy outlines — one line per entry of GOOFY_OUTLINES, the way the reference's legend shows its kinds: the same gentle
// path drawn open with that outline, at the board's width. A line shows what a contour is made of better than a ball does
Object.keys(GOOFY_OUTLINES).forEach((name, i) => {
  const el = document.createElement("figure");
  el.dataset.fig = `outline:${name}`;
  el.innerHTML = `<canvas></canvas><div class="subs"><span>${name.toLowerCase()}</span></div>`;
  document.getElementById("outlineBalls").appendChild(el);
  fig(`outline:${name}`, [-0.7, -0.09, 0.7, 0.09], (sk) => {
    const ink = sk();
    ink.contour([[-0.58, -0.01], [-0.2, 0.03], [0.2, -0.025], [0.58, 0.015]], name, { color: INK, paper: CARD });
  });
});
// Fur balls — one per entry of GOOFY_FUR: the same FLAT ball, PENCIL contour, the fur grown along its crown as hair is
Object.keys(GOOFY_FUR).forEach((name, i) => ballFigure(document.getElementById("furBalls"), `fur:${name}`, name.toLowerCase(), 131 + i * 3, (fills, ink, ball) => {
  fills.paint(ball, "FLAT", { color: FILLS[2], offset: [0.012, -0.01] });
  ink.contour(ball, "PENCIL", { color: INK, closed: true, paper: CARD });
  ink.fur(arcPath(0, 0.02, 0.17, 0.17, Math.PI * 0.15, Math.PI * 0.85, 12), name, { color: INK });
}));
// Shader balls — one row per entry of MATERIALS, like a 3D material preview: the same ball in the same color at the five value
// steps (black · hatch · scribble · stipple · light), filled the material's way at each — the contour is the board's outline,
// PENCIL; a material is only the filling. FLAT has no texture, so one ball
Object.keys(MATERIALS).forEach((name, i) => {
  const m = MATERIALS[name];
  const steps = m.texture ? VALUES.map((_, k) => k) : [2];
  const el = document.createElement("figure");
  el.dataset.fig = `material:${name}`;
  if (m.texture) el.className = "wide";
  el.innerHTML = `<canvas></canvas><div class="subs">${steps.map((k) => `<span>${m.texture ? `${VALUES[k].name} · ${VALUES[k].v}` : name.toLowerCase()}</span>`).join("")}</div>`;
  document.getElementById("materialBalls").appendChild(el);
  const half = steps.length * 0.25;
  fig(`material:${name}`, [-half, -0.25, half, 0.25], (sk) => {
    const fills = sk(), ink = sk();
    steps.forEach((k, j) => {
      const x = (j - (steps.length - 1) / 2) * 0.5;
      const ball = blobPath(x, 0, 0.19, 0.19, { lumps: 5, amount: 0.05, noise, phase: 97 + i * 3 + j });
      fills.paint(ball, name, { color: FILLS[2], offset: [0.012, -0.01], value: k });
      ink.contour(ball, "PENCIL", { color: INK, closed: true, paper: CARD });
    });
  });
});

fig("boilface", [-0.9, -0.3, 0.9, 0.3], (sk) => {   // the demonstration of the boil — the one figure that never holds still (always, below)
  const fills = sk(), ink = sk();
  const head = blobPath(0, 0, 0.27, 0.24, { lumps: 5, amount: 0.07, noise, phase: 71, square: 0.4, taper: 0.08 });
  fills.fill(head, FILLS[2], [0.022, -0.018]);
  for (const side of [-1, 1]) fills.scribbleFill(side * 0.17, -0.05, 0.045, 0.028, { color: BLUSH, gap: 0.02, width: 0.006 });
  ink.outline(head, { color: INK, width: 0.012, passes: 2 });
  for (const side of [-1, 1]) ink.stroke([[side * 0.09 - 0.015, 0.05], [side * 0.09 + 0.015, 0.05]], { color: INK, width: 0.017 });
  ink.stroke(arcPath(0, -0.05, 0.06, 0.045, Math.PI, TAU), { color: INK, width: 0.011 });
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
  const frames = [];
  for (let k = 0; k < BOIL_FRAMES; k += 1) {
    const group = new THREE.Group();
    const sketches = [];
    const sk = (wobble = 1) => {
      const s = new Sketch(noise, wobble);
      s.phase = index * 131 + k * 997 + sketches.length * 17;   // the variant IS the phase — same drawing, different shiver
      sketches.push(s);
      return s;
    };
    entry.draw(sk);
    group.add(sketchMesh(sketches, 1, 0));
    group.visible = k === 0;
    scene.add(group);
    frames.push(group);
  }
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
    scene, frames, frame: 0,
    always: !!entry.always,
    aspect: (y1 - y0) / (x1 - x0),
    // The medium is tuned for the board's scale (about 230 px per world unit). Blown up much past it,
    // the ribbon shows its seams — the closed loop's taper pinch, the press fins — so a figure never
    // magnifies beyond 300 px per world unit; the canvas centres in its card instead of stretching
    maxW: Math.round(300 * (x1 - x0)),
    // The board's own cadence (rig.js) — staggered so the page never flips all at once
    boilFps: (8 + (index % 5) * 0.5) / 15,
    boilOffset: index % BOIL_FRAMES,
    width: 0
  });
});

const dpr = renderer.getPixelRatio();
function paint(f) {
  const w = Math.min(f.el.clientWidth - 24, f.maxW);   // 24 — the card's horizontal padding
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
