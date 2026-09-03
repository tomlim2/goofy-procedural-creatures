# Character types

> Basis: `src/character/spec.js`, `src/character/vocabulary/`. When the code changes, fix this document in the same commit.

One individual is settled by **species × archetype × proportion jitter**. The species is the skeleton, the
archetype the disposition, and the jitter the silhouette. All three layers have to stack for thirty-five
creatures to look different from each other.

## The layers

| Layer | Decided per | Decided when | Role |
| --- | --- | --- | --- |
| **Species** | Row | Fixed lanes (`LANES` cycling) | The skeleton — biped/quad, color, exclusive parts, the dominant motion |
| **Archetype** | Individual | The first draw in `makeCreature` | The disposition — biasing the part weights |
| **Proportion jitter** | Individual | `makeProportions` | The silhouette — head size, asymmetry, hand shake |
| **Dimension slots** | Individual | `LATE_SLOTS` (at the very end) | Length and build, independent of form — armLength, legLength, build. Not scale: only length and width change |

Part selection priority: **species bias > archetype bias > DEFAULT_BIAS > even**. A species `forbid` overwrites deterministically after the draw.

## Species (SPECIES)

`src/character/vocabulary/species.js`. Species are **fixed lanes** — `LANES` in `spec.js` is the order, and it
cycles down the rows, wrapping at the end:

```
human · cat · pup · imp · rex · human · cat · pup · imp · rex · …
```

There is no table per row count. However many rows, the five species come round at even spacing and none goes
missing past five rows (the default 7×5 shows one row of each). Species are decided by the lane and
nothing else — there are no species weights (the old `weight` field was read nowhere and was deleted).

| Species | Skeleton | Color | Exclusive / biased parts | Dominant motion |
| --- | --- | --- | --- | --- |
| **human** | biped | The palette as-is | forbid: all horns→none, cyclops→wide, long arms (long)→medium, stilts (verylong)→long, ears none·round only (pointy, floppy, folded→round/none — animal ears are not human), tear marks (tears)→none. The rest is decided by the archetype | Side-to-side and front-to-back rocking, arm actions (waving, arms crossed, thinking…) |
| **pup** | quad | The head (fur) color (about 1/3 the black-ish FURS), the body the same or a close tone. No markings — the pattern slot is the imps' | Hanging ears (flap/long), a muzzle plus a black nose (the nose slot decides the form), the mouth above the muzzle and below the nose — w (omega), o (open), the tongue (on ^^ too), line, dot, smile; the tail skeleton flag/stubtail/ring × the skin thick/plume, patches, legs mostly stub (stick, float, boots) | The head roll at all times, sniffing dips, a held ^^ happy eye, tail flicks |
| **cat** | quad | The head (fur) color (about 1/3 the black-ish FURS), the body the same or a close tone. No markings — the pattern slot is the imps' | Triangular crown ears (pointy/fold), whiskers (length per individual — the long ones poke outside the outline), the ω, 3, meow and blep mouths (fangs and a hiss when angry), a vertical pupil (slit), the tail skeleton curl/longtail/hook/kink × the skin line/thick, legs stub·stick (float, boots) | The tail swish at all times, winks, big head tilts, stretches |
| **rex** | biped **with a tail** (the one biped allowed one — the tail gate reads `identity.tail`, draw/limbs.js) | The head and body a vivid scale color (SCALES — moss, teal, amber, coral, violet, slate; bodyRoll picks it, no extra rng) with **the pattern in a second scale color** (`palette.pattern2` — patternOf draws it instead of ink; the two are pulled apart in tone when they land close). ~94% patterned — the point of the species | A huge jaw of teeth (grimace/fangs/zigzag/open ×wide, mouth set low), small fierce eyes set high (proportions: eyeSize 0.11, eyeHeight 0.14), **tiny stubby arms** (armSpread halved; every arm form folds to stubby), thick mass legs drawn as filled shapes with three-clawed feet (a species branch in limbs.js), a counterweight tail (the skeleton 1.6× and thicker), no ears, no hair; brows allowed (angry ✓) | A slow heavy **stomp** walk (hz 1.4, big bob), a cat-cadence **anger** (fierce eyes + the clenched grid, 7.1% of ticks), a slow tail sway with tip lag, tiny-arm raises and high fives |
| **imp** | biped | The head one of the 9 DARKS (ink, brown-grey, grey-blue, purple-black, green-black…), the body 50% the head color / 30% a light tone / 20% a dark tone (the same family), the face paper-colored, the ink #1c1917 | Long horns (1.8×: curved/straight/antenna/ram/crown), a cyclops eye, **a wide mouth** (×1.3 — the tooth grid, hatching, zigzag, big fangs, an open mouth with tooth strips), stub arms — or **armless** (arms none, ≈23%), **long arms that sweep the floor (long) are imps only** (bias 3:2, 40%), and **stilts (legLength verylong — twice long) are imps only** (bias 1.5, ≈20%; humans, dogs and cats forbid it→long) | The jelly wobble at all times, frequent shivers and startles, frequent arms-up and flapping, "..." muttering |

