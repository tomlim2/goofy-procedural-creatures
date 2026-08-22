// Turns hand-drawn lines into three.js geometry.
//
// Drawing a line with Line gives no control over thickness (WebGL's linewidth is fixed at 1 nearly everywhere).
// So every stroke becomes a ribbon mesh. Vertices are pushed by noise, and the width is opened
// along the normal of the direction of travel. The width has to be uneven to read as a pen.

import * as THREE from "three";
// Vertex colors go through hexToRgb (linear space) — color.js. Never bypassed (guidelines/drawing.md § colors go in as linear)
import { hexToRgb, shade, isDark } from "./color.js";
import { PAPER } from "./character/vocabulary/palette.js";   // the pencil's bites take the paper color (palette.js imports nothing — no cycle)

const TAU = Math.PI * 2;

// Re-samples the stroke at an even spacing. Without this, the noise only bites on long segments.
function resample(points, step) {
  if (points.length < 2) return points.slice();
  const out = [points[0]];
  let carry = 0;

  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) continue;

    let travelled = carry;
    while (travelled + step <= length) {
      travelled += step;
      const t = travelled / length;
      out.push([ax + dx * t, ay + dy * t]);
    }
    carry = travelled - length;
  }

  out.push(points[points.length - 1]);
  return out;
}

// Pushed along the normal to make the hand shake.
// Low frequency (the whole thing bending) and high frequency (fine tremor) have to overlap to look like a human hand.
function perturb(points, noise, amount, phase) {
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    const [x, y] = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let nx = -(next[1] - prev[1]);
    let ny = next[0] - prev[0];
    const length = Math.hypot(nx, ny) || 1;
    nx /= length;
    ny /= length;

    const slow = noise(phase + i * 0.09);
    const fast = noise(phase * 1.7 + i * 0.62) * 0.35;
    const push = (slow + fast) * amount;
    out.push([x + nx * push, y + ny * push]);
  }
  return out;
}

// Continues a polyline past `to` in the direction from → to, one point per step, ending exactly `length` out. The pencil's overshoot
function extend(from, to, length, step) {
  let dx = to[0] - from[0];
  let dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const out = [];
  for (let d = step; d < length; d += step) out.push([to[0] + dx * d, to[1] + dy * d]);
  out.push([to[0] + dx * length, to[1] + dy * length]);
  return out;
}

// The pencil — a second line next to stroke(): the reference's line (reference/README.md § 3, kindergrimm § the pencil), taken without
// two of its parts — its 62% ink (our ink stays opaque, a deliberate exclusion) and its tremor (the sizzle; quiet here).
// The spine wanders on two sines per world length, the width breathes, the ends run past where they should stop instead of pinching
// to a point, and a thick line sheds: ink crumbs outside the edge, paper-coloured bites inside. Every number it uses is in this table
// and nowhere else. Docs: guidelines/drawing.md § the pencil. Drawn by the medium page (how.html); no creature draws with it yet
export const PENCIL = {
  step: 0.01,                          // re-sample spacing (world) — about 2.3 px at board scale; theirs max(2.2, w·.9) px
  wander: 0.0045,                      // the spine's wander amplitude (world), × the individual's wobble
  drift: { amp: 0.55, f: [5, 12] },    // the slow bend — its share of the wander, and rad per world unit (one or two cycles round a head)
  waver: { amp: 0.3, f: [20, 36] },    // the second bend
  breathe: [[0.38, 6], [0.14, 16]],    // the width breathing — [amplitude, rad per world unit], summed
  jr: [0.88, 1.14],                    // per-stroke width jitter
  over: [0.35, 1.1],                   // the overshoot past each end, in widths
  tip: 0.35,                           // the width left at the very end of an overshoot — a blunt lift, never a needle
  // The shed. Only a line at least minWidth wide (world) sheds. density: the share of re-sample points that drop a crumb (per stroke).
  // An ink crumb sits on the edge, its centre scatter × the half width out — never past the edge, so it frays the line instead of
  // floating loose beside it; a bite (the bite share of crumbs) is a paper-coloured square
  // inside, up to inside × the half width from the spine. A crumb's side is size (world) — fixed, not a share of the width:
  // graphite sheds the same grain whether the line is thin or thick, so a thick line does not shed boulders
  grit: { minWidth: 0.006, density: [0.2, 0.55], scatter: [0.8, 1.0], bite: 0.45, inside: 0.8, size: [0.0025, 0.0045] }
};

