// Hats and horns — the things that sit on top of the head. Docs: guidelines/character/parts.md § headgear · horns
// A hat sits above the brow line (head.js browLine) and covers along the head outline shape (layout.js headShape).

import { paintOf } from "../vocabulary/paint.js";
import { blobPath, arcPath, crumple } from "../../shape.js";
import { paintPart } from "./body.js";
import { shade } from "../../color.js";
import { headShape } from "./layout.js";
import { browLine } from "./head.js";
import { MARKS } from "../vocabulary/palette.js";

// **The bands** — the only widths a part still names, because they are not lines: a hat's colour laid as a thick pencil stroke, a
// fill in disguise (a band across the crown, and the brim's rim). Everything that *is* a line asks for a size instead
// (medium/outlines.js PEN_SIZES)
const BANDS = { hat: 0.03, brim: 0.055 };

export function drawHeadgear(ink, fills, spec, box) {
  const kind = spec.parts.headgear;
  if (kind === "none") return;
  const ink0 = spec.palette.ink;
  const pop = spec.palette.pop;
  // The hat's box: a pop aimed at the headgear wins as it always did, otherwise the accent — unless a hand has
  // repainted the hat, in which case its choice is the colour, pop or not.
  const accent = spec.paint && spec.paint.headgear ? paintOf(spec, "headgear") : pop && pop.target === "headgear" ? pop.color : spec.palette.accent;
  const rx = box.headRx;
  const ry = box.headRy;
  const cy = box.headCy;

  // A hat sits **above the brow line**. So it never covers an individual whose eyes are set high, it is measured from the
  // top edge of the eyes (including eyewear, goggle, patch and monocle rims), and its width follows the head outline's half-width (ellipse) at that height — it always fits the head whatever its size or shape.
  const brow = browLine(spec, box);
  const halfW = (y) => rx * Math.sqrt(Math.max(0.05, 1 - ((y - cy) / ry) ** 2));
  const crown = cy + ry;
  const tiltSide = spec.seed % 2 ? 1 : -1;
  // Hats that cover the head (helmet, cap) follow **the head outline shape** (squareness, the top/bottom width ratio) rather than an ellipse, drawn slightly larger and then
  // cut at the brow line — the corners of a square head and the hair on the crown both have to be covered. Only the outline above (y ≥ line) is kept and the bottom is joined up.
  const shape = headShape(spec);
  const cover = (grow, line) => {
    const outline = blobPath(0, cy, rx * grow, ry * grow, { lumps: 3, amount: 0.05, noise: null, square: shape.square, taper: shape.taper });
    const upper = outline.filter(([, y]) => y >= line);
    // Closes the cut with the left and right ends on y = line (keeping left→right order)
    upper.sort((a, b) => Math.atan2(a[1] - line, a[0]) - Math.atan2(b[1] - line, b[0]));
    const w = Math.max(...upper.map(([x]) => Math.abs(x)));
    return { path: [[w, line], ...upper, [-w, line]], w };
  };

  if (kind === "band") {
    // Headband — just above the brows, poking slightly outside the outline
    const y = brow + ry * 0.08;
    const w = halfW(y) * 1.05;
    // The band — the hat's color laid as a thick pencil stroke: a fill in disguise, not a line, so it stays outside the goofy outline
    ink.pencil([[-w, y], [w, y + 0.006]], { color: accent, width: BANDS.hat });
    ink.line([[-w, y + 0.014], [w, y + 0.02]], { color: ink0, size: "S" });
    return;
  }

  if (kind === "helmet") {
    // Helmet — covers from above the brows to the crown along the head shape (1.1×). A lower rim plus a centre ridge
    const bottom = brow;
    const { path, w } = cover(1.1, bottom);
    paintPart(fills, spec, path, accent, { own: true });   // a hat takes the creature's goofy material at its own color's step
    ink.contour(path, { color: ink0 });
    ink.line([[-w * 1.02, bottom + 0.004], [w * 1.02, bottom - 0.004]], { color: ink0 });
    ink.line([[0, bottom + (crown - bottom) * 0.2], [0.004, crown * 0.99 + ry * 0.08]], { color: ink0, size: "S" });
    return;
  }

  if (kind === "cap") {
    // Baseball cap — a dome following the head shape (1.04×) plus a brim out to one side (the brow line). The brim droops slightly
    const bottom = brow + ry * 0.05;
    const { path, w } = cover(1.04, bottom);
    paintPart(fills, spec, path, accent, { own: true });   // a hat takes the creature's goofy material at its own color's step
    ink.contour(path, { color: ink0 });
    const brim = crumple([[tiltSide * w * 0.1, bottom + 0.012], [tiltSide * w * 1.5, bottom - 0.01], [tiltSide * w * 1.5, bottom - 0.03], [tiltSide * w * 0.1, bottom - 0.01]], 0.003, tiltSide * 2);
    paintPart(fills, spec, brim, accent, { own: true });
    ink.contour(brim, { color: ink0 });
    return;
  }

  if (kind === "beret") {
    // Beret — a flat disc laid on the crown at a tilt, plus a nub
    const tilt = tiltSide * 0.16;
    const bx = -tilt * rx * 0.8;
    const by = Math.max(cy + ry * 0.82, brow + ry * 0.35);
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const disc = blobPath(0, 0, rx * 0.95, ry * 0.3, { lumps: 4, amount: 0.12, noise: null })
      .map(([x, y]) => [bx + x * cos - y * sin, by + x * sin + y * cos]);
    paintPart(fills, spec, disc, accent, { own: true });
    ink.contour(disc, { color: ink0 });
    ink.line([[bx, by + ry * 0.3], [bx + 0.012, by + ry * 0.42]], { color: ink0 });
    return;
  }

  if (kind === "crown") {
    // Crown — a band sitting on the crown of the head with a zigzag of points, the reference's scribbled paper crown.
    // Hand-written polygon, so it goes through crumple (guidelines/drawing.md § nothing raw).
    // **Filled in pieces** — the band and each spike on its own. fill() is a fan from the centre and assumes a shape
    // visible from it; the V notches between the spikes are concave, and fanned as one polygon the fill crossed them
    const by = Math.max(cy + ry * 0.7, brow + ry * 0.3);
    const w = Math.max(halfW(by) * 0.98, rx * 0.55);
    const bandH = ry * 0.14;
    const peakH = ry * 0.62;   // top ≈ crown + 0.32·ry — under the 1.19 cell ceiling on the biggest head
    const SPIKES = 4;
    const vx = (i) => -w + (i * 2 * w) / SPIKES;                              // valley x — the spikes sit on the band's top edge
    const peak = (i) => [-w + ((i + 0.5) * 2 * w) / SPIKES, by + peakH];
    const phase = spec.seed * 0.001;
    const band = crumple([[w, by], [-w, by], [-w, by + bandH], [w, by + bandH]], 0.004, phase);
    const spikes = Array.from({ length: SPIKES }, (_, i) =>
      crumple([[vx(i), by + bandH], peak(i), [vx(i + 1), by + bandH]], 0.004, phase + i));
    paintPart(fills, spec, band, accent, { own: true });
    for (const s of spikes) paintPart(fills, spec, s, accent, { own: true });
    // One outline round the whole silhouette — the pieces are the filling's business, not the line's
    const outline = [[w, by], [-w, by], [-w, by + bandH]];
    for (let i = 0; i < SPIKES; i += 1) outline.push(peak(i), [vx(i + 1), by + bandH]);
    outline[outline.length - 1] = [w, by + bandH];
    ink.contour(crumple(outline, 0.004, phase), { color: ink0 });
    return;
  }

  if (kind === "coronet") {
    // The monkey's crown. It is **one tall body with V notches cut into its top**, not a band with triangles
    // stood on it — that was the first reading and it came out as a squat strip. Measured off the reference
    // head (500 px, skull ry ≈ 138, head half-width 72 at the crown's base):
    //   the body is a trapezoid **narrower at the bottom than the top** (base half 16 px, top half 21 px) and
    //   is about as TALL as it is wide (42 px each way) — that squareness is the "long body" of it ·
    //   the notches cut down two thirds of the crown's height, leaving the body a third ·
    //   the tips evenly spaced across ±1.5× the base half-width, so the outer two overhang the body ·
    //   the tips sit at DIFFERENT heights (the ripple runs either way per individual) — most of what keeps
    //   it from reading as a stamped icon. The reference has four; three reads better at this size.
    // The reference stands 0.93·ry over the skull and this cell allows about 0.45, so the crown is scaled to
    // the board, and the aspect is kept as far as it can be — narrowed rather than squashed, because
    // squashing is what loses the long body. Narrowed all the way to the reference's ratio it turned into a
    // sliver, so it sits between: about 1.9 tall to 1 wide against the reference's 2.3.
    // One polygon, filled in pieces — the notches are concave and a fan from the centre crosses them.
    const by = Math.max(cy + ry * 0.78, brow + ry * 0.3);
    // **Every measurement hangs off the base half-width**, the way the reference's do, so the proportions hold
    // whatever shape the head is. Tying the heights to ry instead let a wide head flatten the body back into
    // the strip this kind exists to avoid. w itself is capped both ways: by the head's width at that height
    // (it must sit on the skull) and by ry (the cell has a ceiling)
    const w = Math.min(halfW(by) * 0.24, ry * 0.082);
    const topW = w * 1.3;                  // the body flares as it rises
    const bodyH = topW * 2.9;              // the body carries the height — this is the long-bodied crown
    const peakH = bodyH * 1.35;            // the notches are shallow: the jagged part is the crown's top, not most of it
    const tipSpan = w * 1.5;
    const SPIKES = 3;
    const RIPPLE = [0.85, 1, 0.9];   // still three different heights — even tips read as a stamped icon
    const hOf = (i) => RIPPLE[tiltSide < 0 ? SPIKES - 1 - i : i];
    const tipX = (i) => -tipSpan + (i * 2 * tipSpan) / (SPIKES - 1);
    const tip = (i) => [tipX(i), by + bodyH + peakH * hOf(i)];
    const valleyX = (i) => (tipX(i) + tipX(i + 1)) / 2;   // the notch between two tips
    const phase = spec.seed * 0.0017;

    // the body — a trapezoid, filled as one convex piece
    const body = crumple([[-w, by], [w, by], [topW, by + bodyH], [-topW, by + bodyH]], 0.003, phase);
    paintPart(fills, spec, body, accent, { own: true });
    // each spike its own triangle, standing on the body's top edge
    for (let i = 0; i < SPIKES; i += 1) {
      const l = i === 0 ? -topW : valleyX(i - 1);
      const r = i === SPIKES - 1 ? topW : valleyX(i);
      paintPart(fills, spec, crumple([[l, by + bodyH], tip(i), [r, by + bodyH]], 0.003, phase + i), accent, { own: true });
    }
    // one outline round the whole silhouette — the pieces are the filling's business, not the line's
    const outline = [[w, by], [-w, by], [-topW, by + bodyH]];
    for (let i = 0; i < SPIKES; i += 1) {
      outline.push(tip(i));
      if (i < SPIKES - 1) outline.push([valleyX(i), by + bodyH]);
    }
    outline.push([topW, by + bodyH]);
    ink.contour(crumple(outline, 0.003, phase), { color: ink0 });
    return;
  }

  if (kind === "cone") {
    // Party cone — a tall triangle sitting on the crown, leaning a little to one side, a pom at the tip.
    // One convex triangle, so the fan fill is safe as it is; crumpled like every hand-written polygon
    const by = Math.max(cy + ry * 0.68, brow + ry * 0.3);
    const w = Math.max(halfW(by) * 0.42, rx * 0.26);   // narrow — a party cone, not a tent
    const apex = [tiltSide * rx * 0.12, by + ry * 0.66];   // pom top ≈ crown + 0.34·ry — under the 1.19 cell ceiling
    const body = crumple([[-w, by], [w, by], apex], 0.004, spec.seed * 0.0013);
    paintPart(fills, spec, body, accent, { own: true });
    ink.contour(body, { color: ink0 });
    const pom = blobPath(apex[0], apex[1] + 0.012, 0.019, 0.019, { lumps: 3, amount: 0.18, noise: null });
    paintPart(fills, spec, pom, shade(accent, 1.3), { own: true });   // the pom a step lighter, so it reads off the cone
    ink.contour(pom, { color: ink0, size: "S" });
    return;
  }

  if (kind === "halo") {
    // Halo — a thin ring floating above the head, nothing else. Ink only: it is a mark, not a thing with a colour.
    // It covers nothing, which is why it is the one headgear that keeps every hairstyle (spec.js applyConstraints)
    const tilt = tiltSide * 0.06;
    const hy = crown + ry * 0.28;   // ring top ≈ crown + 0.38·ry — floats clear of the lumpiest scalp, under the ceiling
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const ring = blobPath(0, 0, rx * 0.44, ry * 0.11, { lumps: 3, amount: 0.06, noise: null })
      .map(([x, y]) => [x * cos - y * sin, hy + x * sin + y * cos]);
    ink.contour(ring, { color: ink0 });
    return;
  }

  if (kind === "bonnet") {
    // Bonnet — a thick band wrapping the head. It crosses over the crown from eye level on both sides
    const rim = arcPath(0, cy, rx * 1.2, ry * 1.14, Math.PI * 1.02, -Math.PI * 0.02, 26);
    // The brim — the hat's color as a thick pencil stroke along the rim: a band, not a line (see the band above)
    ink.pencil(rim, { color: accent, width: BANDS.brim });
    ink.line(rim, { color: ink0 });
    // Knot dots at both ends instead of a ribbon under the chin
    for (const side of [-1, 1]) {
      ink.line([[side * rx * 1.2, cy - 0.01], [side * rx * 1.15, cy - 0.05]], { color: ink0 });
    }
    return;
  }

  // pot — a tub pulled down over the head. Starts above the brows and rises higher than the crown
  const bottom = brow + ry * 0.12;
  const w = halfW(bottom) * 0.9;
  const top = crown + ry * 0.28;
  const pot = crumple([[-w, bottom], [-w * 0.85, top], [w * 0.85, top], [w, bottom]], 0.004, 5);
  paintPart(fills, spec, pot, accent, { own: true });
  ink.contour(pot, { color: ink0 });
  ink.line([[-w * 0.9, bottom + (top - bottom) * 0.25], [w * 0.9, bottom + (top - bottom) * 0.27]], { color: ink0, size: "S" });
}