The quad skeleton lies the body horizontally with the head on the front (left) of it. Being short, standing next
to a row of humans it drops the tier, as in the reference. It has no arms, 4 legs (a front and a hind pair) and a
tail. It follows the dimension slots too — `legLength` (short = a dachshund) and
`build` (on a quad it is body length and thickness: wide = a long body, skinny = a thin body, small = a small body).

## Archetypes (ARCHETYPES)

`src/character/vocabulary/archetypes.js`. A disposition, not a character — the only slots that go into a bias are
the ones that define that disposition. On the grid, a collision with the left or upper neighbour is re-drawn up to 8 times.

| Archetype | Weight | Disposition | Biased slots |
| --- | --- | --- | --- |
| **beast** | 3 | Horns, ears, teeth | horns(curved/straight), ears(pointy/flap), mouth(grimace/grin), nose(wedge/hook/broad), hair(spikes/hedgehog/mop), head(round/wide) |
| **scholar** | 2 | Glasses, a bob, a beret | eyewear(glasses/monocle), eyes(dot/half/sleepy), hair(bob/helmet/bangs/longbob/wisp/curly/cloud/sweep), headgear(beret), mouth(line), nose(long/hook), horns(none) |
| **trooper** | 3 | A helmet, an eyepatch, stripes, boots | headgear(helmet/cap/band/pot), eyewear(patch/goggles), head(square/block), hair(scribble/spikes/hedgehog), pattern(stripes/patch/hatch), arms(sleeve/stick), legs(boots) |
| **sprite** | 3 | Antennae, big eyes, long limbs | horns(antenna), eyes(wide/ring/spiral), head(tall/egg), body(tube), build(narrow/skinny), legs(stick/tiptoe), arms(stick/mitten), hair(none/wisp/tuft/pigtails), nose(none/dot) |
| **blob** | 2 | Wide, bald, blunt limbs | head(wide/round/pear), hair(none/tuft/mop), eyes(dot/ring/half), body(bean/dress), build(wide), legs(stub), arms(stubby), horns(none/nub) |
| **wanderer** | 2 | A band, sleepy eyes, hatching | headgear(band/pot/cap), hair(scribble/mop/curly/bun), eyes(half/sleepy/cross), pattern(hatch/stripes/patch), mouth(wave/line), body(dress/bean) |

## Proportion jitter (proportions)

`makeProportions` in `src/character/spec.js`. `rng.around(mean, spread)` clusters near the mean without leaving
the range. Most of the silhouette variety comes from here.

