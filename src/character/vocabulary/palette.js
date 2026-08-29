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
// The green is a pale sage (#b5c2a5), not a leaf green — a raw green on this paper shouts louder than the other pops; it sits
// pale and grey, almost a fill's luminance, a green you would mix from ochre, a little blue and a lot of white.
// The blue, the ochre and the clay went the same way (each at its old hue and lightness, the saturation pulled to
// S27/48/36 from S38/74/53): raw, they shouted over the board the way the leaf green did. The brick red keeps its S59 —
// it is the reference's red and the one pop that is allowed to shout
export const POPS = ["#59749b", "#b5c2a5", "#b0432e", "#b1853e", "#80543c"];

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

// Hair. It was the palette's **ink** and nothing else, so every head on the board wore the same black — the one
// pool on the board with no variety in it at all. A hair colour has two jobs the other pools do not: it has to
// cover the whole run from black to blonde (heads side by side in one shade read as one family), and it still
// has to be a colour this paper can hold — a raw yellow or a fire red shouts the way an unpulled POP does. So
// the pale end stops at a FILL's tan, never a true yellow, and the ginger keeps the brick red's restraint.
// Luminance runs 43 (black-brown) to 183 (white), which straddles DARKS (34~69) and FILLS (190~220).
export const HAIRS = [
  "#2f2a26", // black-brown
  "#3d332b", // dark brown
  "#54412f", // brown
  "#6d543c", // chestnut
  "#8a6a45", // light brown
  "#a98d5e", // dark blonde
  "#c6ac78", // blonde
  "#8c5138", // auburn
  "#a4552f", // ginger
  "#6a6560", // ash
  "#918b83", // grey
  "#bdb6ab"  // white
];
// The draw bag — browns and blacks carry the board and the rest is seasoning, the same way FUR_POOL weights
// its nulls. Read by a hash of wobbleSeed, not by the rng: hair colour was added without moving a single seed
export const HAIR_POOL = [
  HAIRS[0], HAIRS[0], HAIRS[0], HAIRS[0],
  HAIRS[1], HAIRS[1], HAIRS[1], HAIRS[1],
  HAIRS[2], HAIRS[2], HAIRS[2],
  HAIRS[3], HAIRS[3], HAIRS[3],
  HAIRS[4], HAIRS[4],
  HAIRS[5], HAIRS[5],
  HAIRS[6], HAIRS[6],
  HAIRS[7], HAIRS[8], HAIRS[9], HAIRS[10], HAIRS[11]
];

// Lizard scales — the one species whose whole point is color. Livelier than FILLS, still pulled toward the
// paper the way POPS are (a raw green shouts over the board): S ≈ 30~40, luminance 125~155 — mid tones, so the
// face keeps the dark ink and a contrasting pattern reads both ways. The pattern is drawn in a SECOND scale
// color (spec.js pattern2), never the ink — that pair is the "colorful" of the species
export const SCALES = [
  "#8aa662", // moss green
  "#5f9e8f", // sea teal
  "#c08d4a", // amber
  "#b56d4e", // coral clay
  "#8d80ab", // dusty violet
  "#7e97ad"  // sky slate
];


// **The fixed few** — colours that are not drawn from a pool. Every other colour on the board is picked by the seed; these five are
// always themselves, because the thing they paint is always itself: a blush is pink, a tooth is white, a mark on a black part is
// light. They lived as string literals in four files each until they were gathered here
export const MARKS = {
  blush: "#d9968a",    // the blush, the tongue, an inner ear
  white: "#f6f2e9",    // teeth and the mouth's grid, the eye's white, a star eye
  light: "#e9e3d5",    // light ink — a mark on a part too dark to take the palette's ink
  muzzle: "#f0ebdf",   // the palest muzzle
  heart: "#c9666a",    // a heart eye
  sweat: "#b9cbd6"     // the sweat drop's pale blue (scene/emoji.js)
};

// (shade, which makes a tone in the same family, is in src/color.js — spec.js uses it to give dogs, cats and imps a body "close to" the head color)

export const ACCENTS = [
  "#8a7f72",
  "#6f7a72",
  "#8d7168",
  "#7a7686"
];
