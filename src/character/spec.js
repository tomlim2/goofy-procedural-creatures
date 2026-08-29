// Seed → creature spec. Where this lab is won or lost.
//
// Draw the slots by plain even random and around the thirtieth creature you get "the one I just saw".
// So three layers are stacked.
//   1. archetype        — the disposition is settled first and the choice made inside it
//   2. constraints      — combinations that cannot appear together are cleared away
//   3. proportion jitter — most of the silhouette variety comes from continuous values

import { makeRng } from "../rng.js";
import { SLOTS, LATE_SLOTS, ARCHETYPES, SPECIES, DEFAULT_BIAS, FILLS, INKS, ACCENTS, POPS, DARKS, FUR_POOL, SCALES, HAIR_POOL } from "./vocabulary/index.js";
import { shade, luminance } from "../color.js";
import { layout, eyeGeometry } from "./draw/layout.js";
import { LENS_SCALE } from "./draw/face.js";
import { MARKS } from "./vocabulary/palette.js";
import { makeHouse } from "../house/index.js";

function pickArchetype(rng) {
  return rng.weighted(ARCHETYPES.map((a) => [a, a.weight]));
}

// Species skeleton > archetype disposition > default weights > even. Four steps down.
function pickSlot(rng, species, archetype, slot) {
  const bias = species.bias[slot] || archetype.bias[slot] || DEFAULT_BIAS[slot];
  if (bias) return rng.weighted(bias);
  return rng.pick(SLOTS[slot]);
}

// Tidies up combinations that break the drawing when they appear together.
// Overwriting deterministically rather than re-rolling the random is what keeps seeds reproducible.
// The species forbid table. Reads forbid from species.js and overwrites deterministically (no rng).
// Restrictions like "no horns on humans" and "a cyclops eye is imps only" all live there — never hardcoded here.
function applyForbid(parts, speciesName) {
  const forbid = (SPECIES.find((s) => s.name === speciesName) || {}).forbid || {};
  for (const [slot, table] of Object.entries(forbid)) {
    if (table[parts[slot]] !== undefined) parts[slot] = table[parts[slot]];
  }
}

// A 0~1 settled by the seed alone — **no rng call**, so it costs nothing from the sequence and the count can
// never move. `n` keeps the call sites apart so two constraints on one creature do not agree by accident.
// This is what every conditional coin-flip in applyConstraints uses: firing rng only when a condition holds
// makes the call count depend on that condition, and flipping it shifts every draw after (determinism.md)
const settled = (seed, n) => (Math.imul((seed ^ (n * 0x27d4eb2d)) >>> 0, 0x9e3779b1) >>> 9) / 8388608;