| Value | Mean (spread) | Meaning |
| --- | --- | --- |
| headScale | 1.04 (0.34) — blob 1.14, sprite 0.96 | Head size. The contrast between neighbours has to be large for the board to live |
| headWide | 1 (0.18) — blob 1.16 | The head's width ratio |
| headLumps / headLump | 4~7 / 0.07 (0.045) | The number and size of the lumps crumpling the outline. **Humans get ×0.5** — a smooth skull that keeps the hand-drawn wobble (bumpy belongs to imps and animals). Human outline jitter is 0.006 (0.008 on other species) |
| eyeSize | 0.17 (0.07) — sprite 0.24 | |
| eyeGap / eyeHeight | 0.42 (0.12) / 0.03 (0.09) | |
| eyeSizeSkew / eyeHeightSkew | 0 (0.22) / 0 (0.05) | **Left-right asymmetry**. The cheapest device there is for looking hand-drawn |
| noseDrop / mouthDrop | 0.1 (0.06) / 0.3 (0.07) | The nose height against the head's centre / (mouthDrop is drawn and nothing more — the mouth's position is set by the `mouthPos` slot, between under the nose and the chin) |
| bodyScale / bodyWide | 0.52 (0.12) / 1 (0.2) | Body height and width. The `build` slot's multipliers (width 0.5~1.4, height 0.7~1.15) are applied to both |
| legLength / armSpread | 0.3 (0.12) / 1 (0.25) | Leg length (×0.55, and a further ×0.3 when `legLength` is short) · arm length (×0.242, and a further ×1.64 when `armLength` is long) |
| bodyLen / tailLift | 1 (0.2) / 0 (1) | For quads. Bipeds draw them too (to fix the rng call count) |
| wobble | 1 (0.55) | The per-individual hand-shake multiplier. Neat ones and messy ones have to be mixed |
| `hand` | 0~100000 | The rng roll for drawing. Kept separate from the generation rng |

## The palette

