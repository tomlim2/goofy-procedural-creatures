// Turns hand-drawn lines into three.js geometry.
//
// Drawing a line with Line gives no control over thickness (WebGL's linewidth is fixed at 1 nearly everywhere).
// So every stroke becomes a ribbon mesh. Vertices are pushed by noise, and the width is opened
// along the normal of the direction of travel. The width has to be uneven to read as a pen.

import * as THREE from "three";
// Vertex colors go through hexToRgb (linear space) — color.js. Never bypassed (guidelines/drawing.md § colors go in as linear)
import { hexToRgb, mix } from "./color.js";
import { PAPER } from "./character/vocabulary/palette.js";   // the pencil's bites take the paper color (palette.js imports nothing — no cycle)
// The three concepts a sketch draws by name. They take the sketch in; they never import this file
import { contourWith, lineWith } from "./medium/outlines.js";
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
// The skin tag at arc length u along `points` — skinT is [t0, t1] (linear over the whole line) or one t per point (piecewise linear between
// points, so a line's tag can follow another curve's parameter — the tail's rails follow the spine's t, which on the inner side of a curl runs
// faster than the rail's own length)
function tagAlong(points, skinT, u, total) {
  if (skinT.length === points.length && points.length > 2) {
    let acc = 0;
    for (let k = 1; k < points.length; k += 1) {
      const seg = Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]);
      if (u <= acc + seg || k === points.length - 1) return skinT[k - 1] + (skinT[k] - skinT[k - 1]) * Math.max(0, Math.min(1, (u - acc) / (seg || 1e-9)));
      acc += seg;
    }
  }
  const f = Math.max(0, Math.min(1, u / (total || 1e-9)));
  return skinT[0] + (skinT[skinT.length - 1] - skinT[0]) * f;
}

export const PENCIL = {
  step: 0.01,                          // re-sample spacing (world) — about 2.3 px at board scale; theirs max(2.2, w·.9) px
  wander: 0.0045,                      // the spine's wander amplitude (world), × the individual's wobble
  drift: { amp: 0.55, f: [5, 12] },    // the slow bend — its share of the wander, and rad per world unit (one or two cycles round a head)
  waver: { amp: 0.3, f: [20, 36] },    // the second bend
  breathe: [[0.38, 6], [0.14, 16]],    // the width breathing — [amplitude, rad per world unit], summed
  jr: [0.88, 1.14],                    // per-stroke width jitter
  over: [0.35, 1.1],                   // the overshoot past each end, in widths
  tailSteps: 6,                        // the overshoot is cut into at least this many, whatever PENCIL.step says — it is only
                                       // 0.4~3.6 steps long, and the end's dome cannot be drawn on one or two points
  stub: 0.05,                          // a line this short keeps its ends and sheds nothing — the overshoot would run it half again
                                       // to twice as long, and a crumb or a bite is the size of the whole mark. Every dot and dash is one
  tip: 0.35,                           // the width left at the very end of an overshoot — a blunt lift, never a needle
  // **the lift** — the pen comes up. In **world units**, not in widths: a hold does not change with the size, so the same kind
  // at S, M and L has to skip in the same places for the same length. Measured in widths the gaps grew with the line —
  // a hairline came out finely dashed and a fat one broke twice — and the three sizes read as three different holds.
  // The numbers are the old ones × SLINE's M (0.005), so the board's size is untouched. min: the shortest line that lifts at
  // all; edge: how close to an end a skip may fall. A hold asks for it (medium/outlines.js: SLINE), the pencil knows how
  lift: { per: 0.45, gap: [0.006, 0.015], min: 0.04, edge: 0.015 },
  // **the ghost** — every pass but the last is laid at `width` of the line's width and `ink` of its ink: the same line again,
  // thinner and faint, wandering and breathing on its own. The **line goes down last**, so the ghosts sit under it and it stays the
  // one you read (within a mesh, vertex order is the stacking — guidelines/rig.md). The ink is not opacity: the board's ink is
  // opaque, so the colour is mixed that far toward the paper it is drawn on, which is what a fifth of a pass looks like. Lay
  // enough of them and the line comes out doubled and offset, which is the BROKEN hold (medium/outlines.js)
  // slip: how far a ghost is pushed sideways off the line, in widths — a hand going round twice does not land on its own line
  ghost: { width: 0.62, ink: [0.2, 0.5], slip: [0.5, 1.6] },   // one per ghost, bottom-up: the deepest faintest, the one just under the line darkest
  // The shed. Only a line at least minWidth wide (world) sheds. density: the share of re-sample points that drop a crumb (per stroke).
  // An ink crumb sits on the edge, its centre scatter × the half width out — never past the edge, so it frays the line instead of
  // floating loose beside it; a bite (the bite share of crumbs) is a paper-coloured square
  // inside, up to inside × the half width from the spine. A crumb's side is size (world) — fixed, not a share of the width:
  // graphite sheds the same grain whether the line is thin or thick, so a thick line does not shed boulders
  grit: { minWidth: 0.006, density: [0.2, 0.55], scatter: [0.8, 1.0], bite: 0.45, inside: 0.8, size: [0.0025, 0.0045] }
};


