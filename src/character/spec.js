// Roll → creature spec. Where this lab is won or lost.
//
// Draw the slots by plain even random and around the thirtieth creature you get "the one I just saw".
// So three layers are stacked.
//   1. archetype        — the disposition is settled first and the choice made inside it
//   2. constraints      — combinations that cannot appear together are cleared away
//   3. proportion jitter — most of the silhouette variety comes from continuous values

import { makeRng } from "../rng.js";
import { SLOTS, LATE_SLOTS, ARCHETYPES, SPECIES, DEFAULT_BIAS, FILLS, INKS, ACCENTS, POPS, DARKS, FUR_POOL, SCALES, HAIR_POOL } from "./vocabulary/index.js";
import { shade, luminance, tint, hexToRgb } from "../color.js";
import { layout, eyeGeometry } from "./draw/layout.js";
import { LENS_SCALE } from "./draw/face.js";
import { MARKS, PALETTE, IMP_INK } from "./vocabulary/palette.js";
import { makeHouse } from "../house/index.js";

// **Every colour a creature carries is a PALETTE entry** (vocabulary/palette.js). A tone derived from another — a body "a shade
// lighter than the head", a pop pulled apart from the skin it sits on — is snapped to the entry nearest it (by distance in RGB),
// never kept as a hex of its own: the editor's swatches are the palette, and a colour off it had no swatch to answer to.
// `pool` narrows the candidates (a second scale that has to read against the cloth)
export function nearestOf(hex, pool = PALETTE) {
  const [r, g, b] = hexToRgb(hex);
  let best = pool[0];
  let bestD = Infinity;
  for (const c of pool) {
    const [cr, cg, cb] = hexToRgb(c);
    const d = (cr - r) ** 2 + (cg - g) ** 2 + (cb - b) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
// A tone of a colour, in the palette: shade it, then take the nearest entry (which may be the colour itself)
const toned = (hex, factor) => nearestOf(shade(hex, factor));
// The entries that read against a colour — at least 40 of luminance away from it
const readsAgainst = (hex) => PALETTE.filter((c) => Math.abs(luminance(c) - luminance(hex)) >= 40);

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
// Overwriting deterministically rather than re-rolling the random is what keeps rolls reproducible.
// The species forbid table. Reads forbid from species.js and overwrites deterministically (no rng).
// Restrictions like "no horns on humans" and "a cyclops eye is imps only" all live there — never hardcoded here.
export function applyForbid(parts, speciesName) {
  const forbid = (SPECIES.find((s) => s.name === speciesName) || {}).forbid || {};
  for (const [slot, table] of Object.entries(forbid)) {
    if (table[parts[slot]] !== undefined) parts[slot] = table[parts[slot]];
  }
}

// A 0~1 settled by the roll alone — **no rng call**, so it costs nothing from the sequence and the count can
// never move. `n` keeps the call sites apart so two constraints on one creature do not agree by accident.
// This is what every conditional coin-flip in applyConstraints uses: firing rng only when a condition holds
// makes the call count depend on that condition, and flipping it shifts every draw after (determinism.md)
const settled = (roll, n) => (Math.imul((roll ^ (n * 0x27d4eb2d)) >>> 0, 0x9e3779b1) >>> 9) / 8388608;

// It takes no rng: every decision in here is either a fixed overwrite or settled() off the roll
// The rules on the **late** slots — run after they are rolled (makeCreature draws LATE_SLOTS after applyConstraints, so a rule
// written there would never see them). Hair is three slots (front · back · top), the back and the top late. Every rule here
// is a fixed overwrite, never a roll (the rule at the top of this file)
export function applyLateConstraints(parts) {
  // A helmet or a pot covers the head: there is nowhere for hair to squeeze out
  if (parts.headgear === "helmet" || parts.headgear === "pot") {
    parts.hairFront = "none"; parts.hairBack = "none"; parts.hairTop = "none";
  } else if (parts.headgear !== "none" && parts.headgear !== "halo") {
    // (not the halo — it floats above the head and covers nothing, so any hair keeps)
    // With a hat or a band the front and the back keep — bangs and a bob's hem come out from under a hat — but a top that
    // stands up through the hat cannot: a bun, an apple top, a spiked band go. The hoods and the hedgehog suit a band (the
    // reference) and only a band
    const through = ["bun", "apple", "appleBig", "spikes", "mohawk", "hedgehog", "cloud"];
    if (parts.headgear === "band") through.splice(through.indexOf("hedgehog"), 2);   // hedgehog and cloud stay under a band
    if (through.includes(parts.hairTop)) parts.hairTop = "none";
    if (parts.hairTop === "helmet" && parts.headgear !== "band") parts.hairTop = "none";   // a hood under a hat is two hats
  }
  // A mohawk, a bun or an apple top wears nothing (with a hat on they are already gone, above — this is the bare head's rule)
  if (["mohawk", "bun", "apple", "appleBig"].includes(parts.hairTop)) parts.headgear = "none";
  // A spiked top or a hood has no bangs: the spikes stand where a fringe would root, and a hood covers the forehead itself.
  // A mohawk is the whole hair — nothing behind it either
  if (["spikes", "mohawk", "hedgehog", "helmet", "cloud"].includes(parts.hairTop)) parts.hairFront = "none";
  if (parts.hairTop === "mohawk") parts.hairBack = "none";
  // A back never draws the cap (draw/hair.js): a back with no front and no crown top hangs behind a bare head, and the roll
  // leaves it so — the three slots are independent, and what the front is is the front slot's alone
  return parts;
}

export function applyConstraints(parts, speciesName, roll) {
  // The species forbid table is applied first. It has to come first so the later constraints (antennae removing ears, and so on)
  // do not misfire on a forbidden value.
  applyForbid(parts, speciesName);

  // The hair's rules are applyLateConstraints — the back and the top are late slots, rolled after this runs

  // With antennae there are no ears as well. The silhouette gets messy.
  if (parts.horns === "antenna" && settled(roll, 1) < 0.75) parts.ears = "none";

  // An eyepatch covers one eye. Which side is settled here.
  // A cyclops has side 0, so the sentinel for "no patch" must not be 0.
  parts.patchSide = parts.eyewear === "patch" ? (settled(roll, 2) < 0.5 ? -1 : 1) : 99;

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
  if ((parts.eyewear === "glasses" || parts.eyewear === "goggles") && settled(roll, 3) < 0.6) {
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
    // differed by species, roll reproduction would come apart.
    bodyLen: rng.around(1, 0.2),
    tailLift: rng.around(0, 1),

    // The arms' rest pose. Separate from form (the arms slot). Which pose an individual
    // takes as its default — most let them hang, some rest with them open or behind the back.


    // Every individual shakes by a different amount. Some are neat, some are a mess.
    wobble: rng.around(1, 0.55),
    hand: rng.int(0, 100000)
  };
}

// **A ghost collapses to one pale tone.** Skin, cloth, hair, accent and the lizard's second scale all become
// the same colour, and any pop is dropped — an accent is the opposite of what this is. The tone is picked off
// hand, so the slot costs no rng beyond its own draw at the end of the sequence.
// The ink is pinned to the **darkest** of the INKS rather than whatever the roll drew: everything else about
// a ghost is pale and washed out, and the four inks run from luminance 35 to 61 — on the lightest of them the
// eyes, nose, mouth and brows came out brown-grey on cream and the face lost its grip. Black against pale is
// the whole read.
// The goofy material is untouched, so the surface still hatches, dabs or speckles over the flat colour.
// It is a **pure function of the pre-ghost palette** so the parts gallery can re-apply it when it swaps the
// slot on a spec it already built — it overrides parts, not the palette, and without this the one slot the
// board has for a whole-creature look could not be judged in the tool that judges looks
const GHOST_INK = INKS.reduce((a, b) => (luminance(b) < luminance(a) ? b : a));   // the darkest of the four
export function ghostPalette(base, kind, hand) {
  if (!kind || kind === "none") return base;
  const pick = (Math.imul((hand ^ 0x1b873593) >>> 0, 0x9e3779b1) >>> 9) / 8388608;
  // **White, and above the paper.** The board's paper is luminance 233 and this used to be shade(MARKS.white,
  // 0.94~1) — luminance 227~242 — so more than half of all ghosts came out DARKER than the sheet they are drawn
  // on and read as grey blobs rather than as white ones. Tinted the other way instead, the whole band sits clear
  // of the paper (244~250) and a ghost is white against it whatever the roll drew. It stays a band and not one
  // value so two ghosts side by side are not the same swatch, but the band is narrow: a ghost is a ghost
  const tone = tint(MARKS.white, 0.15 + pick * 0.5);
  return {
    ...base, skin: tone, cloth: tone, hair: tone, accent: tone,
    pattern2: base.pattern2 ? tone : base.pattern2,
    pop: null,
    ink: GHOST_INK,
    // No warm blood in it. The blush pink is one of the fixed few (a blush is pink because a blush is pink), and
    // this is the one palette that overrules it: the cheeks, the tongue, the nose and the inside of the ears all
    // take the ink. A pink flush is the one colour that says a thing is alive, and this one is not.
    // Only a ghost's palette carries the key at all — everything else falls through to MARKS (palette.js blushOf)
    blush: GHOST_INK
  };
}
// A ghost's line is the **hairline** — PENCIL_SLINE, laid once at a third of the board's width, and the pen
// lifts now and then so it comes open for a width or two. That lifting is the broken quality the kind was for;
// PENCIL_BROKEN gave it by stacking three passes, which on a creature this pale read as a thick doubled contour
// rather than as something barely there. Thin and interrupted is the ghost — heavy and interrupted is not
export function ghostOutline(kind) { return !kind || kind === "none" ? undefined : "PENCIL_SLINE"; }
// **Every line a ghost draws is black.** Not just its outline: the brows a dark creature would have drawn in
// light ink, a horn's own colour, an accent, a pattern's — on a ghost they are all laid on one pale tone, and
// anything but the ink comes out pale on pale and is not there. It rides on the sketch beside the outline kind
// (medium/outlines.js) so it reaches every line at once. Fills are untouched: a ghost is a pale body with black
// lines on it, and the body is still the fills' job
export function ghostInk(kind) { return !kind || kind === "none" ? undefined : GHOST_INK; }

// **A ghost is downcast, and that is settled in the parts, not in any expression.** It has no expressions at all
// (motion/table.js), so whatever mouth and brow it was drawn are the face it wears for good — and a grinning
// ghost is a cartoon, not a ghost. The smiles are struck out, and so is the angry brow: anger is a feeling and
// this one has none, where `worry` (the inner ends up) is the very shape of gloom.
// The replacement comes out of **the pool that individual would have drawn from** — the same four-step
// resolution as pickSlot, species over archetype over default — so a downcast cat is still drawn like a cat and
// never lands on an imp's mouth. Deterministic (settled off the roll, no rng): `ghost` is a late slot, so by the
// time this runs the sequence is finished and a re-roll here would shift nothing, but a draw is a draw
const SMILING_MOUTHS = ["smile", "grin", "omega", "three", "blep", "tongue"];
const DOWNCAST_BROWS = ["none", "flat", "worry"];
function gloomify(parts, species, archetype, roll) {
  const poolFor = (slot, banned) => {
    const bias = species.bias[slot] || archetype.bias[slot] || DEFAULT_BIAS[slot];
    const kept = (bias ? bias.map(([value]) => value) : SLOTS[slot]).filter((v) => !banned.includes(v));
    return kept.length ? kept : SLOTS[slot].filter((v) => !banned.includes(v));
  };
  const step = (slot, banned, n) => {
    const pool = poolFor(slot, banned);
    parts[slot] = pool[Math.floor(settled(roll, n) * pool.length) % pool.length];
  };
  if (SMILING_MOUTHS.includes(parts.mouth)) step("mouth", SMILING_MOUTHS, 6);
  if (!DOWNCAST_BROWS.includes(parts.brow)) step("brow", ["angry"], 7);
}
// Is this individual a ghost? One definition, because three places outside the spec ask: the scene, when it
// builds the clock (a ghost only floats — motion/table.js ghostMotion), the high five (a ghost never fives)
// and the sim that gates it
export function isGhost(spec) { return !!(spec && spec.parts && spec.parts.ghost && spec.parts.ghost !== "none"); }

export function makeCreature(roll, speciesName = "human") {
  const rng = makeRng(roll);
  const species = SPECIES.find((s) => s.name === speciesName) || SPECIES[0];
  const archetype = pickArchetype(rng);

  const parts = {};
  for (const slot of Object.keys(SLOTS)) {
    if (LATE_SLOTS.includes(slot)) continue;   // drawn at the very end (below)
    parts[slot] = pickSlot(rng, species, archetype, slot);
  }
  applyConstraints(parts, species.name, roll);

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
    else if (bodyRoll < 0.8) palette.cloth = toned(darkHead, 1.35);   // the palette colour nearest a slightly lighter tone
    else palette.cloth = toned(darkHead, 0.75);                        // …nearest a slightly darker one
    // The ink goes darker than the head — so the outline is not lost in it
    palette.ink = IMP_INK;
  } else if (species.name === "pup" || species.name === "cat") {
    // Black-ish fur (about 1/3) — individuals with a color accent on the skin are left alone (the accent winning stands out more on the board)
    if (darkFur && !(palette.pop && palette.pop.target === "skin")) palette.skin = darkFur;
    // Dogs and cats: half the time the body is exactly the head (fur) color; otherwise a tone in the same family
    if (bodyRoll < 0.5) palette.cloth = palette.skin;
    else if (bodyRoll < 0.8) palette.cloth = toned(palette.skin, 0.9);   // the palette colour nearest a slightly darker tone
    else palette.cloth = toned(palette.skin, 1.06);                       // …nearest a slightly lighter one
  } else if (species.name === "rex") {
    // The rex: the head and body are a vivid scale color (SCALES) and the pattern is drawn in a SECOND scale
    // color (pattern2 — draw/body.js patternOf), never the ink: that pair is the species' whole point.
    // No rng of its own — the scale rides bodyRoll and the walk to the second rides the darkHead pick, both
    // drawn above for every species (the call count stays fixed). A color accent landing on the skin still wins
    const scaleIdx = Math.min(SCALES.length - 1, Math.floor(bodyRoll * SCALES.length));
    if (!(palette.pop && palette.pop.target === "skin")) palette.skin = SCALES[scaleIdx];
    const darkIdx = Math.max(0, DARKS.indexOf(darkHead));
    if (darkIdx % 3 === 0) palette.cloth = palette.skin;
    else if (darkIdx % 3 === 1) palette.cloth = toned(palette.skin, 0.88);   // the palette colour nearest a slightly darker tone
    else palette.cloth = toned(palette.skin, 1.1);                            // …nearest a slightly lighter one
    // The second scale — a different entry, stepped from the first by the dark pick; pulled apart in tone
    // when the two land too close for the pattern to read
    let second = SCALES[(scaleIdx + 1 + (darkIdx % (SCALES.length - 1))) % SCALES.length];
    if (Math.abs(luminance(second) - luminance(palette.cloth)) < 40) second = nearestOf(shade(second, luminance(palette.cloth) > 140 ? 0.72 : 1.35), readsAgainst(palette.cloth));
    palette.pattern2 = second;
  }

  const proportions = makeProportions(rng, archetype, species.name);

  // **Hair colour.** Read out of HAIR_POOL by a hash of hand and **not by the rng** — a value the roll
  // does not draw costs no rng call, so the whole board kept its rolls when this was added
  // (guidelines/determinism.md). It used to be palette.ink, which is why every head wore the same black.
  // A hair that lands within 45 luminance of the head it sits on is stepped away from it: dark hair on an
  // imp's ink head, or a white one on a pale face, is a mass with no edge either way. A colour accent aimed
  // at the hair still wins — that is the accent's whole job
  const hairRoll = (Math.imul((proportions.hand ^ 0x27d4eb2d) >>> 0, 0x9e3779b1) >>> 9) % HAIR_POOL.length;
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
    if (Math.abs(luminance(hair) - luminance(palette.skin)) < 40) hair = nearestOf(shade(hair, luminance(palette.skin) > 140 ? 0.7 : 1.4), readsAgainst(palette.skin));
  }
  palette.hair = hair;

  // Slots added later. Drawing them here is what keeps the rolls of the earlier parts, colors and proportions (slots.js LATE_SLOTS).
  // The species forbid runs once more — so it applies to these slots too.
  for (const slot of LATE_SLOTS) parts[slot] = pickSlot(rng, species, archetype, slot);
  applyForbid(parts, species.name);
  applyLateConstraints(parts);

  // **A ghost collapses to one tone.** Skin, cloth, hair, accent and the lizard's second scale all become the
  // same colour, and any pop is dropped — an accent is the opposite of what this is. The tone is picked off
  // hand (no rng), so the slot cost one draw at the very end of the sequence and nothing after it moved.
  // A **dark** ghost turns its ink light as well: a dark outline on a dark body is no outline at all, and the
  // broken stroke this kind exists for would be invisible. faceInk then follows the board's own rule (head
  // luminance < 120 → light), which is exactly "the face marks in the opposite tone".
  // The goofy material is untouched, so the surface still hatches, dabs or speckles over the flat colour
  const palette0 = { ...palette };            // the palette before the ghost collapse — the gallery re-applies from here
  Object.assign(palette, ghostPalette(palette0, parts.ghost, proportions.hand));
  // Every line this creature draws is the BROKEN hold. It rides on the spec so each Sketch made for it can
  // take it (stroke.js), which is what keeps it to this creature — BOARD_LINES is the whole board's switch
  const outline = ghostOutline(parts.ghost);
  const lineInk = ghostInk(parts.ghost);   // every line black on a ghost (medium/outlines.js sketch.inkColor)
  // A ghost's eyes are always **hollow** — the empty eye, a white and a rim with the pupil taken out. Nothing
  // is looking back, which is the whole idea. A deterministic overwrite (no rng), and it lands here rather
  // than in applyConstraints because `ghost` is a late slot and is not drawn yet when that runs. It has to be
  // before eyeGeometry below, which the eyewear constraints measure
  if (parts.ghost !== "none") {
    parts.eyes = "hollow";
    gloomify(parts, species, archetype, roll);
  }

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
    roll,
    outline,
    lineInk,
    palette0,
    species: species.name,
    archetype: archetype.name,
    parts,
    proportions,
    palette,
    // Face ink — when the head color is dark (imp ink-black, or blue, green and red-brown accent skins: luminance < 120) the features are drawn in light ink instead of black.
    // Otherwise a black line is lost on a deep color and the eyes and mouth do not read.
    // The imp clause is a species fact — an imp's head is ink-black and that IS the species — but it stops being
    // true of a **ghost** imp: its colour collapsed to one pale tone like everything else, and the light ink then
    // drew its mouth and its under-eye circles in near-white on near-white and they disappeared. The shortcut
    // only holds while the head really is dark; a pale one falls through to the luminance rule like any other.
    // (An imp is forbidden the ghost slot on the board — but the parts gallery draws a species' forbidden values
    // too, and that is the tool this repo judges form in)
    faceInk: (species.name === "imp" && !isGhost({ parts })) || luminance(palette.skin) < 120 ? MARKS.light : null
  };
}

