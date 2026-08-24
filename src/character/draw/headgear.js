// Hats and horns — the things that sit on top of the head. Docs: guidelines/character/parts.md § headgear · horns
// A hat sits above the brow line (head.js browLine) and covers along the head outline shape (layout.js headShape).

import { blobPath, arcPath, crumple } from "../../shape.js";
import { paintPart } from "./body.js";
import { headShape } from "./layout.js";
import { browLine } from "./head.js";

export function drawHeadgear(ink, fills, spec, box) {
  const kind = spec.parts.headgear;
  if (kind === "none") return;
  const ink0 = spec.palette.ink;
  const pop = spec.palette.pop;
  const accent = pop && pop.target === "headgear" ? pop.color : spec.palette.accent;
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
    ink.pencil([[-w, y], [w, y + 0.006]], { color: accent, width: 0.03 });
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

  if (kind === "bonnet") {
    // Bonnet — a thick band wrapping the head. It crosses over the crown from eye level on both sides
    const rim = arcPath(0, cy, rx * 1.2, ry * 1.14, Math.PI * 1.02, -Math.PI * 0.02, 26);
    // The brim — the hat's color as a thick pencil stroke along the rim: a band, not a line (see the band above)
    ink.pencil(rim, { color: accent, width: 0.055 });
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