// Materials — what a surface is made of, the way a 3D material is: **how its area is filled**, as channels. `base` is the base
// color — the fill-up (flat) — always opaque (on the board the one in front has to hide the one behind), printed out of
// register, in the part's color or a tone of it — and it carries the creature's pattern (stripes, dots, spots, hatching: the `pattern`
// slot), drawn inside it and clipped to the contour, the way a pattern is part of an albedo. `texture` is the base color's texture —
// hatch, scratch, dab or speckle — the medium's pattern laid over it, clipped to the contour. Both paint the same thing, the color of the surface; a channel that would be a
// different thing (opacity — the reference's 62% graphite; grain — the paper showing through) is not built, and would be a new key,
// not a second texture. That is the material, and nothing else: the contour is a separate concept (GOOFY_OUTLINES, below). The
// color always comes from the part; every tone the texture adds is a shade of that color (lighter on a dark color, darker on a
// light one). A part names a material and hands over the path and the color — it never picks a technique itself. The medium page
// draws one shader ball per entry, and its channels under it. Docs: guidelines/drawing.md § materials.
// (Not the GPU materials — those live in scene/mesh.js.)
export const MATERIALS = {
  // Flat — the fill-up alone: the fan from the centre, printed out of register. What every creature is made of today
  FLAT:        { base: { kind: "flat" } },
  // Graphite — a near-paper ground hatched with the pencil: thin grey lines, nearly upright and a little slanted, each one drawn as
  // a few strokes — the pencil lifts and comes down again (lift: the strokes' lengths and the gaps between), now and then doubled
  GRAPHITE:    { base: { kind: "flat", tone: 1.22 }, texture: { kind: "hatch", angle: 1.42, gap: 0.0115, width: 0.0024, tone: 0.68, lift: { length: [0.07, 0.2], gap: [0.005, 0.014] }, double: 0.18 } },
  // Ink — solid, scratched: a few long light lines dragged across the dark
  INK:         { base: { kind: "flat" }, texture: { kind: "scratch", lines: 6, width: 0.005, tone: 1.35 } },
  // Oil — thick paint laid in blunt strokes: round-ended capsules of one width and many lengths, all along one diagonal, scattered
  // and overlapping, in four tones close to the ground (the reference's ball: calm, dense, a knife's work), cut flat by the contour
  OIL:         { base: { kind: "flat" }, texture: { kind: "dab", angle: 0.5, spread: 0.12, width: 0.026, length: [0.08, 0.26], per: 400, tones: [0.86, 0.94, 1.06, 1.16] } },
  // Charcoal — a ground dusted with dark specks
  CHARCOAL:    { base: { kind: "flat" }, texture: { kind: "speckle", per: 900, size: [0.0025, 0.0055], tone: 0.55 } }
};

// Density — how crowded a texture is, one knob over every kind: the hatch's spacing, the scratches' count, the dabs' and the
// specks' count per area all scale by it. The `density` slot picks one of these per creature (a light hand, a heavy one)
export const DENSITY = { light: 0.6, normal: 1, dense: 1.6 };

// Outlines — the goofy outline: what a creature's contour is drawn with. A separate concept from the materials (a contour
// is not a way of filling). A part names one and hands over the path and the color; at most a weight on the width.
// Docs: guidelines/drawing.md § the outline
export const GOOFY_OUTLINES = {
  // The ribbon — the board's original contour: stroke() laid twice, the two passes never quite agreeing
  RIBBON: { kind: "stroke", width: 0.012, passes: 2, jitter: 0.007 },
  // The pencil — pencil(): one seamless loop that wanders, breathes, runs past and sheds. What the board draws with today
  PENCIL: { kind: "pencil", width: 0.012, passes: 1 }
};

// The goofy fur — how hair and fur are grown along a path: the same path drawn over and over, each pass pushed outward from the
// root, every point waving. A part names a fur and hands over the path and the color; passes, width and spread ride as overrides
// (a style's volume), everything else is the fur's own. The medium page grows one fur ball per entry. Docs: guidelines/drawing.md § the goofy fur
export const GOOFY_FUR = {
  // The scribble — today's hair. root/reach: where the passes start and how far they fan, in spreads (−0.25 → 0.6, outward);
  // scatter: a pass's own push; wave: a point's own push; lean/waveLean: how much of each goes sideways
  SCRIBBLE: { passes: 14, width: 0.009, spread: 0.05, root: -0.25, reach: 0.85, scatter: 0.4, wave: 0.4, lean: 0.4, waveLean: 0.3, jitter: 0.012, step: 0.045 }
};

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

