// Mouths — 20 kinds. Docs: guidelines/character/parts.md § mouth
// One drawing function per kind — the MOUTH table. A new mouth means adding a function here and putting the name in slots.js SLOTS.mouth.
// A function takes m (the context): { ink, fills, spec, box, x·y (the mouth centre), w (half-width), openH (the open height), ink0 (mouth ink — the face ink), edge (rims and lines over white teeth — palette ink, always dark) }
// Position, width and ink are decided by mouthPlacement — species (above the muzzle for dogs), mouthPos, mouthSize and per-individual jitter are all solved there at once.
// The kind table for state switching (rest, alt, angry, ^^) is faceStates.js.

import { blobPath, arcPath, crumple } from "../../shape.js";
import { paintPart } from "./body.js";
import { TAU, eyeGeometry } from "./layout.js";
import { eyeBottom, noseBottomY, muzzleGeometry } from "./face.js";
import { MARKS, blushOf } from "../vocabulary/palette.js";

// Mouth width multiplier — the mouthSize slot (a late slot). In the reference, very small mouths and very wide mouths split at the extremes
export const MOUTH_SIZE = { small: 0.7, normal: 1, wide: 1.4 };
// Species width multiplier — an imp mouth is wider than half the face (the reference)
const SPECIES_WIDTH = { imp: 1.3 };
const TOOTH = MARKS.white;   // tooth and grid fill — the same white as the eye whites
// tongue — the same pink as the blush, and the same ink as it on a ghost (palette.js blushOf)
const PINK = (m) => blushOf(m.spec);

// Mouth position, width and ink. Solved from species, slots and proportions at once
export function mouthPlacement(spec, box) {
  const eyes = eyeGeometry(spec, box);
  // Mouth position — under the nose (noseBottomY) and above the chin (headCy − 0.86·ry), placed by mouthPos: high 0.22 · mid 0.5 · low 0.76.
  // **And under the eyes**: when the nose sits above them — a high nose, or none — the eyes' lowest edge is the ceiling instead, or
  // the mouth lands in the gap between two big eyes and is drawn over both (eyeBottom, not eyeFloor: the gap has no eye at its x)
  const chin = box.headCy - box.headRy * 0.86;
  const floor = eyeBottom(spec, eyes);
  const top = Math.max(Math.min(noseBottomY(spec, box, eyes), floor) - 0.006, chin + 0.012);
  const tPos = spec.parts.mouthPos === "high" ? 0.22 : spec.parts.mouthPos === "low" ? 0.76 : 0.5;
  let y = Math.min(top + (chin - top) * tPos, floor - 0.03);
  // A dog's mouth sits **above the muzzle**, so its ink follows the muzzle's luminance too (black on a light muzzle, light ink on a black one) — separate from the face (head color) ink
  const ink0 = spec.species === "pup" ? muzzleGeometry(spec, box).ink : (spec.faceInk || spec.palette.ink);
  let w = box.headRx * 0.38 * (MOUTH_SIZE[spec.parts.mouthSize] || 1) * (SPECIES_WIDTH[spec.species] || 1);
  // The open mouth's height — proportional to the head, ending below the nose (swallow the nose and the nose disappears)
  const noseBottom = spec.species === "pup" || spec.parts.nose === "none" ? Infinity : top;
  const openH = Math.max(0.018, Math.min(0.05, box.headRy * 0.22, noseBottom - 0.008 - y));
  // Position jitter — a biped's mouth is sometimes slightly off to one side (the reference). ±0.1rx from the individual's wobbleSeed, no rng. On a quad it is centred under the nose
  let x = box.quad ? 0 : ((spec.proportions.wobbleSeed % 11) / 10 - 0.5) * 0.2 * box.headRx;
  if (spec.species === "pup") {
    // A dog's mouth is above the muzzle and below the nose — it follows the muzzle's dimensions, not the face proportion (mouthDrop). Overlapping the nose mass makes it invisible
    const m = muzzleGeometry(spec, box);
    y = m.my - box.headRy * 0.12;
    w = Math.min(w, m.rx * 0.72);
  }
  // Rims and lines over a white fill (the tooth grid, a grin, fangs) use **palette ink (dark)** — drawn in an imp's light face ink they are lost on the white and leave an empty white bar (which reads as a mistake)
  return { x, y, w, openH, ink0, edge: spec.palette.ink };
}