// Roll placement for the grid.
//
// Give the rolls as plain base+0, base+1… and archetypes clump, so a whole row
// ends up looking alike. Each is built ahead of time and re-drawn if it collides with a neighbour.
// Fixed lanes. From the top: human, cat, dog, imp, rex — and a street of HOUSES as the sixth lane (a 9×6
// board shows it; houses are not creatures — src/house/index.js). Below that the same order keeps cycling.
// There is no table per row count — however many rows, the five species come round at even spacing and none goes missing past five rows.
export const LANES = ["human", "cat", "pup", "imp", "rex", "house"];

export function laneSpecies(rows) {
  return Array.from({ length: rows }, (_, r) => LANES[r % LANES.length]);
}

// The roll of the cell at index i. Spreading by a large odd multiplier is what keeps neighbouring cells from
// landing on neighbouring rolls — plain base+0, base+1… made archetypes clump into rows.
export function cellRoll(baseRoll, index) {
  return (baseRoll + index * 2654435761) >>> 0;
}

// The default cast for a board grown from one base roll: a roll and a species for every cell. Row species are
// fixed lanes — from the top, human, cat, dog, imp, rex and house cycle row by row. Give only a species name
// and every row is filled with that species (for the preview: judging colour and part distribution needs one
// species standing 54 to a board).
//
// **This is all a base roll does.** It names a starting spec for each cell and then has no further say: the
// cell is its spec, and the roll is only where that spec came from (guidelines/determinism.md).
export function boardCells(baseRoll, count, columns, only = null) {
  const rows = Math.ceil(count / columns);
  const rowSpecies = only ? Array(rows).fill(only) : laneSpecies(rows);
  return Array.from({ length: count }, (_, i) => ({
    roll: cellRoll(baseRoll, i),
    species: rowSpecies[Math.floor(i / columns)]
  }));
}

// A board from an explicit cast. A cell is either a roll with the species to draw it as, or a whole `spec` —
// one made by hand in the editor, or read back from a file. Nothing on one cell can reach another, which is
// the point: the same cell draws the same character wherever it sits on the board.
export function makeBoard(cells) {
  return cells.map((cell) => {
    if (cell.spec) return cell.spec;
    return cell.species === "house" ? makeHouse(cell.roll) : makeCreature(cell.roll, cell.species);
  });
}

export function makeGrid(baseRoll, count, columns, only = null) {
  return makeBoard(boardCells(baseRoll, count, columns, only));
}