// The anatomy switch — which of a line's habits are on. **Only the medium page passes it** (how.js: the rows that build a line up one
// habit at a time, how.html § the two pens); everything else leaves it out and draws with all of them, so nothing on
// the board can lose a habit by accident. A habit left out here is left out of the drawing, not faked
const ALL_HABITS = { wander: true, breathe: true, over: true, shed: true };


export class Sketch {
  // inkScale is the global multiplier for stroke thickness. Change the cell size and this is the only thing to touch.
  constructor(noise, wobble = 1, inkScale = 1.5) {
    this.noise = noise;
    this.wobble = wobble;
    this.inkScale = inkScale;
    this.positions = [];
    this.colors = [];
    // The skin tag — one number per vertex (tags), the t along a bent part's spine that the triangle was drawn at, or NaN. A skinned mesh
    // (the tail) reads its bones from it, so a vertex is never guessed from its position (beside a tight curl, a guess picks the wrong bone).
    // skinT is the tag the next triangles take; the drawing calls set it (stroke/pencil by arc fraction from a [t0, t1], fill by a constant)
    this.tags = [];
    this.skinT = NaN;
    this.phase = 0;
  }

  // tags [ta, tb, tc] tags the three corners **one by one** — a quad that spans two rungs of a bent part gives each corner the t of the rung it
  // sits on. Without it all three take this.skinT, which tears the skin: a rung's vertex belongs to two quads, and one tag per quad hands the
  // same point two different bone blends, so the fill splits open and the side lines break into dashes wherever a joint bends
  triangle(ax, ay, bx, by, cx, cy, rgb, tags = null) {
    this.positions.push(ax, ay, 0, bx, by, 0, cx, cy, 0);
    for (let i = 0; i < 3; i += 1) this.colors.push(rgb[0], rgb[1], rgb[2]);
    if (tags) this.tags.push(tags[0], tags[1], tags[2]);
    else this.tags.push(this.skinT, this.skinT, this.skinT);
  }