export function drawHorns(ink, fills, spec, box, noise) {
  const kind = spec.parts.horns;
  if (kind === "none") return;
  const ink0 = spec.palette.ink;
  const rx = box.headRx;
  const ry = box.headRy;
  const cy = box.headCy;

  // REX horns are DRAGON horns whatever the slot says (the rex-leg rule: the way of drawing differs by
  // species) — filled bone mass with an ink contour, never a line, the same bone as the tail's thagomizer.
  // The kinds map to the dragons of the maid-dragon show: curved — the thick pair sweeping out then up
  // (Tohru, ring-segmented) · straight — the straight pair swept back (Fafnir) · antenna — thin pale horns
  // with one twig, half an antler (Kanna) · ram — a tight curl (Lucoa) · crown — one BIG pair standing
  // up and out (Ilulu) · nub — small bone bumps
  if (spec.species === "rex") {
    const bone = shade(MARKS.white, 0.97);
    // A tapered bone horn along a centerline — and its tip is BLUNT: the rails thin gently and close over a
    // round cap, never a point (dragon horn ends are rounded like fingers; collapsed to a point they came out
    // as scraggly needles under the pencil's wobble)
    const boneHorn = (raw, w0, place) => {
      const pts = place ? place(raw) : raw;
      const L = [], R = [];
      let ex = 0, ey = 1;
      for (let i = 0; i < pts.length; i += 1) {
        const [x, y] = pts[i];
        const [ax, ay] = pts[Math.max(0, i - 1)], [bx2, by2] = pts[Math.min(pts.length - 1, i + 1)];
        let dx = bx2 - ax, dy = by2 - ay;
        const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        if (i === pts.length - 1) { ex = dx; ey = dy; }
        const w = w0 * (1 - (i / (pts.length - 1)) * 0.55) + 0.004;
        L.push([x - dy * w, y + dx * w]);
        R.push([x + dy * w, y - dx * w]);
      }
      const tip = pts[pts.length - 1];
      const wEnd = w0 * 0.45 + 0.004;
      const cap = [];
      for (let i = 1; i < 6; i += 1) {   // the round cap — L's end through the horn's direction to R's end
        const th = (i / 6) * Math.PI;
        cap.push([tip[0] + (-ey) * wEnd * Math.cos(th) + ex * wEnd * Math.sin(th), tip[1] + ex * wEnd * Math.cos(th) + ey * wEnd * Math.sin(th)]);
      }
      const poly = [...L, ...cap, ...R.slice().reverse()];
      paintPart(fills, spec, poly, bone, { own: true });
      ink.contour(poly, { color: ink0 });
      return pts;
    };
    // **Where on the skull they root is per individual.** They used to be pinned to one spot near the crown;
    // now the base slides down the head's own outline, from up top to the temple — the sideburn line. As it
    // descends the whole horn is turned by the same amount, so it keeps pointing away from the skull instead
    // of leaning over the face. Hashed off wobbleSeed, so it costs no rng and no seed moved
    const A_TOP = Math.atan2(0.8, 0.55);            // the old fixed spot, in outline angle
    const A_LOW = Math.PI * 0.04;                   // the temple
    const slide = (Math.imul((spec.proportions.wobbleSeed ^ 0x5bd1e995) >>> 0, 0x9e3779b1) >>> 9) / 8388608;
    const aOut = A_TOP + (A_LOW - A_TOP) * slide;
    for (const side of [-1, 1]) {
      const bx0 = side * rx * 0.55, by0 = cy + ry * 0.8;                 // the shapes below are written here
      const bx = side * rx * Math.cos(aOut) * 0.98;                      // ...and moved onto the outline
      const by = cy + ry * Math.sin(aOut) * 0.98;
      const rot = -side * (A_TOP - aOut);
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const place = (pts) => pts.map(([x, y]) => {
        const dx = x - bx0, dy = y - by0;
        return [bx + dx * cs - dy * sn, by + dx * sn + dy * cs];
      });
      const lean = noise(side * 9.1 + spec.seed * 0.0007) * 0.05;
      if (kind === "curved") {
        const c = boneHorn([[bx0, by0], [bx0 + side * 0.075, by0 + 0.095], [bx0 + side * 0.055 + lean, by0 + 0.19]], 0.024, place);
        // the ring segments — two short lines across the horn (the annulated look)
        for (const k of [0.35, 0.6]) {
          const i = k * (c.length - 1), a = c[Math.floor(i)], b = c[Math.ceil(i)] || a;
          const px = a[0] + (b[0] - a[0]) * (i % 1), py = a[1] + (b[1] - a[1]) * (i % 1);
          const w = 0.024 * (1 - k * 0.88) + 0.002;
          const dx = (b[0] - a[0]) || side, dy = (b[1] - a[1]) || 1;
          const l = Math.hypot(dx, dy) || 1;
          ink.line([[px - (-dy / l) * w, py - (dx / l) * w], [px + (-dy / l) * w, py + (dx / l) * w]], { color: ink0, size: "S", joint: [true, true] });
        }
      } else if (kind === "straight") {
        boneHorn([[bx0, by0], [bx0 + side * 0.06 + lean, by0 + 0.1], [bx0 + side * 0.11 + lean, by0 + 0.185]], 0.02, place);
      } else if (kind === "antenna") {
        const pts = [[bx0, by0], [bx0 + side * 0.028, by0 + 0.12], [bx0 + side * 0.06 + lean, by0 + 0.2]];
        boneHorn(pts, 0.011, place);
        const mx = bx0 + side * 0.02, my = by0 + 0.085;   // one twig off the shaft — half an antler
        boneHorn([[mx, my], [mx + side * 0.05, my + 0.05]], 0.008, place);
      } else if (kind === "ram") {
        const spiral = [];
        for (let i = 0; i <= 14; i += 1) {
          const k = i / 14;
          const angle = Math.PI * 0.45 + side * k * Math.PI * 1.35;
          const r = 0.062 * (1 - k * 0.55);
          spiral.push([bx0 + side * 0.015 + Math.cos(angle) * r * side, by0 + 0.015 + Math.sin(angle) * r]);
        }
        boneHorn(spiral, 0.017, place);
      } else if (kind === "crown") {
        boneHorn([[bx0, by0], [bx0 + side * 0.045, by0 + 0.14], [bx0 + side * 0.115 + lean, by0 + 0.245]], 0.033, place);
      } else {
        const nub = place(blobPath(bx0, by0 + 0.03, 0.028, 0.036, { lumps: 3, amount: 0.15, noise: null }));
        paintPart(fills, spec, nub, bone, { own: true });
        ink.contour(nub, { color: ink0 });
      }
    }
    return;
  }

  // Imp horns are long, like the reference. They expand the silhouette upward considerably.
  const scale = spec.species === "imp" ? 1.8 : 1;
  const horn = spec.species === "imp" ? "L" : "M";   // an imp's horn is the one line on the board drawn at L

  for (const side of [-1, 1]) {
    const bx = side * rx * 0.6;
    const by = cy + ry * 0.82;
    const lean = noise(side * 9.1 + spec.seed * 0.0007) * 0.06;

    if (kind === "curved") {
      ink.line([
        [bx, by],
        [bx + side * 0.07 * scale, by + 0.09 * scale],
        [bx + side * 0.01 + lean, by + 0.17 * scale]
      ], { color: ink0, size: horn });
    } else if (kind === "straight") {
      ink.line([[bx, by], [bx + side * 0.05 + lean, by + 0.2 * scale]], { color: ink0, size: horn });
    } else if (kind === "antenna") {
      const tipX = bx + side * 0.05 + lean;
      const tipY = by + 0.24 * scale;
      ink.line([[bx, by], [tipX, tipY]], { color: ink0, size: "S" });
      paintPart(fills, spec, blobPath(tipX, tipY, 0.022 * scale, 0.022 * scale, { lumps: 3, amount: 0.2, noise: null }), ink0, { own: true });
    } else if (kind === "ram") {
      // Ram horn curled into a spiral
      const spiral = [];
      for (let i = 0; i <= 26; i += 1) {
        const k = i / 26;
        const angle = Math.PI * 0.5 + side * k * Math.PI * 1.7;
        const r = (0.055 + 0.02 * scale) * (1 - k * 0.72);
        spiral.push([bx + side * 0.02 + Math.cos(angle) * r * side, by + 0.02 + Math.sin(angle) * r]);
      }
      ink.line(spiral, { color: ink0 });
    } else if (kind === "crown") {
      // A row of spikes crossing the crown — going once per side would duplicate them, so only when side<0
      if (side < 0) {
        for (let i = 0; i < 5; i += 1) {
          const k = i / 4;
          const angle = Math.PI * (0.72 - 0.44 * k);
          const sx = Math.cos(angle) * rx * 0.9;
          const sy = cy + Math.sin(angle) * ry * 0.92;
          const len = 0.05 + 0.03 * Math.sin(k * Math.PI);
          ink.line([[sx, sy], [sx + Math.cos(angle) * len * 1.6, sy + Math.sin(angle) * len * 1.6]], { color: ink0 });
        }
      }
    } else {
      ink.contour(blobPath(bx, by + 0.035, 0.033 * scale, 0.045 * scale, { lumps: 3, amount: 0.15, noise: null }), { color: ink0 });
    }
  }
}
