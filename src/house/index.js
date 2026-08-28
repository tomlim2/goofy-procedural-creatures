// Houses — a different category from the creatures: **not a living thing**. A house has form only — no face,
// no clock, no motion; it stands still and its lines boil, because the boil belongs to the medium, not to the
// occupant (guidelines/drawing.md § the boil). It shares the creatures' medium whole — the pencil line, the
// goofy materials at a value step, the palette — so a street of them sits on the same paper as the menagerie.
//
// The category rides the lanes like a species does ("house" in LANES — the sixth lane, so a 9×6 board shows a
// street; the SPECIES card previews a whole board of them), but it is decided here and drawn here: nothing in
// character/ or motion/ knows houses exist. The scene stands one up as a static item (scene/index.js
// buildHouse) — boil frames only, no clock, no high fives.
// Docs: guidelines/character/types.md § houses

import { makeRng, makeNoise } from "../rng.js";
import { Sketch } from "../stroke.js";
import { blobPath, crumple } from "../shape.js";
import { paintWith, stepOf } from "../medium/materials.js";
import { FILLS, ACCENTS, DARKS, POPS, INKS, MARKS } from "../character/vocabulary/palette.js";
import { shade, luminance } from "../color.js";

// The house vocabulary — small on purpose. Roof kind × window kind × door side × chimney, plus jittered
// dimensions, carry a street's worth of variety
const ROOFS = ["gable", "steep", "flat", "round"];
const WINDOWS = ["square", "round", "wide"];
const HOUSE_MATERIALS = ["graphite", "ink", "oil", "charcoal"];
const VALUE_STEPS = ["hatch", "scribble", "stipple", "light"];   // never black — a black house swallows its own door

// Seed → house spec. Its own rng stream — houses share nothing with the creature draws
export function makeHouse(seed) {
  const rng = makeRng((seed ^ 0x9e3779b9) >>> 0);
  const wall = rng.pick(FILLS);
  const roofPool = [...ACCENTS, ...DARKS.slice(2, 6), POPS[2], POPS[3]];
  const roof = rng.pick(roofPool.filter((c) => c !== wall));
  return {
    kind: "house",
    species: "house",                      // the lane/preview key — the scene branches on kind, nothing else reads it as a species
    seed,
    archetype: "house-" + rng.pick(ROOFS), // for the grid's neighbour-clash re-draw only (two same roofs apart)
    roof: rng.pick(ROOFS),
    window: rng.pick(WINDOWS),
    windows: rng.int(1, 3),
    doorSide: rng.chance(0.5) ? -1 : 1,
    doorArch: rng.chance(0.6),
    chimney: rng.chance(0.6),
    w: rng.around(0.3, 0.07),              // half-width (the cell allows ±0.45)
    h: rng.around(0.52, 0.1),              // wall height
    roofH: rng.around(0.3, 0.08),
    material: rng.pick(HOUSE_MATERIALS),
    density: rng.pick(VALUE_STEPS),
    palette: {
      wall, roofC: roof,
      door: rng.pick(ACCENTS),
      ink: rng.pick(INKS),
      pop: null                            // the board's pop cap reads this off every occupant
    },
    proportions: { wobble: rng.around(1, 0.4), wobbleSeed: rng.int(0, 100000) }
  };
}