export class Sketch {
  // inkScale is the global multiplier for stroke thickness. Change the cell size and this is the only thing to touch.
  constructor(noise, wobble = 1, inkScale = 1.5) {
    this.noise = noise;
    this.wobble = wobble;
    this.inkScale = inkScale;
    this.positions = [];
    this.colors = [];
    this.phase = 0;
  }

  triangle(ax, ay, bx, by, cx, cy, rgb) {
    this.positions.push(ax, ay, 0, bx, by, 0, cx, cy, 0);
    for (let i = 0; i < 3; i += 1) this.colors.push(rgb[0], rgb[1], rgb[2]);
  }

  // One stroke. width is the maximum, and it thins toward the ends.
  stroke(points, { color = "#2b2724", width = 0.012, jitter = 0.006, passes = 1, step = 0.03 } = {}) {
    const rgb = hexToRgb(color);
    width *= this.inkScale;

    for (let pass = 0; pass < passes; pass += 1) {
      this.phase += 13.37;
      const sampled = resample(points, step);
      if (sampled.length < 2) continue;
      // A short stroke sampled only at its two ends (dots, freckles and vertical pupils shorter than step) goes to width 0 from the end taper and disappears.
      // One sample in the middle gives it its own width there — a short stroke stays as a small bean.
      if (sampled.length === 2) sampled.splice(1, 0, [(sampled[0][0] + sampled[1][0]) / 2, (sampled[0][1] + sampled[1][1]) / 2]);
      const path = perturb(sampled, this.noise, jitter * this.wobble, this.phase);
      // Thin at the ends, thick in the middle (taper). Pressure variation is laid on top with noise (press).
      const phase = this.phase;
      const noise = this.noise;
      const taper = (t) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.35);
      const press = (t, k) => 0.75 + 0.45 * noise(phase * 0.5 + t * 6 + k);
      const last = path.length - 1;

      for (let i = 1; i < path.length; i += 1) {
        const [ax, ay] = path[i - 1];
        const [bx, by] = path[i];
        let dx = bx - ax;
        let dy = by - ay;
        const length = Math.hypot(dx, dy) || 1;
        dx /= length;
        dy /= length;

        const t0 = (i - 1) / last;
        const t1 = i / last;
        const w0 = (width * taper(t0) * press(t0, 0)) / 2;
        const w1 = (width * taper(t1) * press(t1, 1)) / 2;

        const nx = -dy;
        const ny = dx;
        const a1 = [ax + nx * w0, ay + ny * w0];
        const a2 = [ax - nx * w0, ay - ny * w0];
        const b1 = [bx + nx * w1, by + ny * w1];
        const b2 = [bx - nx * w1, by - ny * w1];

        this.triangle(a1[0], a1[1], a2[0], a2[1], b1[0], b1[1], rgb);
        this.triangle(a2[0], a2[1], b2[0], b2[1], b1[0], b1[1], rgb);
      }
    }
  }

  // A closed stroke. Used for the head and body outlines.
  outline(points, options = {}) {
    this.stroke([...points, points[0]], options);
  }

  // The goofy outline — draws the contour with a named outline (GOOFY_OUTLINES). weight scales its width (a head's contour runs a
  // little heavier than a body's); closed draws a loop. An unknown name throws — a part that misspells it must not silently draw nothing
  contour(points, name, { color = "#2b2724", closed = false, weight = 1, paper } = {}) {
    const o = GOOFY_OUTLINES[name];
    if (!o) throw new Error(`unknown outline: ${name}`);
    const options = { color, width: o.width * weight, passes: o.passes };
    if (o.jitter !== undefined) options.jitter = o.jitter;
    if (paper) options.paper = paper;
    if (o.kind === "pencil") this.pencil(points, { ...options, closed });
    else if (closed) this.outline(points, options);
    else this.stroke(points, options);
  }

  // Fills with a named material — its base color (with the part's pattern, if any), then its texture, every mark clipped to the
  // contour. offset prints the base out of register (a creature's fillOffset). pattern: { kind, color } — the creature's pattern, part of
  // the base color. density scales the texture's crowding (DENSITY — the creature's density slot). only: "base" or "texture" draws
  // that channel alone (the medium page's channel chips). Every tone is a shade of the part's color — the material knows no colors of its own
  paint(points, name, { color, offset = [0, 0], only, pattern, density = 1 } = {}) {
    const m = MATERIALS[name];
    if (!m) throw new Error(`unknown material: ${name}`);
    const wantBase = only === undefined || only === "base";
    if (m.base.kind === "flat" && !m.texture) {   // the fill-up alone — no randomness, the phase untouched (the pattern strokes advance it as any stroke does)
      if (wantBase) {
        this.fill(points, color, offset);
        if (pattern) this.patternOn(points, pattern);
      }
      return;
    }
    this.phase += 5.55;
    const ph = this.phase;
    const noise = this.noise;
    const dark = isDark(color);
    const contrast = (factor) => shade(color, dark ? 1 + (1 - factor) * 1.6 : factor);   // a deeper tone on a light color, a lighter one on a dark color
    const b = bounds(points);

    if (wantBase) {
      const base = m.base;
      if (base.kind === "flat") this.fill(points, base.tone === undefined ? color : shade(color, dark ? 0.92 : base.tone), offset);
      else throw new Error(`material ${name}: unknown base kind ${base.kind}`);
      if (pattern) this.patternOn(points, pattern);
    }

    const f = m.texture;
    if (!f || (only !== undefined && only !== "texture")) return;
    {
      const u = (k) => noise(ph * 0.29 + k * 2.17) * 0.5 + 0.5;   // a number in [0, 1] per k, from the drawing noise — smooth in k
      const h = (k) => hash01(Math.round(ph * 997) + k * 7919);   // a scattered one — neighbours unrelated
      switch (f.kind) {
        case "hatch": {
          // Pencil hatching: each rule across the shape is drawn as a few pencil strokes with small gaps — the hand lifts and comes
          // down again — so no line runs the whole height in one go; now and then a stroke is doubled, a hair beside itself
          const tone = contrast(f.tone);
          rules(points, f.angle, f.gap / density, (i) => (u(i) - 0.5) * 0.5).forEach(([p, q], i) => {
            const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
            const dx = (q[0] - p[0]) / len, dy = (q[1] - p[1]) / len;
            const at = (t) => [p[0] + dx * t, p[1] + dy * t];
            let t = 0;
            for (let k = 0; t < len && k < 40; k += 1) {
              const r = (n) => h(i * 131 + k * 7 + n);
              const end = f.lift ? Math.min(len, t + f.lift.length[0] + (f.lift.length[1] - f.lift.length[0]) * r(0)) : len;
              if (end - t > 0.012) {
                const width = f.width * (0.8 + 0.4 * r(1));
                this.pencil([at(t), at(end)], { color: tone, width });
                if (f.double && r(2) < f.double) {   // the doubled stroke — the same run a hair to the side
                  const o = f.gap * 0.22 * (r(3) < 0.5 ? -1 : 1);
                  this.pencil([[p[0] + dx * t - dy * o, p[1] + dy * t + dx * o], [p[0] + dx * end - dy * o, p[1] + dy * end + dx * o]], { color: tone, width: width * 0.8 });
                }
              }
              t = f.lift ? end + f.lift.gap[0] + (f.lift.gap[1] - f.lift.gap[0]) * r(4) : len;
            }
          });
          break;
        }
        case "scratch": {
          const tone = contrast(f.tone);
          for (let i = 0; i < Math.round(f.lines * density); i += 1) {
            const angle = u(i) * Math.PI;
            const o = (u(i + 50) - 0.5) * b.r * 1.4;
            const dx = Math.cos(angle), dy = Math.sin(angle);
            const a = [b.cx - dy * o - dx * b.r, b.cy + dx * o - dy * b.r];
            const c = [b.cx - dy * o + dx * b.r, b.cy + dx * o + dy * b.r];
            for (const piece of clipSegment(a, c, points)) this.stroke(piece, { color: tone, width: f.width, jitter: 0.002, step: 0.03 });
          }
          break;
        }
        case "dab": {
          // Thick paint: capsules scattered over the surface (their centres inside it), all along one diagonal give or take a little,
          // of one width and many lengths, in tones close to the ground, overlapping as they fall. An end the contour cuts stays flat
          const tones = f.tones.map((t) => hexToRgb(shade(color, t)));
          const count = Math.round(f.per * density * (b.x1 - b.x0) * (b.y1 - b.y0));
          const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;
          for (let i = 0; i < count; i += 1) {
            const cx = b.x0 + (b.x1 - b.x0) * h(i * 4);
            const cy = b.y0 + (b.y1 - b.y0) * h(i * 4 + 1);
            if (!insidePath([cx, cy], points)) continue;
            const len = f.length[0] + (f.length[1] - f.length[0]) * h(i * 4 + 2);
            const ang = f.angle + (h(i * 4 + 3) - 0.5) * f.spread;
            const dx = Math.cos(ang), dy = Math.sin(ang);
            const a = [cx - (dx * len) / 2, cy - (dy * len) / 2];
            const c = [cx + (dx * len) / 2, cy + (dy * len) / 2];
            const rgb = tones[Math.floor(h(i + 50000) * tones.length) % tones.length];
            for (const [p, q] of clipSegment(a, c, points)) this.capsule(p, q, f.width, rgb, near(p, a), near(q, c));
          }
          break;
        }
        case "speckle": {
          this.dust(points, b, { ...f, per: f.per * density }, h, contrast(f.tone));
          break;
        }
        default:
          throw new Error(`material ${name}: unknown texture kind ${f.kind}`);
      }
    }
  }

  // A small axis-aligned square — the pencil's crumbs and bites
  square(cx, cy, size, rgb) {
    const h = size / 2;
    this.triangle(cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, rgb);
    this.triangle(cx - h, cy - h, cx + h, cy + h, cx - h, cy + h, rgb);
  }

  // The pencil — every number in PENCIL (above). closed draws a seamless loop: no overshoot, and the sines snapped to whole cycles
  // so the seam is continuous. paper is the color the bites take — pass the fill's color when the line runs over a fill.
  // Unlike stroke(), the quads share per-point normals, so the ribbon never cracks at a corner. Not for dots — the overshoot lengthens them
  pencil(points, { color = "#2b2724", width = 0.012, passes = 1, closed = false, paper = PAPER } = {}) {
    const P = PENCIL;
    const rgb = hexToRgb(color);
    const biteRgb = hexToRgb(paper);
    width *= this.inkScale;
    if (closed && points.length > 2) {
      const [ax, ay] = points[0];
      const [bx, by] = points[points.length - 1];
      if (Math.hypot(ax - bx, ay - by) < 1e-6) points = points.slice(0, -1);   // an already-closed list — the loop closes itself
    }
    if (points.length < 2) return;

    for (let pass = 0; pass < passes; pass += 1) {
      this.phase += 13.37;
      const ph = this.phase;
      const noise = this.noise;
      const r = (k) => noise(ph * 0.37 + k * 2.71) * 0.5 + 0.5;             // a per-stroke number in [0, 1], from the drawing noise
      const jr = (k, [a, b]) => a + (b - a) * r(k);
      const w = width * jr(1, P.jr);

      // The spine — re-sampled, and on an open line run past both ends along the end tangents
      let spine = resample(closed ? [...points, points[0]] : points, P.step);
      if (closed) spine.pop();
      if (spine.length === 2) spine.splice(1, 0, [(spine[0][0] + spine[1][0]) / 2, (spine[0][1] + spine[1][1]) / 2]);
      if (spine.length < 3) continue;
      let tail0 = 0;
      let tail1 = 0;
      if (!closed) {
        tail0 = w * jr(2, P.over);
        tail1 = w * jr(3, P.over);
        spine = [
          ...extend(spine[1], spine[0], tail0, P.step).reverse(),
          ...spine,
          ...extend(spine[spine.length - 2], spine[spine.length - 1], tail1, P.step)
        ];
      }
      const n = spine.length;
      const s = new Float64Array(n);                                           // arc length per sample
      for (let i = 1; i < n; i += 1) s[i] = s[i - 1] + Math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1]);
      const L = closed ? s[n - 1] + Math.hypot(spine[0][0] - spine[n - 1][0], spine[0][1] - spine[n - 1][1]) : s[n - 1];
      if (L < 1e-6) continue;
      const snap = (om) => (closed ? Math.max(1, Math.round((om * L) / TAU)) * (TAU / L) : om);
      const f1 = snap(jr(4, P.drift.f));
      const p1 = r(5) * TAU;
      const f2 = snap(jr(6, P.waver.f));
      const p2 = r(7) * TAU;
      const breathe = P.breathe.map(([amp, om], k) => [amp, snap(om), r(8 + k) * TAU]);
      const wander = P.wander * this.wobble;

      // Per-point normals (cyclic on a loop), shared by the quads on either side
      const normals = [];
      for (let i = 0; i < n; i += 1) {
        const a = spine[closed ? (i + n - 1) % n : Math.max(0, i - 1)];
        const b = spine[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
        let nx = -(b[1] - a[1]);
        let ny = b[0] - a[0];
        const len = Math.hypot(nx, ny) || 1;
        normals.push([nx / len, ny / len]);
      }
      // The spine wanders along its normals on two sines per length
      const path = spine.map(([x, y], i) => {
        const off = wander * (P.drift.amp * Math.sin(s[i] * f1 + p1) + P.waver.amp * Math.sin(s[i] * f2 + p2));
        return [x + normals[i][0] * off, y + normals[i][1] * off];
      });
      // The half width — breathing, and thinning only inside the overshoot tails
      const halves = [];
      for (let i = 0; i < n; i += 1) {
        let k = 1;
        for (const [amp, om, p] of breathe) k += amp * Math.sin(s[i] * om + p);
        let tip = 1;
        if (!closed && s[i] < tail0) tip = P.tip + (1 - P.tip) * (s[i] / tail0);
        else if (!closed && L - s[i] < tail1) tip = P.tip + (1 - P.tip) * ((L - s[i]) / tail1);
        halves.push((w / 2) * Math.max(0.08, k) * tip);
      }
      const quads = closed ? n : n - 1;
      for (let i = 0; i < quads; i += 1) {
        const j = (i + 1) % n;
        const [ax, ay] = path[i];
        const [bx, by] = path[j];
        const [nax, nay] = normals[i];
        const [nbx, nby] = normals[j];
        const ha = halves[i];
        const hb = halves[j];
        this.triangle(ax + nax * ha, ay + nay * ha, ax - nax * ha, ay - nay * ha, bx + nbx * hb, by + nby * hb, rgb);
        this.triangle(ax - nax * ha, ay - nay * ha, bx - nbx * hb, by - nby * hb, bx + nbx * hb, by + nby * hb, rgb);
      }

      // The shed — after the ribbon, so a bite covers ink and a crumb sits on the paper
      if (w < P.grit.minWidth) continue;
      const density = jr(10, P.grit.density);
      const G = P.grit;
      for (let i = 0; i < n; i += 1) {
        if (!closed && (s[i] < tail0 || L - s[i] < tail1)) continue;
        if (noise(ph * 0.11 + i * 1.93) * 0.5 + 0.5 > density) continue;
        const v = noise(ph * 0.23 + i * 3.17);                                 // [-1, 1] — which side, and how far
        const isBite = noise(ph * 0.31 + i * 5.39) * 0.5 + 0.5 < G.bite;
        const h = halves[i];
        const d = isBite ? v * G.inside * h : Math.sign(v || 1) * (G.scatter[0] + (G.scatter[1] - G.scatter[0]) * Math.abs(v)) * h;
        const size = G.size[0] + (G.size[1] - G.size[0]) * Math.abs(noise(ph * 0.17 + i * 7.13));
        this.square(path[i][0] + normals[i][0] * d, path[i][1] + normals[i][1] * d, size, isBite ? biteRgb : rgb);
      }
    }
  }

  // Area fill. Cut as a fan from the centre.
  // Every shape we use is visible from its centre, so this is enough.
  fill(points, color, offset = [0, 0]) {
    const rgb = hexToRgb(color);
    let cx = 0;
    let cy = 0;
    for (const [x, y] of points) {
      cx += x;
      cy += y;
    }
    cx /= points.length;
    cy /= points.length;

    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      this.triangle(
        cx + offset[0], cy + offset[1],
        a[0] + offset[0], a[1] + offset[1],
        b[0] + offset[0], b[1] + offset[1],
        rgb
      );
    }
  }

  // A capsule from p to q — a blunt paint stroke: a strip of one width with a round cap at each end that is a real end (an end cut
  // by the contour stays flat). No taper, no wander — thick paint does not tremble
  capsule(p, q, width, rgb, capP = true, capQ = true) {
    let dx = q[0] - p[0];
    let dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const r = width / 2;
    const nx = -dy * r, ny = dx * r;
    this.triangle(p[0] + nx, p[1] + ny, p[0] - nx, p[1] - ny, q[0] + nx, q[1] + ny, rgb);
    this.triangle(p[0] - nx, p[1] - ny, q[0] - nx, q[1] - ny, q[0] + nx, q[1] + ny, rgb);
    const cap = (c, sx, sy) => {   // a half-disc fan from the normal round past the end
      const steps = 6;
      for (let i = 0; i < steps; i += 1) {
        const a0 = Math.PI * (i / steps), a1 = Math.PI * ((i + 1) / steps);
        // from +normal, round through the stroke's direction, to −normal
        const px = (t) => c[0] + nx * Math.cos(t) + sx * r * Math.sin(t);
        const py = (t) => c[1] + ny * Math.cos(t) + sy * r * Math.sin(t);
        this.triangle(c[0], c[1], px(a0), py(a0), px(a1), py(a1), rgb);
      }
    };
    if (capP) cap(p, -dx, -dy);
    if (capQ) cap(q, dx, dy);
  }

  // Dust inside a shape — specks of a fixed size at a density per unit area, hashed so they never string into curves
  dust(points, b, { per, size, tone }, h, color) {
    const rgb = hexToRgb(color);
    const count = Math.round(per * (b.x1 - b.x0) * (b.y1 - b.y0) * 4);
    for (let i = 0; i < count; i += 1) {
      const p = [b.x0 + (b.x1 - b.x0) * h(i * 2), b.y0 + (b.y1 - b.y0) * h(i * 2 + 1)];
      if (!insidePath(p, points)) continue;
      this.square(p[0], p[1], size[0] + (size[1] - size[0]) * h(i + 7000), rgb);
    }
  }

  // The base color's pattern — the creature's pattern (the `pattern` slot), drawn inside the shape and clipped to its contour:
  // stripes (three lines across at the quarter heights) · dots (four beans) · hatch (diagonals over the middle) · spots (three
  // dalmatian rings) · patch (hatching on the left). color is the pattern's ink (light on a dark part — the caller's rule)
  patternOn(points, { kind, color }) {
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
        for (const piece of clipSegment(a, c, points)) this.stroke(piece, { color, width, jitter: 0.01, step: 0.05 });
      }
    };
    if (kind === "stripes") {
      for (let i = 1; i <= 3; i += 1) {
        const y = b.y0 + (h * i) / 4;
        for (const piece of clipSegment([b.x0 - 0.02, y], [b.x1 + 0.02, y + 0.004], points)) this.stroke(piece, { color, width: 0.011 });
      }
    } else if (kind === "dots") {
      for (let i = 0; i < 4; i += 1) {
        const x = b.cx - w * 0.5 + (i % 2) * w;
        const y = b.y0 + h * (0.3 + Math.floor(i / 2) * 0.35);
        if (insidePath([x - 0.01, y], points) && insidePath([x + 0.01, y], points)) this.stroke([[x - 0.008, y], [x + 0.008, y]], { color, width: 0.012 });
      }
    } else if (kind === "hatch") {
      hatchLines(b.cx, b.cy, w * 0.8, h * 0.35, Math.PI * 0.25, 5, 0.007);
    } else if (kind === "spots") {
      for (let i = 0; i < 3; i += 1) {
        const sx = b.cx + (i - 1) * w * 0.5;
        const sy = b.y0 + h * (0.35 + (i % 2) * 0.3);
        let spot = blobPath(sx, sy, 0.025 + (i % 2) * 0.01, 0.02, { lumps: 4, amount: 0.25, noise: null });
        if (spot.some((p) => !insidePath(p, points))) spot = spot.map(([x, y]) => [sx + (x - sx) * 0.6, sy + (y - sy) * 0.6]);   // a spot on the edge shrinks in
        if (spot.every((p) => insidePath(p, points))) this.outline(spot, { color, width: 0.008 });
      }
    } else if (kind === "patch") {
      hatchLines(b.cx - w * 0.35, b.cy, w * 0.4, h * 0.25, 0, 4, 0.008);
    } else throw new Error(`unknown pattern: ${kind}`);
  }

  // Grows a named fur (GOOFY_FUR) along the path. passes, width and spread may be overridden — a style's volume; the rest is the fur's
  fur(points, name, { color, passes, width, spread } = {}) {
    const f = GOOFY_FUR[name];
    if (!f) throw new Error(`unknown fur: ${name}`);
    const over = { color };
    if (passes !== undefined) over.passes = passes;
    if (width !== undefined) over.width = width;
    if (spread !== undefined) over.spread = spread;
    this.scribble(points, { ...f, ...over });
  }

  // The scribble — hair is not filled as an area but drawn back and forth with the pen (the reference's hair works this way).
  // The growth constants are GOOFY_FUR.SCRIBBLE's; fur() is the named way in
  scribble(points, { color = "#2b2724", passes = 14, width = 0.009, spread = 0.05, root = -0.25, reach = 0.85, scatter = 0.4, wave = 0.4, lean = 0.4, waveLean = 0.3, jitter = 0.012, step = 0.045 } = {}) {
    for (let i = 0; i < passes; i += 1) {
      this.phase += 7.77;
      const t = i / Math.max(1, passes - 1);
      // Narrows the spread on the inner side (toward the face). Hair reaches outward.
      const drift = (this.noise(this.phase * 0.3) * scatter + (t * reach + root)) * spread;
      const shifted = points.map(([x, y], index) => {
        const w = this.noise(this.phase * 0.2 + index * 0.4) * spread * wave;
        return [x + drift * lean + w * waveLean, y + drift + w];
      });
      this.stroke(shifted, { color, width, jitter, step });
    }
  }

  // Scribble fill. Covers the inside of an ellipse with one zigzag stroke going back and forth.
  // Unlike a flat fill, the stroke direction shows. This is what a pencil-shaded area really is.
  scribbleFill(cx, cy, rx, ry, { color, angle = 0, gap = 0.03, width = 0.007 } = {}) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const local = [];
    let dir = 1;
    for (let v = -ry + gap * 0.6; v < ry; v += gap) {
      const half = rx * Math.sqrt(Math.max(0, 1 - (v * v) / (ry * ry)));
      local.push([-half * dir, v], [half * dir, v]);
      dir = -dir;
    }
    if (local.length < 4) return;
    const world = local.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
    this.phase += 3.3;
    this.stroke(world, { color, width, jitter: 0.01, step: 0.05 });
  }

  // Hatched shading. Used for shadow on a cheek or forehead.
  hatch(cx, cy, rx, ry, angle, { color = "#3a3430", lines = 6, width = 0.006 } = {}) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let i = 0; i < lines; i += 1) {
      const t = lines === 1 ? 0 : (i / (lines - 1)) * 2 - 1;
      const half = Math.sqrt(Math.max(0, 1 - t * t));
      const u = t * ry;
      const ax = cx + (-half * rx) * cos - u * sin;
      const ay = cy + (-half * rx) * sin + u * cos;
      const bx = cx + half * rx * cos - u * sin;
      const by = cy + half * rx * sin + u * cos;
      this.stroke([[ax, ay], [bx, by]], { color, width, jitter: 0.01, step: 0.05 });
    }
  }

  build() {
    return buildGeometry([this]);
  }

  get empty() {
    return this.positions.length === 0;
  }
}

