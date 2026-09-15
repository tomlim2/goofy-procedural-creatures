// The goofy type — any script, in a real font, laid down in the pencil. The name screen's card writes with it (src/card.js); the
// goofy letters (medium/letters.js) are a hand-lettered alphabet kept beside it, and they are Latin capitals only.
//
// A line is written onto a 2D canvas in the page's type — Noto Sans and Noto Sans KR, served from fonts/ (styles.css @font-face) —
// and the canvas's alpha is **traced**: marching squares at half coverage, the crossings joined into rings, each ring simplified.
// A ring inside an even number of others is an outline and one inside an odd number a hole in the smallest outline round it. The
// rings are the data (em units: x from the pen's start, y up from the baseline), and writing them is the pencil's: every point is
// first shifted by a wiggle of its own, the shape is filled — ear-clipped with its holes, as three.js cuts a shape — and each ring
// is edged in a pencil line, so a word wanders, sheds and boils like the drawing it sits on. Tracing needs a canvas, so it runs in
// the browser. Docs: guidelines/name.md § the type

import * as THREE from "three";
import { hexToRgb } from "../color.js";

// The faces, named for this page so a font installed on the machine never stands in for them
export const TYPE_FAMILY = "'Menagerie Sans', 'Menagerie Sans KR', sans-serif";
const TRACE_PX = 96;     // a line is traced this many pixels to the em
const SIMPLIFY = 0.6;    // and each ring simplified to within this many of those pixels

// Loads all four faces **whatever is typed**: a face fetched only when a name needs it would tell the server which script the name
// is in (fonts/README.md). Resolves when they are ready; a face that fails leaves the platform's font to be traced instead
export function loadType() {
  const faces = [];
  for (const weight of ["500", "700"]) {
    faces.push(document.fonts.load(`${weight} 32px 'Menagerie Sans'`, "Aa"));
    faces.push(document.fonts.load(`${weight} 32px 'Menagerie Sans KR'`, "가"));
  }
  return Promise.all(faces).catch(() => null);
}

// -- tracing --
// A line of text at a weight → { shapes: [{ outer, holes }], width } in ems. Traced once and remembered
const traced = new Map();
export function traceType(text, weight = 500) {
  const key = `${weight}|${text}`;
  if (traced.has(key)) return traced.get(key);
  const font = `${weight} ${TRACE_PX}px ${TYPE_FAMILY}`;
  const canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.font = font;
  const advance = ctx.measureText(text).width;
  const pad = 8;
  const W = Math.max(1, Math.ceil(advance) + pad * 2);
  const H = Math.ceil(TRACE_PX * 1.6) + pad * 2;
  const base = pad + Math.ceil(TRACE_PX * 1.15);
  canvas.width = W;
  canvas.height = H;
  ctx = canvas.getContext("2d", { willReadFrequently: true });   // a resize resets the context's state
  ctx.font = font;
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, pad, base);
  const alpha = ctx.getImageData(0, 0, W, H).data;
  const rings = traceRings((x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : alpha[(y * W + x) * 4 + 3] / 255), W, H)
    .map((ring) => ring.map(([x, y]) => [(x - pad) / TRACE_PX, (base - y) / TRACE_PX]));
  const result = { shapes: nest(rings), width: advance / TRACE_PX };
  traced.set(key, result);
  return result;
}

