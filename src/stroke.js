// Turns hand-drawn lines into three.js geometry.
//
// Drawing a line with Line gives no control over thickness (WebGL's linewidth is fixed at 1 nearly everywhere).
// So every stroke becomes a ribbon mesh. Vertices are pushed by noise, and the width is opened
// along the normal of the direction of travel. The width has to be uneven to read as a pen.

import * as THREE from "three";
// Vertex colors go through hexToRgb (linear space) — color.js. Never bypassed (guidelines/drawing.md § colors go in as linear)
import { hexToRgb } from "./color.js";

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

  // Hair. Not filled as an area but drawn back and forth with the pen.
  // The reference's hair works this way, which is why the scribble is needed separately.
  scribble(points, { color = "#2b2724", passes = 14, width = 0.009, spread = 0.05 } = {}) {
    for (let i = 0; i < passes; i += 1) {
      this.phase += 7.77;
      const t = i / Math.max(1, passes - 1);
      // Narrows the spread on the inner side (toward the face). Hair reaches outward.
      const drift = (this.noise(this.phase * 0.3) * 0.4 + (t * 0.85 - 0.25)) * spread;
      const shifted = points.map(([x, y], index) => {
        const wave = this.noise(this.phase * 0.2 + index * 0.4) * spread * 0.4;
        return [x + drift * 0.4 + wave * 0.3, y + drift + wave];
      });
      this.stroke(shifted, { color, width, jitter: 0.012, step: 0.045 });
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