// It takes no rng: every decision in here is either a fixed overwrite or settled() off the seed
function applyConstraints(parts, speciesName, seed) {
  // The species forbid table is applied first. It has to come first so the later constraints (antennae removing ears, and so on)
  // do not misfire on a forbidden value.
  applyForbid(parts, speciesName);

  // A helmet or a pot covers the head. There is nowhere for hair to squeeze out.
  if (parts.headgear === "helmet" || parts.headgear === "pot") {
    parts.hair = "none";
  } else if (parts.headgear !== "none" && parts.headgear !== "halo" && parts.hair !== "none") {
    // (not the halo — it floats above the head and covers nothing, so any hair keeps)
    // With a hat or a band, only short hair is kept (bangs, a side bob and the hood type may come out from under a hat). A band also suits the cloud and hedgehog types (the reference)
    const short = ["bob", "wisp", "sweep", "tuft", "scribble", "curly", "bangs", "longbob", "helmet", "long", "verylong", "twintails", "twintailsBall", "ponytail",
      "bobSwept", "sheetsSwept"];   // back hair comes out from under a hat — the filled family's hem too
    if (parts.headgear === "band") short.push("cloud", "hedgehog");
    // **Deterministically, not by re-rolling** — the rule at the top of this file, which this one line used
    // to break. `rng.pick(short)` fired only when the drawn hair was unusable, so the number of rng calls
    // depended on the hair AND on the headgear; edit either pool and some seeds flip whether it fires, which
    // shifts every draw after it and hands those individuals a different face, body and palette. Measured
    // three times in one branch — adding a hair value moved 5 creatures in 600, removing two moved 2, adding
    // a headgear value moved 6 — and every one of them had flipped exactly here. A hash of the seed picks the
    // replacement now: no rng call at all, so the count cannot move whatever the pools do
    if (!short.includes(parts.hair)) {
      parts.hair = short[Math.floor(settled(seed, 4) * short.length) % short.length];
    }
  }

  // A mohawk or a bun wears nothing.
  if (parts.hair === "mohawk" || parts.hair === "bun" || parts.hair === "apple" || parts.hair === "appleBig") parts.headgear = "none";

  // With antennae there are no ears as well. The silhouette gets messy.
  if (parts.horns === "antenna" && settled(seed, 1) < 0.75) parts.ears = "none";

  // An eyepatch covers one eye. Which side is settled here.
  // A cyclops has side 0, so the sentinel for "no patch" must not be 0.
  parts.patchSide = parts.eyewear === "patch" ? (settled(seed, 2) < 0.5 ? -1 : 1) : 99;

  // Angry brows on a closed eye leave the expression unreadable.
  if (["sleepy", "happy", "squeeze", "droop"].includes(parts.eyes) && parts.brow === "angry") parts.brow = "flat";

  // Eyewear does not work on a cyclops.
  if (parts.eyes === "cyclops") parts.eyewear = "none";

  // Crown horns take up the crown.
  if (parts.horns === "crown") {
    parts.headgear = "none";
    if (!["none", "tuft"].includes(parts.hair)) parts.hair = "none";
  }

  // Eyewear overlaps the eyes, so it often covers the brows.
  if ((parts.eyewear === "glasses" || parts.eyewear === "goggles") && settled(seed, 3) < 0.6) {
    parts.brow = "none";
  }

  return parts;
}

// The continuous values that separate silhouettes. These contribute more variety than the part combinations do.
function makeProportions(rng, archetype, species) {
  const sprite = archetype.name === "sprite";
  const blob = archetype.name === "blob";
  const human = species === "human";
  // A rex head is big and wide with small eyes set high over the jaw, and its arms are TINY (means only —
  // the rng call count never branches by species, guidelines/determinism.md)
  const rex = species === "rex";

  return {
    headScale: rng.around(rex ? 1.12 : blob ? 1.14 : sprite ? 0.96 : 1.04, rex ? 0.24 : 0.34),
    headWide: rng.around(rex ? 1.12 : blob ? 1.16 : 1, 0.18),

    // How much to crumple the head outline. At 0 a geometric figure; large, a mass drawn by hand.
    // A human skull stays smooth while keeping the hand-drawn wobble — lumps halved (the bumpy ones are imps and animals). The number of rng calls is the same (only the multiplier)
    headLumps: rng.int(4, 7),
    headLump: rng.around(0.07, 0.045) * (human ? 0.5 : 1),

    eyeSize: rng.around(rex ? 0.11 : sprite ? 0.24 : 0.17, rex ? 0.04 : 0.07),
    eyeGap: rng.around(rex ? 0.5 : 0.42, 0.12),
    eyeHeight: rng.around(rex ? 0.14 : 0.03, 0.09),

    // Left-right asymmetry. The cheapest device there is for looking hand-drawn.
    eyeSizeSkew: rng.around(0, 0.22),
    eyeHeightSkew: rng.around(0, 0.05),

    noseDrop: rng.around(0.1, 0.06),
    mouthDrop: rng.around(0.3, 0.07),

    bodyScale: rng.around(0.52, 0.12),
    bodyWide: rng.around(1, 0.2),
    legLength: rng.around(0.3, 0.12),
    // Tiny rex arms — half reach, drawn stubby (the forbid): little fists it still high-fives with
    armSpread: rng.around(rex ? 0.52 : 1, rex ? 0.12 : 0.25),

    // For quad species. Biped species draw the values too. If the number of rng calls
    // differed by species, seed reproduction would come apart.
    bodyLen: rng.around(1, 0.2),
    tailLift: rng.around(0, 1),

    // The arms' rest pose. Separate from form (the arms slot). Which pose an individual
    // takes as its default — most let them hang, some rest with them open or behind the back.


    // Every individual shakes by a different amount. Some are neat, some are a mess.
    wobble: rng.around(1, 0.55),
    wobbleSeed: rng.int(0, 100000)
  };
}