// One boil variant of the house — a single layer (fills below, ink above, one mesh in the scene).
// variant only changes the drawing noise, exactly as a creature's boil does
export function drawHouse(spec, variant = 0) {
  const rng = makeRng(((spec.proportions.wobbleSeed + 707) ^ (variant * 0x9e3779b9)) >>> 0);
  const noise = makeNoise(rng);
  const ink = new Sketch(noise, spec.proportions.wobble);
  const fills = new Sketch(noise, spec.proportions.wobble);
  const ink0 = spec.palette.ink;
  const { w, h, roofH } = spec;
  const paint = (sketch, path, color) => paintWith(sketch, path, spec.material.toUpperCase(), { color, value: stepOf(spec.density) });

  // The walls — a crumpled box up from the floor
  const wallPath = crumple([[-w, 0], [-w, h], [w, h], [w, 0]], 0.005, spec.seed % 40);
  paint(fills, wallPath, spec.palette.wall);
  ink.contour(wallPath, { color: ink0 });

  // The roof — gable/steep triangles, a flat cap, or a dome
  const rw = w * 1.14;
  let roofPath;
  if (spec.roof === "flat") roofPath = crumple([[-rw, h], [-rw, h + roofH * 0.42], [rw, h + roofH * 0.42], [rw, h]], 0.004, 3);
  else if (spec.roof === "round") roofPath = blobPath(0, h, rw, roofH, { lumps: 4, amount: 0.08, noise }).filter(([, y]) => y >= h - 0.001);
  else if (spec.roof === "steep") roofPath = crumple([[-rw, h], [0, h + roofH * 1.5], [rw, h]], 0.005, 5);
  else roofPath = crumple([[-rw, h], [0, h + roofH], [rw, h]], 0.005, 5);
  if (spec.roof === "round") roofPath = [...roofPath, [rw, h], [-rw, h]];
  paint(fills, roofPath, spec.palette.roofC);
  ink.contour(roofPath, { color: ink0 });

  // The chimney — a small box off the roof's slope, with two smoke rings hanging over it (drawn still; the
  // boil keeps them alive). Not on a dome
  if (spec.chimney && spec.roof !== "round") {
    const cx = w * 0.5;
    const base = spec.roof === "flat" ? h + roofH * 0.42 : h + roofH * (spec.roof === "steep" ? 0.6 : 0.45);
    const ch = crumple([[cx - 0.035, base - 0.02], [cx - 0.035, base + 0.11], [cx + 0.035, base + 0.11], [cx + 0.035, base - 0.02]], 0.004, 9);
    paint(fills, ch, shade(spec.palette.wall, 0.85));
    ink.contour(ch, { color: ink0 });
    ink.line(blobPath(cx + 0.01, base + 0.16, 0.02, 0.014, { lumps: 3, amount: 0.3, noise }), { color: ink0, size: "S" });
    ink.line(blobPath(cx + 0.03, base + 0.21, 0.014, 0.01, { lumps: 3, amount: 0.3, noise }), { color: ink0, size: "S" });
  }

  // The door — on its side, floor to ~55% of the wall; a knob dot
  const dw = 0.075;
  const dh = h * Math.min(0.62, 0.34 / h + 0.28);
  const dx = spec.doorSide * (w - dw - 0.05);
  const door = spec.doorArch
    ? [...crumple([[dx - dw / 2, 0], [dx - dw / 2, dh * 0.75], [dx + dw / 2, dh * 0.75], [dx + dw / 2, 0]], 0.003, 11).filter(([, y]) => y < dh * 0.74),
       ...blobPath(dx, dh * 0.72, dw / 2, dh * 0.26, { lumps: 3, amount: 0.06, noise }).filter(([, y]) => y >= dh * 0.7)]
    : crumple([[dx - dw / 2, 0], [dx - dw / 2, dh], [dx + dw / 2, dh], [dx + dw / 2, 0]], 0.003, 11);
  paint(fills, door, spec.palette.door);
  ink.contour(door, { color: ink0 });
  ink.fill(blobPath(dx + spec.doorSide * -dw * 0.28, dh * 0.45, 0.006, 0.006, { lumps: 3, amount: 0.15, noise: null }), ink0);

  // The windows — spread over the wall away from the door, each with cross panes
  const wy = h * 0.62;
  for (let i = 0; i < spec.windows; i += 1) {
    const wx = -spec.doorSide * (w * 0.45) + (i - (spec.windows - 1) / 2) * Math.min(0.16, (w * 1.1) / Math.max(spec.windows, 1));
    if (Math.abs(wx - dx) < dw + 0.07 && wy < dh + 0.1) continue;   // never over the door
    const r = 0.045;
    if (spec.window === "round") {
      const win = blobPath(wx, wy, r, r, { lumps: 4, amount: 0.08, noise: null });
      fills.paint(win, "FLAT", { color: MARKS.white });
      ink.contour(win, { color: ink0, size: "S" });
      ink.line([[wx - r * 0.8, wy], [wx + r * 0.8, wy]], { color: ink0, size: "S" });
      ink.line([[wx, wy - r * 0.8], [wx, wy + r * 0.8]], { color: ink0, size: "S" });
    } else {
      const hw = spec.window === "wide" ? r * 1.5 : r;
      const win = crumple([[wx - hw, wy - r], [wx - hw, wy + r], [wx + hw, wy + r], [wx + hw, wy - r]], 0.0025, i * 7);
      fills.paint(win, "FLAT", { color: MARKS.white });
      ink.contour(win, { color: ink0, size: "S" });
      ink.line([[wx - hw * 0.9, wy], [wx + hw * 0.9, wy]], { color: ink0, size: "S" });
      ink.line([[wx, wy - r * 0.9], [wx, wy + r * 0.9]], { color: ink0, size: "S" });
    }
  }

  return { fills, ink };
}