// -- shared by open mouths --
// The cavity is always **dark ink (palette ink)** and the rim is face ink — on a light face the rim matches the cavity and is lost; on a dark face a light rim holds the mouth's shape.
// Filling the cavity with light face ink leaves nothing but an empty bright blob on an imp's face (which reads as a mistake). Teeth are a white strip plus dark lines (edge)
function cavity(m, pts) {
  paintPart(m.fills, m.spec, pts, m.spec.palette.ink, { own: true });
  m.ink.line([...pts, pts[0]], { color: m.ink0 });
}
// A tooth strip — h tall, going up (dir −1: down from the upper lip) or down (dir +1). Vertical lines divide the teeth
function teethStrip(m, x0, x1, edgeY, h, dir, count) {
  const inner = edgeY + dir * h;
  paintPart(m.fills, m.spec, [[x0, edgeY], [x1, edgeY], [x1, inner], [x0, inner]], TOOTH, { own: true });
  m.ink.line([[x0, inner], [x1, inner]], { color: m.edge, size: "S" });
  for (let i = 1; i < count; i += 1) {
    const x = x0 + ((x1 - x0) * i) / count;
    m.ink.line([[x, edgeY], [x + 0.001, inner]], { color: m.edge, size: "S" });
  }
}
// The open mouth — not a round hole but **a bowl with a straight upper lip and a rounded bottom** (a D on its side). The cavity + an upper tooth strip + the upper lip line
function bowl(m, hw, depth, teeth = true) {
  const top = m.y + m.openH * 0.35, bottom = m.y - m.openH * depth;
  const pts = [];
  for (let i = 0; i <= 14; i += 1) {
    const t = (i / 14) * Math.PI;
    pts.push([m.x - hw * Math.cos(t), top - (top - bottom) * Math.sin(t)]);
  }
  cavity(m, pts);
  if (teeth) teethStrip(m, m.x - hw * 0.72, m.x + hw * 0.72, top, Math.max(0.008, Math.min(0.016, (top - bottom) * 0.35)), -1, 4);
  m.ink.line([[m.x - hw * 1.05, top + 0.003], [m.x + hw * 1.05, top]], { color: m.ink0 });   // the upper lip
  return { top, bottom };
}
// The tooth grid — vertical lines inside a wide, flat rounded rectangle (white fill plus outline). The reference's signature mouth (a growl, tension, an imp's open mouth)
function grid(m, hw, hh, bars) {
  const box = blobPath(m.x, m.y, hw, hh, { lumps: 3, amount: 0.04, noise: null, square: 2 });
  paintPart(m.fills, m.spec, box, TOOTH, { own: true });
  m.ink.contour(box, { color: m.edge });
  for (let i = 1; i <= bars; i += 1) {
    const x = m.x - hw + (2 * hw * i) / (bars + 1);
    m.ink.line([[x, m.y + hh * 0.9], [x + 0.001, m.y - hh * 0.9]], { color: m.edge, size: "S" });
  }
}
// Tongue — a pink mass hanging below the mouth plus a centre line
function tongueBlob(m, cx, top, rx, ry) {
  const t = blobPath(cx, top - ry, rx, ry, { lumps: 3, amount: 0.1, noise: null });
  paintPart(m.fills, m.spec, t, PINK(m), { own: true });
  m.ink.contour(t, { color: m.ink0, size: "S" });
  m.ink.line([[cx, top - ry * 0.3], [cx + 0.001, top - ry * 1.6]], { color: m.ink0, size: "S" });
}
// Two fangs — **big** white triangles (outlined) below the mouth line. Teeth have to read big
function fangs(m, hw, drop) {
  const half = Math.max(0.011, Math.min(0.016, drop * 0.4));
  for (const s of [-1, 1]) {
    const fx = m.x + s * hw * 0.55;
    const tri = crumple([[fx - half, m.y + 0.002], [fx + half, m.y + 0.002], [fx + s * 0.003, m.y - drop]], 0.0015, s * 4, 0.006);
    paintPart(m.fills, m.spec, tri, TOOTH, { own: true });
    m.ink.contour(tri, { color: m.edge, size: "S" });
  }
}