export function makeCreature(seed, speciesName = "human") {
  const rng = makeRng(seed);
  const species = SPECIES.find((s) => s.name === speciesName) || SPECIES[0];
  const archetype = pickArchetype(rng);

  const parts = {};
  for (const slot of Object.keys(SLOTS)) {
    if (LATE_SLOTS.includes(slot)) continue;   // drawn at the very end (below)
    parts[slot] = pickSlot(rng, species, archetype, slot);
  }
  applyConstraints(parts, species.name, seed);

  const skin = rng.pick(FILLS);
  const palette = {
    ink: rng.pick(INKS),
    skin,
    // Clothes have to be a different color from the skin or the body does not read.
    cloth: rng.pick(FILLS.filter((c) => c !== skin)),
    accent: rng.pick(ACCENTS)
  };

  // Drawing the imp head and body colors. The number of rng calls is fixed regardless of species (the decision is below).
  const darkHead = rng.pick(DARKS);
  const bodyRoll = rng.next();
  // Black-ish fur — dogs and cats only. null is mixed into the bag, so this single pick settles both "is it black fur" and "which black" (about 1/3)
  const darkFur = rng.pick(FUR_POOL);

  // Color accents. To keep the call count fixed, two draws happen unconditionally and the decision comes after.
  const popRoll = rng.next();
  const popTarget = rng.pick(["hair", "headgear", "skin"]);
  palette.pop = popRoll < 0.14 ? { color: POPS[Math.floor(popRoll / 0.14 * POPS.length) % POPS.length], target: popTarget } : null;
  if (palette.pop && palette.pop.target === "skin") {
    // An imp head is ink-black, so a skin accent is meaningless.
    if (species.name === "imp") palette.pop = null;
    else palette.skin = palette.pop.color;
  }

  // Body color. On a human it is clothes, so a different color from the skin; but on a dog or cat it is fur and on an imp a mass, so the body has to be
  // **the same or a close color** to the head to read as one body. (Settled after a color accent has landed on the head — so the body follows.)
  if (species.name === "imp") {
    // Imps: the head is one of the 9 DARKS (ink, brown-grey, grey-blue, purple-black…). Half the time the body is exactly the head color; otherwise a tone in the same family
    palette.skin = darkHead;
    if (bodyRoll < 0.5) palette.cloth = darkHead;
    else if (bodyRoll < 0.8) palette.cloth = shade(darkHead, 1.35);   // a slightly lighter tone
    else palette.cloth = shade(darkHead, 0.75);                        // a slightly darker tone
    // The ink goes darker than the head — so the outline is not lost in it
    palette.ink = "#1c1917";
  } else if (species.name === "pup" || species.name === "cat") {
    // Black-ish fur (about 1/3) — individuals with a color accent on the skin are left alone (the accent winning stands out more on the board)
    if (darkFur && !(palette.pop && palette.pop.target === "skin")) palette.skin = darkFur;
    // Dogs and cats: half the time the body is exactly the head (fur) color; otherwise a tone in the same family
    if (bodyRoll < 0.5) palette.cloth = palette.skin;
    else if (bodyRoll < 0.8) palette.cloth = shade(palette.skin, 0.9);   // a slightly darker tone
    else palette.cloth = shade(palette.skin, 1.06);                       // a slightly lighter tone
  } else if (species.name === "rex") {
    // The rex: the head and body are a vivid scale color (SCALES) and the pattern is drawn in a SECOND scale
    // color (pattern2 — draw/body.js patternOf), never the ink: that pair is the species' whole point.
    // No rng of its own — the scale rides bodyRoll and the walk to the second rides the darkHead pick, both
    // drawn above for every species (the call count stays fixed). A color accent landing on the skin still wins
    const scaleIdx = Math.min(SCALES.length - 1, Math.floor(bodyRoll * SCALES.length));
    if (!(palette.pop && palette.pop.target === "skin")) palette.skin = SCALES[scaleIdx];
    const darkIdx = Math.max(0, DARKS.indexOf(darkHead));
    if (darkIdx % 3 === 0) palette.cloth = palette.skin;
    else if (darkIdx % 3 === 1) palette.cloth = shade(palette.skin, 0.88);   // a slightly darker tone
    else palette.cloth = shade(palette.skin, 1.1);                            // a slightly lighter tone
    // The second scale — a different entry, stepped from the first by the dark pick; pulled apart in tone
    // when the two land too close for the pattern to read
    let second = SCALES[(scaleIdx + 1 + (darkIdx % (SCALES.length - 1))) % SCALES.length];
    if (Math.abs(luminance(second) - luminance(palette.cloth)) < 40) second = shade(second, luminance(palette.cloth) > 140 ? 0.72 : 1.35);
    palette.pattern2 = second;
  }

  const proportions = makeProportions(rng, archetype, species.name);

  // **Hair colour.** Read out of HAIR_POOL by a hash of wobbleSeed and **not by the rng** — a value the seed
  // does not draw costs no rng call, so the whole board kept its seeds when this was added
  // (guidelines/determinism.md). It used to be palette.ink, which is why every head wore the same black.
  // A hair that lands within 45 luminance of the head it sits on is stepped away from it: dark hair on an
  // imp's ink head, or a white one on a pale face, is a mass with no edge either way. A colour accent aimed
  // at the hair still wins — that is the accent's whole job
  const hairRoll = (Math.imul((proportions.wobbleSeed ^ 0x27d4eb2d) >>> 0, 0x9e3779b1) >>> 9) % HAIR_POOL.length;
  let hair = HAIR_POOL[hairRoll];
  if (Math.abs(luminance(hair) - luminance(palette.skin)) < 45) {
    // Step along the pool to the first entry that reads against this head. Brightening the colour instead
    // (shade × 2.4) clipped its channels and threw out raw yellows and near-whites — exactly the colours the
    // pool is curated to keep off this paper. Every hair on the board is a HAIRS entry or a POP, nothing else
    for (let i = 1; i <= HAIR_POOL.length; i += 1) {
      const alt = HAIR_POOL[(hairRoll + i) % HAIR_POOL.length];
      if (Math.abs(luminance(alt) - luminance(palette.skin)) >= 45) { hair = alt; break; }
    }
  }
  if (palette.pop && palette.pop.target === "hair") {
    // The accent wins, but it still has to be seen: a pop that lands on the head's own luminance is a mass
    // with no edge. Pulled apart in tone the way the rex's second scale is, so it stays the accent colour
    hair = palette.pop.color;
    if (Math.abs(luminance(hair) - luminance(palette.skin)) < 40) hair = shade(hair, luminance(palette.skin) > 140 ? 0.7 : 1.4);
  }
  palette.hair = hair;

  // Slots added later. Drawing them here is what keeps the seeds of the earlier parts, colors and proportions (slots.js LATE_SLOTS).
  // The species forbid runs once more — so it applies to these slots too.
  for (const slot of LATE_SLOTS) parts[slot] = pickSlot(rng, species, archetype, slot);
  applyForbid(parts, species.name);

  // Eyewear constraints that can only be known once the eye positions are settled (after the proportions and the last slots are drawn) — overwritten deterministically (no rng)
  const eyes = eyeGeometry({ species: species.name, parts, proportions }, layout({ species: species.name, parts, proportions }));
  const hadPatch = parts.eyewear === "patch";
  if (eyes.length === 2) {
    const [a, b] = eyes;
    const gap = Math.hypot(b.x - a.x, b.y - a.y);
    // Glasses and goggles are dropped when the two lenses overlap (when the eyes are close) — overlapping rims read as a mistake. They are never forced smaller to fit the eyes
    if ((parts.eyewear === "glasses" || parts.eyewear === "goggles") && gap < (a.r + b.r) * LENS_SCALE[parts.eyewear] * 1.02) parts.eyewear = "none";
    // An eyepatch is **not put on an individual whose eyes overlap** — a patch (1.5× the eye) laid over the other eye reads as a mistake
    if (parts.eyewear === "patch") {
      const covered = eyes.find((e) => e.side === parts.patchSide) || a;
      const other = covered === a ? b : a;
      if (gap < covered.r * 1.5 + other.r + 0.004) parts.eyewear = "none";
    }
  }
  // No eyepatch on mismatched eyes (noticeably different in size or height left to right) — cover one and the remaining eye looks oddly large or high on its own, which reads as a mistake
  if (parts.eyewear === "patch" && (Math.abs(proportions.eyeSizeSkew) > 0.09 || Math.abs(proportions.eyeHeightSkew) > 0.03)) parts.eyewear = "none";
  // If the patch dropped out here, patchSide is cleared too (so the eye and brow do not skip that side)
  if (hadPatch && parts.eyewear !== "patch") parts.patchSide = 99;

  return {
    seed,
    species: species.name,
    archetype: archetype.name,
    parts,
    proportions,
    palette,
    // Face ink — when the head color is dark (imp ink-black, or blue, green and red-brown accent skins: luminance < 120) the features are drawn in light ink instead of black.
    // Otherwise a black line is lost on a deep color and the eyes and mouth do not read
    faceInk: species.name === "imp" || luminance(palette.skin) < 120 ? MARKS.light : null
  };
}