// Marching squares on a coverage field at half — the crossing placed along each cell edge where the coverage passes 0.5, so a ring
// follows the antialiased edge rather than the pixels' steps — the segments joined into rings (every crossing is shared by exactly
// two segments, whichever way each was written) and each ring simplified
function traceRings(value, W, H) {
  const T = 0.5;
  const at = (p, q) => (T - p) / (q - p);
  const segments = [];
  for (let y = -1; y < H; y += 1) {
    for (let x = -1; x < W; x += 1) {
      const tl = value(x, y), tr = value(x + 1, y), br = value(x + 1, y + 1), bl = value(x, y + 1);
      const k = (tl > T ? 8 : 0) | (tr > T ? 4 : 0) | (br > T ? 2 : 0) | (bl > T ? 1 : 0);
      if (k === 0 || k === 15) continue;
      const top = [x + at(tl, tr), y], right = [x + 1, y + at(tr, br)], bottom = [x + at(bl, br), y + 1], left = [x, y + at(tl, bl)];
      const joined = (tl + tr + br + bl) / 4 > T;   // a saddle is read by its centre
      const cell = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
        5: joined ? [[left, top], [bottom, right]] : [[left, bottom], [top, right]],
        6: [[bottom, top]], 7: [[left, top]], 8: [[top, left]], 9: [[top, bottom]],
        10: joined ? [[top, right], [left, bottom]] : [[top, left], [bottom, right]],
        11: [[top, right]], 12: [[right, left]], 13: [[right, bottom]], 14: [[bottom, left]]
      }[k];
      segments.push(...cell);
    }
  }
  const id = ([x, y]) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
  const touching = new Map();
  segments.forEach((segment, i) => {
    for (const point of segment) {
      const key = id(point);
      if (!touching.has(key)) touching.set(key, []);
      touching.get(key).push(i);
    }
  });
  const used = new Uint8Array(segments.length);
  const rings = [];
  for (let i = 0; i < segments.length; i += 1) {
    if (used[i]) continue;
    used[i] = 1;
    const ring = [segments[i][0], segments[i][1]];
    const start = id(segments[i][0]);
    let end = segments[i][1];
    for (;;) {
      const endId = id(end);
      if (endId === start) {
        ring.pop();
        break;
      }
      const next = (touching.get(endId) || []).find((n) => !used[n]);
      if (next === undefined) break;
      used[next] = 1;
      const [p, q] = segments[next];
      end = id(p) === endId ? q : p;
      ring.push(end);
    }
    if (ring.length < 5) continue;
    const half = Math.floor(ring.length / 2);
    const simple = [...simplify(ring.slice(0, half + 1)).slice(0, -1), ...simplify([...ring.slice(half), ring[0]]).slice(0, -1)];
    if (simple.length >= 3) rings.push(simple);
  }
  return rings;
}

// Ramer–Douglas–Peucker, to within SIMPLIFY pixels
function simplify(points) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const length = Math.hypot(bx - ax, by - ay) || 1e-9;
  let far = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / length;
    if (d > far) {
      far = d;
      index = i;
    }
  }
  if (far <= SIMPLIFY) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))];
}

const areaOf = (ring) => ring.reduce((sum, [x, y], i) => {
  const [nx, ny] = ring[(i + 1) % ring.length];
  return sum + x * ny - nx * y;
}, 0) / 2;
function inside([px, py], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
// The rings as shapes: an outline and the holes in it (the counter of an O, the ring of an ㅇ)
function nest(rings) {
  const bySize = rings.map((ring) => ({ ring, size: Math.abs(areaOf(ring)) })).sort((a, b) => b.size - a.size);
  const shapes = [];
  for (const { ring, size } of bySize) {
    const around = bySize.filter((other) => other.size > size && inside(ring[0], other.ring)).length;
    if (around % 2 === 0) {
      shapes.push({ outer: ring, holes: [], size });
      continue;
    }
    const parent = shapes.filter((shape) => shape.size > size && inside(ring[0], shape.outer)).sort((a, b) => a.size - b.size)[0];
    if (parent) parent.holes.push(ring);
  }
  return shapes.map(({ outer, holes }) => ({ outer, holes }));
}

// -- writing --
// A traced line onto a sketch: its pen's start at world (x, y) on the baseline, `em` world units to the em. wiggle (in ems) shifts
// every point along the sketch's own noise, at `phase` (a boil frame's own); edge is the pencil's width round each ring, in ems
export function typeWith(sketch, line, { x, y, em, color, wiggle = 0.03, phase = 0, edge = 0.035 }) {
  const rgb = hexToRgb(color);
  const noise = sketch.noise;
  const shift = ([gx, gy]) => [
    x + (gx + wiggle * noise(gx * 7.1 + gy * 3.3 + phase)) * em,
    y + (gy + wiggle * noise(gy * 6.7 - gx * 2.9 + phase * 1.7 + 40)) * em
  ];
  const width = (edge * em) / sketch.inkScale;
  for (const shape of line.shapes) {
    const outer = shape.outer.map(shift);
    const holes = shape.holes.map((hole) => hole.map(shift));
    const corners = [...outer, ...holes.flat()];
    const triangles = THREE.ShapeUtils.triangulateShape(outer.map(([px, py]) => new THREE.Vector2(px, py)), holes.map((hole) => hole.map(([px, py]) => new THREE.Vector2(px, py))));
    for (const [a, b, c] of triangles) sketch.triangle(corners[a][0], corners[a][1], corners[b][0], corners[b][1], corners[c][0], corners[c][1], rgb);
    for (const ring of [outer, ...holes]) sketch.pencil(ring, { color, width, closed: true });
  }
}