  // The goofy outline (medium/outlines.js) — the closed line of a shape, or an open line (down to a dot). What each is drawn with is the board's switch (BOARD_LINES)
  contour(points, options) { return contourWith(this, points, options); }
  line(points, options) { return lineWith(this, points, options); }

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
  pencil(points, { color = "#2b2724", width = 0.012, passes = 1, closed = false, lift = null, breathe: breath = 1, anatomy = null, paper = PAPER, joint = null, skinT = null } = {}) {
    const P = PENCIL;
    const A = anatomy || ALL_HABITS;
    const rgb = hexToRgb(color);
    // A colour per ghost, bottom-up — the deepest is the faintest and the one just under the line is the darkest, the
    // way a hand going round again leans a little harder. Faintness is a **colour**, not an alpha: the board's ink is opaque
    const ghostRgb = P.ghost.ink.map((k) => hexToRgb(mix(color, paper, 1 - k)));
    const biteRgb = hexToRgb(paper);
    width *= this.inkScale;
    this.skinT = NaN;   // per-vertex tags below — nothing inherits a tag from this call
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
      const isGhost = pass < passes - 1;   // the line itself is laid last, so its ghosts end up underneath it
      const w = width * (1 + (jr(1, P.jr) - 1) * breath) * (isGhost ? P.ghost.width : 1);
      const passRgb = isGhost ? ghostRgb[Math.min(pass, ghostRgb.length - 1)] : rgb;   // more ghosts than colours: the last repeats

      // The spine — re-sampled, and on an open line run past both ends along the end tangents
      let spine = resample(closed ? [...points, points[0]] : points, P.step);
      if (closed) spine.pop();
      // Two samples draw as one quad: the pencil's width does not taper to nothing at an end, so a stub is a stub, not a gap
      if (spine.length < 2) continue;
      // A stub — measured before the overshoot could lengthen it (PENCIL.stub)
      let raw = 0;
      for (let i = 1; i < spine.length; i += 1) raw += Math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1]);
      if (closed) raw += Math.hypot(spine[0][0] - spine[spine.length - 1][0], spine[0][1] - spine[spine.length - 1][1]);
      const stub = raw < P.stub;
      let tail0 = 0;
      let tail1 = 0;
      if (!closed && A.over && !stub) {
        tail0 = joint && joint[0] ? 0 : w * jr(2, P.over);
        tail1 = joint && joint[1] ? 0 : w * jr(3, P.over);
        // The tails are sampled finer than the line: never coarser than PENCIL.step, and never fewer than tailSteps points,
        // so the dome at the end has a curve to be drawn on rather than the one or two points the line's own step would land there
        const tailStep = (t) => Math.min(P.step, t / P.tailSteps);
        spine = [
          ...(tail0 > 0 ? extend(spine[1], spine[0], tail0, tailStep(tail0)).reverse() : []),
          ...spine,
          ...(tail1 > 0 ? extend(spine[spine.length - 2], spine[spine.length - 1], tail1, tailStep(tail1)) : [])
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
      // breath scales both the width's sines and the per-stroke jitter: a detail line has to hold its width, or at a
      // hairline the same share of swing reads as a lump rather than a hand (medium/outlines.js: PENCIL_SLINE)
      const breathe = A.breathe ? P.breathe.map(([amp, om], k) => [amp * breath, snap(om), r(8 + k) * TAU]) : [];
      const wander = A.wander ? P.wander * this.wobble : 0;
      // A ghost misses the line: pushed off along the normal by slip widths, to one side or the other, the whole pass together
      const slip = isGhost ? (r(101) < 0.5 ? -1 : 1) * jr(103, P.ghost.slip) * w : 0;
      // The pen lifts (PENCIL.lift, in world units). One skip every `per`, `gap` long, never within `edge` of either end and
      // none at all on a line shorter than `min`: a dot or a dash keeps its whole extent, and only a line long enough to be a
      // detail breaks. The same everywhere on the sheet whatever the width, so a kind skips the same way at every size.
      // A closed loop has no ends to spare
      // Measured along the path **as handed over**, not along the overshot spine: the tails scale with the width, so a
      // skip counted from the spine's start would sit somewhere else at every size — which is the one thing a hold must not do
      const F = P.lift;
      const span = L - tail0 - tail1;
      const gapAt = lift && span >= F.min ? (at) => {
        const u = at - tail0;
        if (u < 0 || u > span) return false;
        const cell = Math.floor(u / F.per);
        const g = jr(20 + cell * 2, F.gap);
        const from = cell * F.per + r(21 + cell * 2) * (F.per - g);
        if (u <= from || u >= from + g) return false;
        return closed || (from > F.edge && from + g < span - F.edge);
      } : null;

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
        const off = slip + wander * (P.drift.amp * Math.sin(s[i] * f1 + p1) + P.waver.amp * Math.sin(s[i] * f2 + p2));
        return [x + normals[i][0] * off, y + normals[i][1] * off];
      });
      // The half width — breathing, and thinning only inside the overshoot tails
      const halves = [];
      for (let i = 0; i < n; i += 1) {
        let k = 1;
        for (const [amp, om, p] of breathe) k += amp * Math.sin(s[i] * om + p);
        // The overshoot's width on a **quarter circle**, not a straight ramp: at u the width is tip + (1 − tip)·√(1 − (1 − u)²),
        // so it fills out fast and flattens off. On a straight ramp the two rails converge evenly and the end reads as a wedge
        // with straight sides — which is the thing that looked cut. A dome ends round, and PENCIL.tip is the width it ends on
        const dome = (u) => P.tip + (1 - P.tip) * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
        let tip = 1;
        if (!closed && s[i] < tail0) tip = dome(s[i] / tail0);
        else if (!closed && L - s[i] < tail1) tip = dome((L - s[i]) / tail1);
        halves.push((w / 2) * Math.max(0.08, k) * tip);
      }
      // The skin tag along the line — the arc fraction between the overshoot tails, so the tails take the ends' tags
      const tagAt = (i) => (skinT ? tagAlong(points, skinT, Math.max(0, Math.min(L - tail0 - tail1, s[i] - tail0)), L - tail0 - tail1) : NaN);
      const quads = closed ? n : n - 1;
      for (let i = 0; i < quads; i += 1) {
        if (gapAt && gapAt((s[i] + s[(i + 1) % n]) / 2)) continue;   // the pen is off the paper here
        const ti = tagAt(i), tj = tagAt((i + 1) % n);   // per point, not per quad — the two quads meeting at a point must give it the same tag
        const j = (i + 1) % n;
        const [ax, ay] = path[i];
        const [bx, by] = path[j];
        const [nax, nay] = normals[i];
        const [nbx, nby] = normals[j];
        const ha = halves[i];
        const hb = halves[j];
        this.triangle(ax + nax * ha, ay + nay * ha, ax - nax * ha, ay - nay * ha, bx + nbx * hb, by + nby * hb, passRgb, [ti, ti, tj]);
        this.triangle(ax - nax * ha, ay - nay * ha, bx - nbx * hb, by - nby * hb, bx + nbx * hb, by + nby * hb, passRgb, [ti, tj, tj]);
      }

      // The shed — after the ribbon, so a bite covers ink and a crumb sits on the paper
      if (stub || !A.shed || w < P.grit.minWidth) continue;
      const density = jr(10, P.grit.density);
      const G = P.grit;
      for (let i = 0; i < n; i += 1) {
        if (!closed && (s[i] < tail0 || L - s[i] < tail1)) continue;
        if (gapAt && gapAt(s[i])) continue;   // nothing sheds where the pen is off the paper
        if (noise(ph * 0.11 + i * 1.93) * 0.5 + 0.5 > density) continue;
        const v = noise(ph * 0.23 + i * 3.17);                                 // [-1, 1] — which side, and how far
        const isBite = noise(ph * 0.31 + i * 5.39) * 0.5 + 0.5 < G.bite;
        const h = halves[i];
        const d = isBite ? v * G.inside * h : Math.sign(v || 1) * (G.scatter[0] + (G.scatter[1] - G.scatter[0]) * Math.abs(v)) * h;
        const size = G.size[0] + (G.size[1] - G.size[0]) * Math.abs(noise(ph * 0.17 + i * 7.13));
        this.skinT = tagAt(i);   // a crumb is one point — one tag is right for it
        this.square(path[i][0] + normals[i][0] * d, path[i][1] + normals[i][1] * d, size, isBite ? biteRgb : passRgb);
      }
      this.skinT = NaN;
    }
  }

  // A strip fill — the area between two rails (left[i], right[i] pairs), cut as short quads rung by rung. For a tube that is going to be
  // bent by bones (the tail): a fan from the centre would throw long triangles across the bones and fold like a paddle, a strip keeps
  // every triangle between neighbouring rungs, so the skin bends where the bones bend
  // tOf(i) tags rung i's quads with its t along the spine (the skin tag)
  fillStrip(left, right, color, offset = [0, 0], tOf = null) {
    const rgb = hexToRgb(color);
    const [ox, oy] = offset;
    this.skinT = NaN;
    for (let i = 0; i + 1 < Math.min(left.length, right.length); i += 1) {
      const a = left[i], b = right[i], c = left[i + 1], d = right[i + 1];
      // Each corner takes the t of **its own rung** — a and b sit on rung i, c and d on rung i + 1. One tag for the whole quad would give
      // rung i + 1's two points a different bone blend in this quad than in the next one, and the strip would tear open at every bend
      const ta = tOf ? tOf(i) : NaN, tb = tOf ? tOf(i + 1) : NaN;
      this.triangle(a[0] + ox, a[1] + oy, b[0] + ox, b[1] + oy, c[0] + ox, c[1] + oy, rgb, [ta, ta, tb]);
      this.triangle(b[0] + ox, b[1] + oy, d[0] + ox, d[1] + oy, c[0] + ox, c[1] + oy, rgb, [ta, tb, tb]);
    }
  }

  // Area fill. Cut as a fan from the centre.
  // Every shape we use is visible from its centre, so this is enough.
  // skinT tags the fan with one t (the skin tag) — a bead, a tuft, a pom sitting at one place on a bent part
  fill(points, color, offset = [0, 0], skinT = NaN) {
    this.skinT = skinT;
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
  scribble(points, { color = "#2b2724", passes = 14, width = 0.009, spread = 0.05, root = -0.25, reach = 0.85, scatter = 0.4, wave = 0.4, lean = 0.4, waveLean = 0.3, paper = PAPER } = {}) {
    for (let i = 0; i < passes; i += 1) {
      this.phase += 7.77;
      const t = i / Math.max(1, passes - 1);
      // Narrows the spread on the inner side (toward the face). Hair reaches outward.
      const drift = (this.noise(this.phase * 0.3) * scatter + (t * reach + root)) * spread;
      const shifted = points.map(([x, y], index) => {
        const w = this.noise(this.phase * 0.2 + index * 0.4) * spread * wave;
        return [x + drift * lean + w * waveLean, y + drift + w];
      });
      this.pencil(shifted, { color, width, paper });
    }
  }

  // Hatched shading. Used for shadow on a cheek or forehead.
  hatch(cx, cy, rx, ry, angle, { color = "#3a3430", lines = 6, width = 0.006, paper = PAPER } = {}) {
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
      this.pencil([[ax, ay], [bx, by]], { color, width, paper });
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