// Seed placement for the grid.
//
// Give the seeds as plain base+0, base+1… and archetypes clump, so a whole row
// ends up looking alike. Each is built ahead of time and re-drawn if it collides with a neighbour.
// Fixed lanes. From the top: human, cat, dog, imp, rex — and a street of HOUSES as the sixth lane (a 9×6
// board shows it; houses are not creatures — src/house/index.js). Below that the same order keeps cycling.
// There is no table per row count — however many rows, the five species come round at even spacing and none goes missing past five rows.
export const LANES = ["human", "cat", "pup", "imp", "rex", "house"];

export function laneSpecies(rows) {
  return Array.from({ length: rows }, (_, r) => LANES[r % LANES.length]);
}

// Give only a species name and every row is filled with that species — for the preview. Judging color and part
// distribution needs one species standing 54 to a board.
export function makeGrid(baseSeed, count, columns, only = null) {
  const creatures = [];
  const rows = Math.ceil(count / columns);

  // Row species are fixed lanes: from the top, human, cat, dog and imp cycle row by row.
  const rowSpecies = only ? Array(rows).fill(only) : laneSpecies(rows);

  for (let i = 0; i < count; i += 1) {
    const species = rowSpecies[Math.floor(i / columns)];
    let candidate = null;

    // Only up to 8 re-draws. Picking indefinitely skews the distribution instead.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const cseed = (baseSeed + i * 2654435761 + attempt * 40503) >>> 0;
      candidate = species === "house" ? makeHouse(cseed) : makeCreature(cseed, species);
      const left = i % columns === 0 ? null : creatures[i - 1];
      const up = i >= columns ? creatures[i - columns] : null;
      const clash =
        (left && left.archetype === candidate.archetype) ||
        (up && up.archetype === candidate.archetype);
      if (!clash) break;
    }

    creatures.push(candidate);
  }

  // At most 3 color accents per board. Beyond that the earlier ones are kept and the rest switched off.
  let pops = 0;
  for (const creature of creatures) {
    if (!creature.palette.pop) continue;
    pops += 1;
    if (pops > 3) creature.palette.pop = null;
  }

  return creatures;
}
