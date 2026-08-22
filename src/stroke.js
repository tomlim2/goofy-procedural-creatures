// Turns hand-drawn lines into three.js geometry.
//
// Drawing a line with Line gives no control over thickness (WebGL's linewidth is fixed at 1 nearly everywhere).
// So every stroke becomes a ribbon mesh. Vertices are pushed by noise, and the width is opened
// along the normal of the direction of travel. The width has to be uneven to read as a pen.

import * as THREE from "three";
// Vertex colors go through hexToRgb (linear space) — color.js. Never bypassed (guidelines/drawing.md § colors go in as linear)
import { hexToRgb } from "./color.js";
import { PAPER } from "./character/vocabulary/palette.js";   // the pencil's bites take the paper color (palette.js imports nothing — no cycle)
// The three concepts a sketch draws by name. They take the sketch in; they never import this file
import { contourWith, lineWith, markWith } from "./medium/outlines.js";
import { paintWith } from "./medium/materials.js";
import { furWith } from "./medium/fur.js";

const TAU = Math.PI * 2;

// Re-samples the stroke at an even spacing. Without this, the noise only bites on long segments.
export function resample(points, step) {
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

  // One stroke. width is the maximum, and it thins toward the ends — except at a joint: joint = [start, end] marks an end that meets
  // another line or a fill's edge (the tail's root, its side lines meeting the tip's arc), and that end keeps its width
  stroke(points, { color = "#2b2724", width = 0.012, jitter = 0.006, passes = 1, step = 0.03, joint = null } = {}) {
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
      const ramp = (u) => Math.pow(Math.sin((Math.PI / 2) * Math.min(1, Math.max(0, u))), 0.35);
      const taper = joint
        ? (t) => (joint[0] ? 1 : ramp(t * 2)) * (joint[1] ? 1 : ramp((1 - t) * 2))
        : (t) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.35);
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

  // The goofy outline (medium/outlines.js) — the closed line of a shape, an open line, a mark. What each is drawn with is the board's switch (BOARD_LINES)
  contour(points, options) { return contourWith(this, points, options); }
  line(points, options) { return lineWith(this, points, options); }
  mark(points, options) { return markWith(this, points, options); }

  // The goofy material (medium/materials.js) — how an area is filled, by name
  paint(points, name, options) { return paintWith(this, points, name, options); }

  // The goofy fur (medium/fur.js) — how hair is grown along a path, by name
  fur(points, name, options) { return furWith(this, points, name, options); }

  // A small axis-aligned square — the pencil's crumbs and bites
  square(cx, cy, size, rgb) {
    const h = size / 2;
    this.triangle(cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, rgb);
    this.triangle(cx - h, cy - h, cx + h, cy + h, cx - h, cy + h, rgb);
  }

  // The pencil — every number in PENCIL (above). closed draws a seamless loop: no overshoot, and the sines snapped to whole cycles
  // so the seam is continuous. paper is the color the bites take — pass the fill's color when the line runs over a fill.
  // Unlike stroke(), the quads share per-point normals, so the ribbon never cracks at a corner. Not for dots — the overshoot lengthens them.
  // joint = [start, end]: an end that meets another line or a fill's edge (the tail's root, the tip's arc) gets no overshoot and no thinning
  pencil(points, { color = "#2b2724", width = 0.012, passes = 1, closed = false, paper = PAPER, joint = null } = {}) {
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
        tail0 = joint && joint[0] ? 0 : w * jr(2, P.over);
        tail1 = joint && joint[1] ? 0 : w * jr(3, P.over);
        spine = [
          ...(tail0 > 0 ? extend(spine[1], spine[0], tail0, P.step).reverse() : []),
          ...spine,
          ...(tail1 > 0 ? extend(spine[spine.length - 2], spine[spine.length - 1], tail1, P.step) : [])
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

  // A strip fill — the area between two rails (left[i], right[i] pairs), cut as short quads rung by rung. For a tube that is going to be
  // bent by bones (the tail): a fan from the centre would throw long triangles across the bones and fold like a paddle, a strip keeps
  // every triangle between neighbouring rungs, so the skin bends where the bones bend
  fillStrip(left, right, color, offset = [0, 0]) {
    const rgb = hexToRgb(color);
    const [ox, oy] = offset;
    for (let i = 0; i + 1 < Math.min(left.length, right.length); i += 1) {
      const a = left[i], b = right[i], c = left[i + 1], d = right[i + 1];
      this.triangle(a[0] + ox, a[1] + oy, b[0] + ox, b[1] + oy, c[0] + ox, c[1] + oy, rgb);
      this.triangle(b[0] + ox, b[1] + oy, d[0] + ox, d[1] + oy, c[0] + ox, c[1] + oy, rgb);
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