| | Value | Rule |
| --- | --- | --- |
| skin | 1 of the 7 FILLS | Apricot, grey-white, tan, pink, blue-grey, sand, brown-grey. The head (fur, skin) color |
| **FURS** | 4 colors, **about 1/3** of dogs and cats | Black-ish fur — ink-brown · ashy brown-grey · blue-ink · light charcoal (luminance 75~85: lighter than the imps' ink-black and far darker than FILLS, **moderately** black). **One pick** from `FUR_POOL` (8 nulls + 4 colors) settles both "is it black" and "which black" (fixing the rng call count). On an individual with a color accent on the skin, the accent wins |
| cloth | Humans: 1 of the FILLS, different from skin | Clothes have to differ from the skin for the body to read |
| | Dogs and cats: 50% exactly the head color / 30% a slightly darker tone (×0.9) / 20% a slightly lighter tone (×1.06) | Being fur, the body has to be the same or close to the head to read as one body |
| | Imps: 50% exactly the head color / 30% a light tone (×1.35) / 20% a dark tone (×0.75) | Being a mass, the same. Settled after a color accent has landed on the head, so the body follows |
| ink | 1 of the 4 INKS | All dark brown-black. Imps are pinned to #1c1917 (darker than the head) |
| **DARKS** | 9 colors | The dark palette for imp heads only. Ink · brown-black · brown-grey · light brown-grey · grey-blue · blue-grey · grey · purple-black · green-black. The body only shifts tone from here (`shade`) |
| **hair** | 1 of the 12 HAIRS, from a weighted bag (`HAIR_POOL`, 25 entries) | Black-brown · dark brown · brown · chestnut · light brown · dark blonde · blonde · auburn · ginger · ash · grey · white (luminance 43~183, straddling DARKS and FILLS). It was `palette.ink` and nothing else, so **every head on the board wore the same black**. Browns and blacks carry the bag and the rest is seasoning. **Drawn by a hash of `hand`, not by the rng** — so it was added without moving one roll ([../determinism.md](../determinism.md)). A colour landing within 45 luminance of the head it sits on steps along the bag to the first entry that reads (never brightened: multiplying clipped it to raw yellows the paper cannot hold). A pop aimed at the hair wins, and is pulled apart in tone if it lands on the head's own luminance |
| accent | 1 of the 4 ACCENTS | Hat and band colors |
| **pop** | 5 POPS, at 14% probability, targeting hair/headgear/skin | A saturated color accent. **Capped at 3 per board** (`makeGrid` switches off the excess). Landing on the skin with luminance < 120, the face ink switches to the light color (`faceInk`) |

**Light ink on a dark surface.** At luminance < 120, the lines on that surface go to light ink (#e9e3d5) — the
face is decided by the head color (`faceInk`) and body markings by the body color (`patternOf`).
Black-furred dogs and cats and imps all ride the same rule. Objects (an eyepatch, a hat, a lens) and lines over a
white fill (teeth) are the exception — they keep their own color or the dark ink ([rules.md](rules.md)).

## Paint (paint.js)

A part is filled from the individual's own box of colours — skin, cloth, hair, accent, a pop when it has one —
and `paint` is the choice of **which**. `PAINT_DEFAULTS` names what each paintable part took before paint
existed (head and ears the skin, hair the hair, the headgear the accent or a pop aimed at it, the body the
cloth), so a generated spec carries no `paint` and draws exactly as it did; the editor writes `spec.paint[part]`
only when a hand picks another box, and `paintOf(spec, part)` is what the drawing reads. One region per part
for now — a part is one colour. A part that paints more than one thing is inspected on its own before it gets
a second region, and a part not in `PAINTABLE` is not offered a paint at all.

## Identity

`identity` in `species.js`. The species invariants census checks.

| Species | skeleton | horns | eyes | arms | tail | ears | Other |
| --- | --- | --- | --- | --- | --- | --- | --- |
| human | biped | none | not cyclops | ● | ✗ | none·round only (no animal ears) | armLength medium only |
| pup | quad | none | not cyclops | ✗ | ● | flap·long·pointy(·Mid)·round(·Mid)·fold(·Mid) | hair·brow none (it is fur, not hair) |
| cat | quad | none | not cyclops | ✗ | ● | pointy · pointyMid · pointyBig (triangular ears only) | hair·brow none |
| imp | biped | (free) | (free) | ●/✗ (none allowed) | ✗ | none·pointy | The head is dark (luminance<90) |
| rex | biped | none | not cyclops | ● (always stubby, medium) | **●** (the one biped with one) | none | hair·brow — hair none; legLength not verylong |

## Constraints (applyConstraints)

Combinations that break the drawing when they appear together. **Never re-drawn; overwritten deterministically.** In order:

1. **Species forbid** (species.js) — first of all. human horns→none, cyclops→wide, long arms→medium, ear boundaries; pup horns, hair and brows→none, cyclops→dot, ear boundaries; cat horns, hair and brows→none, cyclops→slit, ear boundaries (hanging ears→crown ears); imp ear boundaries (none and small pointy only)
2. Helmet and pot → no hair. Hat and band → short hair only (bob, wisp, sweep, tuft, scribble, curly, bangs, longbob, helmet; a band also allows cloud and hedgehog)
3. Mohawk and bun → no hat. Crown horns → no hat, hair none/tuft only
4. Antennae → no ears, at 75% probability
5. Eyepatch → which side is settled here (patchSide ±1, 99 when there is none — avoiding a clash with a cyclops's side 0)
6. Closed eyes + angry brows → brows flat
7. Cyclops → no eyewear
8. Glasses and goggles → no brows, at 60% probability
9. Body color (`makeCreature`): an imp's head is 1 of the DARKS and the body the head color / a light tone / a dark tone (50/30/20). A dog's or cat's body is the head color / a dark tone / a light tone (50/30/20). Settled after the color accent
10. After drawing the dimension slots (`LATE_SLOTS`), the species forbid runs **once more** — so those slots are restricted too
11. If a pair of glasses' or goggles' lenses overlap (the eye gap < the sum of the lens radii), eyewear → none — decided with `eyeGeometry` after the proportions are settled
12. An eyepatch goes to none on mismatched eyes (|eyeSizeSkew| > 0.09 or |eyeHeightSkew| > 0.03), and to none if the patch (1.5r) laps onto the other eye — after the proportions are settled, with no rng

## Houses — a category, not a creature

`src/house/index.js` — the sixth lane (`LANES`: … imp · rex · **house**), so a 9×6 board ends on a street;
the SPECIES card's HOUSE previews a whole board of them. A house is **not a living thing**: it has form only —
no face, no clock, no motion, no high fives — and the scene stands it up as a static item (three boil frames of
one layer, `scene/index.js buildHouse`): its lines boil because the boil is the medium's, not the occupant's.

Rolled form: roof gable · steep · flat · round (dome) × windows square · round · wide (1~3, cross panes, never
over the door) × an arched or square door on either side with a knob × a chimney with two still smoke rings
(60%, not on a dome), dimensions jittered. Colors: walls from FILLS, roofs from ACCENTS + mid DARKS + the brick
and ochre POPS, the door an ACCENT; walls filled with a goofy material at a value step of their own (never
black — a black house swallows its door). Nothing in `character/` or `motion/` knows houses exist; the grid
(`makeGrid`) builds one when the lane says so, and the neighbour-clash re-draw works off `archetype:
"house-<roof>"` so two same roofs keep apart.