// Several sketches into one geometry. Earlier ones are drawn first and end up underneath — give it a fills sketch then an ink sketch and one layer comes out as one mesh.
// With no depthTest, vertex order is front-to-back, so the order within and between sketches is exactly the stacking order
export function buildGeometry(sketches) {
  const filled = sketches.filter((s) => !s.empty);
  const count = filled.reduce((n, s) => n + s.positions.length, 0);
  const positions = new Float32Array(count);
  const colors = new Float32Array(count);
  let offset = 0;
  for (const s of filled) {
    positions.set(s.positions, offset);
    colors.set(s.colors, offset);
    offset += s.positions.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// An irregular closed curve. The reference's head is not a circle but a lumpy mass.
//
// square: how much the superellipse exponent rises. 0 is an ellipse, around 1.5 a rounded square.
// taper: the top/bottom width ratio. Positive is wider at the bottom (a pear), negative wider at the top.
export function blobPath(cx, cy, rx, ry, { lumps = 5, amount = 0.08, noise, phase = 0, steps = 48, square = 0, taper = 0 } = {}) {
  const n = 2 + square;
  const points = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const c = Math.cos(angle);
    const sSin = Math.sin(angle);
    const ux = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const uy = Math.sign(sSin) * Math.pow(Math.abs(sSin), 2 / n);
    const widen = 1 - taper * uy;
    const lumpiness = noise ? noise(phase + c * lumps + sSin * lumps) : 0;
    const r = 1 + lumpiness * amount;
    points.push([cx + ux * rx * widen * r, cy + uy * ry * r]);
  }
  return points;
}

export function arcPath(cx, cy, rx, ry, from, to, steps = 16) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = from + ((to - from) * i) / steps;
    points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
  }
  return points;
}