// Kind → drawing function. 1:1 with the names in slots.js SLOTS.mouth
export const MOUTH = {
  // Dot mouth — one dab, longer and thicker than the other marks so it reads as a mouth
  dot: (m) => m.ink.line([[m.x - 0.015, m.y], [m.x + 0.015, m.y]], { color: m.ink0 }),
  line: (m) => m.ink.line([[m.x - m.w, m.y], [m.x + m.w, m.y + 0.004]], { color: m.ink0 }),
  smile: (m) => m.ink.line(arcPath(m.x, m.y + 0.03, m.w, 0.045, Math.PI, TAU), { color: m.ink0 }),
  // Frowning mouth ⌢ — the opposite of a smile. Small
  frown: (m) => m.ink.line(arcPath(m.x, m.y - 0.026, m.w * 0.75, 0.036, 0, Math.PI), { color: m.ink0 }),
  wave: (m) => m.ink.line([[m.x - m.w, m.y], [m.x - m.w * 0.3, m.y + 0.03], [m.x + m.w * 0.3, m.y - 0.02], [m.x + m.w, m.y + 0.015]], { color: m.ink0 }),
  open: (m) => { bowl(m, m.w * 0.85, 0.95); },
  // Duck bill — a small startled o
  pout: (m) => m.ink.contour(blobPath(m.x, m.y, 0.022, 0.017, { lumps: 3, amount: 0.15, noise: null }), { color: m.ink0 }),
  // ω — the cat mouth (two arcs bulging downward)
  omega: (m) => {
    m.ink.line(arcPath(m.x - m.w * 0.35, m.y + 0.012, m.w * 0.38, 0.028, Math.PI, TAU), { color: m.ink0 });
    m.ink.line(arcPath(m.x + m.w * 0.35, m.y + 0.012, m.w * 0.38, 0.028, Math.PI, TAU), { color: m.ink0 });
  },
  // Smug mouth — **one stroke** whose middle rises and whose ends drop away (y = peak·cos πt). Two arcs side by side read as twin humps and make a different face.
  // Small and thick — it settles on the face like a dot while the drooping ends make the pout
  smug: (m) => {
    const hw = Math.max(0.016, m.w * 0.45), peak = 0.014;
    const pts = [];
    for (let i = 0; i <= 14; i += 1) {
      const t = i / 14;
      pts.push([m.x - hw + 2 * hw * t, m.y + peak * Math.cos(Math.PI * t)]);
    }
    m.ink.line(pts, { color: m.ink0 });
  },
  // 3 — a small pursed mouth (the kaomoji 3). Half an ω, thicker — cats and cute humans
  three: (m) => {
    const hw = Math.max(0.012, m.w * 0.22);
    m.ink.line(arcPath(m.x - hw * 0.9, m.y + 0.006, hw, 0.014, Math.PI, TAU), { color: m.ink0 });
    m.ink.line(arcPath(m.x + hw * 0.9, m.y + 0.006, hw, 0.014, Math.PI, TAU), { color: m.ink0 });
  },
  zigzag: (m) => {
    const zig = [];
    for (let i = 0; i <= 6; i += 1) zig.push([m.x - m.w + (2 * m.w * i) / 6, m.y + (i % 2 ? -0.016 : 0.012)]);
    m.ink.line(zig, { color: m.ink0 });
  },
  // Tooth grid — a wide grimace (reference human 6th, and imps). The number of grid lines is proportional to the width, the teeth big
  grimace: (m) => grid(m, m.w * 1.15, Math.max(0.014, Math.min(0.026, m.openH * 0.55)), Math.max(3, Math.min(6, Math.round(m.w * 1.15 / 0.022)))),
  // Grin — teeth inside a wide smiling arc (white fill plus two vertical lines) plus the upper line
  grin: (m) => {
    const hw = m.w * 1.05, top = m.y + 0.004, depth = Math.max(0.016, Math.min(0.03, m.openH * 0.7));
    const seg = [];
    for (let i = 0; i <= 12; i += 1) { const t = (i / 12) * Math.PI; seg.push([m.x - hw * Math.cos(t), top - depth * Math.sin(t)]); }
    paintPart(m.fills, m.spec, seg, TOOTH, { own: true });
    m.ink.line(seg, { color: m.edge });
    m.ink.line([[m.x - hw, top], [m.x + hw, top + 0.002]], { color: m.edge });
    for (const k of [-0.33, 0.33]) m.ink.line([[m.x + hw * k, top], [m.x + hw * k + 0.001, top - depth * 0.7]], { color: m.edge, size: "S" });
  },
  // Hatched mouth — covers the mouth position with a mass of horizontal hatching (reference human row 2, 4th, and imps). Reads as clenched teeth, or as a moustache
  scribble: (m) => m.ink.hatch(m.x, m.y, m.w * 0.9, Math.max(0.012, Math.min(0.02, m.openH * 0.45)), 0.08, { color: m.ink0, lines: 5 }),
  // Tongue — the tongue hangs below a slightly open mouth (a small bowl, no teeth). Dogs pant (the ^^ alt mouth), imps stick it out
  tongue: (m) => {
    const b = bowl(m, m.w * 0.7, 0.55, false);
    tongueBlob(m, m.x + m.w * 0.12, b.bottom + m.openH * 0.15, Math.max(0.012, m.w * 0.32), Math.max(0.014, m.openH * 0.6));
  },
  // Fangs — the mouth line plus two big white fangs below its ends (imps · a cat hissing)
  fangs: (m) => {
    m.ink.line([[m.x - m.w, m.y + 0.002], [m.x + m.w, m.y - 0.002]], { color: m.ink0 });
    fangs(m, m.w, Math.max(0.022, Math.min(0.04, m.openH * 0.9)));
  },
  // Square open □ — a shouting mouth (reference imp): **upper and lower tooth strips** inside a big angular cavity. The upper lip straight
  shout: (m) => {
    const hw = m.w * 0.8, top = m.y + m.openH * 0.4, bottom = m.y - m.openH * 1.1;
    const sq = blobPath(m.x, (top + bottom) / 2, hw, (top - bottom) / 2, { lumps: 3, amount: 0.05, noise: null, square: 2.2 });
    cavity(m, sq);
    const h = Math.max(0.01, Math.min(0.02, (top - bottom) * 0.3));
    teethStrip(m, m.x - hw * 0.85, m.x + hw * 0.85, top - 0.002, h, -1, 5);
    teethStrip(m, m.x - hw * 0.7, m.x + hw * 0.7, bottom + 0.002, h * 0.8, 1, 4);
    m.ink.line([[m.x - hw * 1.08, top + 0.003], [m.x + hw * 1.08, top]], { color: m.ink0 });
  },
  // Meow — a small filled vertical ellipse (a cat's open mouth)
  meow: (m) => paintPart(m.fills, m.spec, blobPath(m.x, m.y - 0.004, 0.013, Math.max(0.016, Math.min(0.024, m.openH * 0.55)), { lumps: 3, amount: 0.12, noise: null }), m.ink0, { own: true }),
  // Bracket mouth )-( — a short flat mouth with inward-bulging cheek-crease brackets. The Adventure Time "hmm…" (a closed mouth with the cheeks pressed in)
  bracket: (m) => {
    const hw = m.w * 0.55, bh = Math.max(0.012, Math.min(0.02, m.openH * 0.45));
    m.ink.line([[m.x - hw, m.y], [m.x + hw, m.y + 0.002]], { color: m.ink0 });
    for (const s of [-1, 1]) {
      // ) and ( — the bulge faces the mouth
      const cx = m.x + s * (hw + 0.012);
      m.ink.line(arcPath(cx, m.y, 0.009, bh, s > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, s > 0 ? Math.PI * 1.5 : Math.PI * 0.5, 8), { color: m.ink0 });
    }
  },
  // Peeking tongue, blep — just the tip of the tongue below an ω (cats)
  blep: (m) => {
    MOUTH.omega(m);
    const t = blobPath(m.x, m.y - 0.012, 0.011, 0.012, { lumps: 3, amount: 0.1, noise: null });
    paintPart(m.fills, m.spec, t, PINK(m), { own: true });
    m.ink.contour(t, { color: m.ink0, size: "S" });
  }
};

export function drawMouth(ink, fills, spec, box, kindOverride) {
  const kind = kindOverride || spec.parts.mouth;
  const draw = MOUTH[kind] || MOUTH.line;
  draw({ ink, fills, spec, box, ...mouthPlacement(spec, box) });
}
