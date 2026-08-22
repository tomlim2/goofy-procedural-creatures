// Palette. Docs: guidelines/character/types.md § the palette

// Only colors that hold up on paper. Push the saturation and the hand-drawn feel breaks immediately.
export const PAPER = "#efe9dd";

export const INKS = ["#2b2724", "#3a3430", "#252220", "#443c34"];

export const FILLS = [
  "#e8d5c4", // apricot
  "#d9d2c7", // grey-white
  "#cdbfa8", // tan
  "#e3c9c6", // pink
  "#c3c7c2", // blue-grey
  "#ddd0b0", // sand
  "#c9b8a8"  // brown-grey
];

// Color accents. Saturated colors that only one or two on a near-monotone board carry.
// How many are allowed on one board is controlled by makeGrid in creature.js.
// The green is an olive-sage (#6f7b57), not a leaf green — a raw green on this paper shouts louder than the other pops; it has to sit
// at the others' saturation, a green you would mix from ochre and a little blue
export const POPS = ["#4a6fa5", "#6f7b57", "#b0432e", "#c8871e", "#8a4b2a"];

// Imp heads and bodies. Not one ink black but deep grey, blue-grey, brown-grey, even purple-black.
// All dark enough to read as "black" on paper, yet different from each other when they stand side by side.
export const DARKS = [
  "#252220", // ink
  "#2b2724", // brown-black
  "#3a3430", // brown-grey
  "#443c34", // light brown-grey
  "#33383a", // grey-blue
  "#3d3f44", // blue-grey
  "#4a4340", // grey
  "#3a2f3a", // purple-black
  "#2f3a33"  // green-black
];

// Black-ish fur — dogs and cats only. It is **moderately** black: lighter than the imps' ink (DARKS, luminance 34~69) and far darker than FILLS (luminance 190~220), at luminance 75~85.
// It reads as "a black cat, a black dog" on paper without turning into a blob of ink. On this fur the face ink switches to the light side (spec.js faceInk, luminance < 120).
// FUR_POOL is the draw bag — null is mixed in so **one pick** settles both "is it black fur" and "which black" (a fixed number of rng calls, guidelines/determinism.md)
export const FURS = [
  "#4f4a44", // ink-brown
  "#57534c", // ashy brown-grey
  "#4b4d52", // blue-ink
  "#5a5450"  // light charcoal
];
export const FUR_POOL = [null, null, null, null, null, null, null, null, ...FURS];   // 4/12 ≈ 33%

// The middle tone of a calico (the calico marking) — where a real calico's orange goes. The board is monotone, so instead of a saturated color it is **a warm tan** (luminance 139): it sits between the base
// (FILLS 187~217, body tones ≥170) and the black fur (FURS 75~85), which keeps the three apart. It is not a color accent (POPS), so it does not count against the per-board cap
export const CALICO_MID = "#a3866a";

// (shade, which makes a tone in the same family, is in src/color.js — spec.js uses it to give dogs, cats and imps a body "close to" the head color)

export const ACCENTS = [
  "#8a7f72",
  "#6f7a72",
  "#8d7168",
  "#7a7686"
];
