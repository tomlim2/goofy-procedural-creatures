# Parts catalog

> Basis: `src/character/vocabulary/slots.js`, `src/character/draw/`. When the code changes, fix this document in the same commit.

The full list of `SLOTS` in `src/character/vocabulary/slots.js`. 28 slots, 207 parts. Drawing is `src/character/draw/` (a section = a file: `head.js` the outline and ears ·
`hair.js` hair · `headgear.js` hats and horns · `face.js` eyes, brows, eyewear, nose, muzzle, cheeks and whiskers · `mouth.js` the mouth · `faceStates.js` the brow and mouth state sets · `body.js` the body and markings · `limbs.js` limbs and the tail).

**The rule**: a slot holds **form (what it looks like)** only. Pose and action are `motion/` states (see [rules.md](rules.md)).
The draw order is the declaration order of `SLOTS` and that *is* the roll — reordering **breaks existing rolls**. Append a new slot to `LATE_SLOTS`
so it is drawn at the very end and existing boards are preserved ([../determinism.md](../determinism.md)). The list below is grouped by body part, so it
differs from the declaration order.

**The head and the face are different rigs.** The head (outline, hair, hat, horns, ears) is baked into `headGroup` and the face (eyes, brows, eyewear, nose, cheeks, mouth, whiskers, muzzle) into
`faceGroup` — a face turn (motion) shifts the features alone, as one ([../rig.md](../rig.md)). Static eyes are **one layer per eye** — so a wink can turn one side
into an arch by switching off only that eye ([rules.md](rules.md) § a face part has to be visible in every state).

## Head

### head — the outline (7)
Built from `blobPath`'s superellipse (angularity), taper (the top/bottom width ratio) and size multipliers. The `HEAD_SHAPES` table.

| Value | square | taper | rx / ry | Impression |
| --- | --- | --- | --- | --- |
| round | 0 | 0 | 1 / 1 | A circle |
| square | 1.5 | 0 | 1 / 0.96 | A rounded square |
| tall | 0.9 | −0.05 | 0.86 / 1.22 | A tall rectangle |
| pear | 0.25 | +0.3 | 1 / 1.06 | A bottom-heavy pear |
| wide | 0.7 | +0.1 | 1.28 / 0.9 | Spread sideways |
| egg | 0.2 | +0.28 | 0.94 / 1.14 | A tall egg |
| block | 2.2 | 0 | 1.06 / 0.98 | Almost square |

Noise lumps (headLumps) are laid on top of the head. No shading — that is the light's job ([../drawing.md](../drawing.md) § the light).

### eyes — eye kinds (20)
| Value | Drawing | Alive (pupil, blink) |
| --- | --- | --- |
| ring | White + outline + pupil | ● the eye rig |
| wide | 1.3× bigger than ring (`eyeGeometry`) | ● |
| cyclops | One central eye, 1.75× | ● (side 0) |
| oval | A tall elliptical big eye — the white 0.82r × 1.22r (`EYE_SHAPE`), the lid at that height too | ● |
| dot | A black dot | ✗ static |
| line | A flat two-dash eye — an expressionless dash | ✗ |
| happy | An always-smiling ^^ — the same shape as the happy state's smile arch, always on | ✗ (angry brow → flat) |
| hollow | An empty eye — ring with **only the pupil taken out** (white + outline). The same on every species; an imp gets a white eye too | ✗ |
| squeeze | >_< screwed shut — a bracket pointing toward the nose | ✗ (angry brow → flat) |
| side | ¬_¬ a sideways glance — half-lidded (a lower arc plus a lid line, with **the white** inside the arc) and the pupil pushed to one side (the direction is per individual) | ✗ |
| droop | ´･ω･` drooping outer corners — a dot eye plus a lid stroke falling outward (glum) | ✗ (angry → flat) |

☆_☆ star eyes and ♥_♥ heart eyes are **not eye kinds** — they are startle variants (awe, smitten). When a startle event is the star or heart variant, the eyes are switched off for 4 seconds and the
glyph is drawn in their place — a **substitution**, not a covering ([../motion/catalog.md](../motion/catalog.md) § the face, `scene/rig.js eyeFx`). Which is why static eyes are baked
separately from the face frame (the `staticEyes` frame).
| sleepy | An arc closed downward | ✗ |
| half | Half-lidded — only the **lower arc** of the lid line + **the white** inside the arc + the lid line + the pupil below the line (a line across the whole circle smears into "a circle with a line through it") | ✗ |
| spiral | A spiral — a neat spiral **winding inward in one stroke** | ✗ |
| scrawl | A circle scribbled with a crayon — **six** loops, each drawn a bit past one turn, overlaid. Each loop has its own centre, size (0.45~1.05×) and tilt, so the strokes pass over each other and the ends never meet (a Mimikyu-ish scribbled eye). Unlike the spiral, it is not concentric | ✗ |
| lidded | A heavy lid — the outline plus a **thick, sagging lid line** across the eye (sagging in the middle); **below the line is the white, above it is skin**, with the pupil peeking out below the line. If half-lidded (half) is one stroke, this is an eye with a thick lid | ✗ |
| sharp | lidded **tilted 0.34 rad toward the nose** — the outer corner lifts and the nose side drops, for a fierce impression | ✗ |
| soft | lidded **tilted 0.34 rad the other way** — the outer corner droops, for a gentle impression (the mirror of sharp) | ✗ |
| cross | X | ✗ |
| slit | An almond outline (half-height 0.7r) + **the white** inside the almond + a **filled** vertical spindle pupil (a thin stroke does not read when small) | ✗ |

The lines and pupil of a static eye with a white (hollow, lidded, sharp, soft, half, side, slit) use **the dark palette ink** — being on a white, light face ink would be lost (imps included).
**An eye with a pupil is laid on a white.** Stamp a pupil alone on skin tone and it reads as a patch, and on black fur or an imp the eye outline merges with the head.
half and side fill only **what the lower arc encloses** below the lid line; slit fills inside the almond — the lid (above the line) is skin, not eyeball, and is not filled.
When there is a white, **the outline and lid line are drawn into the fills sketch (`fills`) too** — the two static eye layers share a render order, so putting them in the ink raises the back eye's outline above the front eye's white
([rules.md](rules.md) § a face part has to be visible in every state).

**The heavy-lidded set — lidded · sharp · soft.** The three use **the same eye at different tilts**: the white, lid line and pupil are rotated as one about the eye's centre by
0 (lidded) / +0.34 rad toward the nose (sharp) / −0.34 rad the other way (soft) (`TILTED_LID`). Built as separate shapes they would not read as the same eye —
only the impression should change. **Below the lid line is the white, above it is skin** (`palette.skin`), and the ink goes **only into the outline, lid line and pupil**:
leave the top as white too and it reads as **one more white crescent** laid over the eye; fill the lid with ink and on a black head (an imp, black fur)
it merges with the head, **leaving only the white crescent**, which does not read as an eye. The skin part is closed by joining the upper portion of the outline's point array (outside ±`asin(0.16)`) to the lid line. The lid line's thickness is proportional to the eye size (≤ 0.2r) — at a fixed thickness it covers the whole white on a small eye (a cat).
Static eyes are baked in face ink (faceGroup) — so they follow the face turn. Only live eyes (`RIG_EYES`) are stood up as a separate eye rig (white, outline, pupil, lid, ^^, shut line).
The seven newer ones (oval, line, happy, hollow, and the kaomoji squeeze, side, droop) do not yet split by species — they sit in every species and archetype
bias at the same weight (1.5; hollow, squeeze, side and droop 1). (The triangle eye ◣_◢ was dropped because close-set eyes merged into one; ☆ and ♥ moved to startle variants; and the two
highlighted eyeball eyes — bead and ◕ sparkle — were dropped.)
`LINE_EYES` (sleepy, line, happy, squeeze, droop, cross, half, side) are left-right symmetric — one stroke (a lid line or an arch) defines the eye, so
if only one side is smaller or higher it reads as a mistake rather than "a smaller eye". half and side stay on this list even after gaining a white ([rules.md](rules.md)). An eye hidden by a patch is skipped with `patched(spec, eye)` — only when there is a patch (look at patchSide alone and the eye disappears along with a patch dropped late).

### brow — brows (4)
none / flat / angry (inner end down) / worry (inner end up). **Subject to state switching** — rest and alt are both baked and
the clock toggles them. The alt table: none→flat, flat→worry, angry→flat, worry→flat.


### browLength — the brow's length (3)

A late slot (the last), so nothing rolled before it moves. **short · medium · long** — 0.8 · 1 · 1.25 of the
eye it sits over (medium is exactly the length every brow had before the slot). Whatever the length, a pair
never meets: each brow is capped short of the midline between the eyes, so a long brow on close-set eyes does
not read as one brow. In the editor it is the brow's first property (PART → brow → property), not a part of
its own.

### eyewear (5)
none / glasses (two circles plus arms, the lens radius = the eye × 1.45) / goggles (big circles plus a strap round the head, × 1.75) / patch (a patch over one eye plus a diagonal strap) / monocle (one big circle plus a cord).
Glasses and goggles are **dropped when the two lenses overlap** (an individual whose eyes are close — they are never forced smaller to fit, `makeCreature` sets none once the proportions are settled).
An eyepatch is always a **black** fill (an object) — on an imp's ink-black head it gets a light rim and only the strap is light ink. **Dropped when the eyes overlap** (when the patch radius of 1.5r
laps onto the other eye — decided once the proportions are settled). An eyepatch is also **dropped on mismatched eyes** — cover one side of an individual whose eye size (`eyeSizeSkew` > 0.09) or height (`eyeHeightSkew` > 0.03) is noticeably different and the remaining
eye looks oddly large or high on its own, which reads as a mistake (set to none after the proportions are settled; patchSide is cleared too).

### hair (26)
`hair.js` — one drawing function per kind (the `HAIR` table: name → function). New hair means adding one function and putting the name in `SLOTS.hair`.
Hair is drawn across **three layers** (`drawHair(layers)`): **back hair** (back — behind the head and face, 1.55 → only what shows outside the silhouette and above the shoulders) ·
**on the scalp** (crown 2.06 — above the head ink and below the face, at the same depth as the horns) · **bangs** (front 6.55 — drawn over the face; the brows and mouth at 6.6 are drawn above the bangs).
On a face turn (fake 3D) each layer shifts by its **depth** — bangs and the scalp +0.12 (a little toward the face), back hair −0.12 (behind the head, so the other way) ([../rig.md](../rig.md) § fake 3D depth).
That is what gives long hair, twintails and a ponytail (behind) and bangs and side curtains (in front).

**Hanging hair is attached to the head and flows** (`curtain` — long, verylong). Each stroke starts on the head outline, so the top edge is round, following the skull, and it spreads a little on the way down.
Start every stroke at the same height (a straight horizontal top edge plus a constant width) and it reads not as hair but as **a folding screen**.

| Value | How |
| --- | --- |
| none | |
| bob / mop / scribble / sweep | A **scribble** covering the scalp (crown) — with volume: the arc comes down to ear height (depth 0.56~0.62; sweep 0.4) and spreads wide, plus one more arc slightly bigger than the head **behind** it (back; sweep excepted). It does not reach the eyes |
| helmet | The hood (bowl) type — dense strokes falling from the crown: the front (\|x\| < 0.8rx) is bangs (front) down to **the brow line**, the sides go below the ear (crown), and the outer boundary is behind (back). The lower boundary runs from the brow line in the middle smoothly out to below the ear (no step, no straight hem — that would make it a helmet with a brim). The tips are ragged and spread slightly to the sides |
| cloud | The curly cloud type — a big mass with a scalloped outline (head ×1.2, back) plus loop scribbles inside (crown) plus loops along the edge (back). It comes out with a band |
| long | Long straight hair — a back-hair (back) curtain: each stroke starts **on the head outline** (the crown in the middle, ear height at the sides), flows to the shoulders and spreads to 1.14× on the way down, plus an outer outline. A crown cap (crown) |
| verylong | Very long straight hair — the same curtain down to **mid-torso** (1.2×, drawn over the body). Strokes starting in the middle of the chest (within 0.5rx) are skipped — covering the whole board makes it a cape. A crown cap |
| twintails | Twintails — two tails tied high on either side of the head (with a tie) hanging back (back) plus a crown cap |
| twintailsBall | Twintails plus **a round bunch at the end** of each tail (a scribble mass plus an outline drawn twice) |
| ponytail | A ponytail — tied on one side behind the crown (per individual), rising and hanging back (back) plus a crown cap |
| apple | An apple top — a small bunch rising like an apple stem in the middle of the crown (crown, 4 strands) plus a tie. No hat |
| appleBig | A big apple top — 6 strands, 1.7× long and thick, spreading wide, plus a long tie. No hat |
| hedgehog | A hedgehog — short spikes over **the whole** crown (an outline row of 15 plus an inner row of 10, radial) |
| bangs | Bangs — a crown scribble (crown) plus a zigzag band covering the forehead (front, over the face). The hem is ragged at **the brow line** (`browLine`) |
| longbob | bangs plus thick vertical scribbles coming down both sides to near the jaw line (front — curtains covering both sides of the face and the ears) |
| bun | A bun — thinly covering the crown with one bunch on top plus a hairpin stroke. It cannot wear a hat |
| spikes / mohawk | Short strokes reaching out from the crown (11 / 7, narrow) |
| tuft / wisp | A few strands (4 / 7) |
| pigtails | Two bunches at the sides (back — behind the ears) plus a light crown (crown) |
| curly | 7 small circles along the crown |
| bobSwept / sheetsSwept | **The filled family** — hair as a SHAPE: the boundary drawn first (a closed form, contoured in the pencil's dark ink) and the inside painted with the creature's goofy material like a hat (`paintPart`), not scribbled fur. The two are told apart by the **back**: **bobSwept** a 단발 mass to just under the chin with a small A-line flare · **sheetsSwept** a pair running from just under the cheeks (`SHEET_TOP`) down to frayed, tasselled ends level with the **hip** (`box.legTop`) — landmarks rather than fixed multiples of `ry`, so the length scales with each build. A scalp piece (crown) fills the head's own top to the hairline, following the head's real outline (`grownOutline` reads `headShape`, so a square skull keeps its corners); without it the crown is bare skin and reads as balding. **Neither draws a fringe.** Four values once carried a filled panel over the forehead and it did more harm than good — they read as one value, and the panel's lower edge is a long straight line the eye takes for a hat's brim. `frontBlunt` / `frontCurtain` / `frontSwept` are still in `hair.js`, unused, until a fringe that works is found. The fill is the creature's **hair colour** (`palette.hair` — the HAIRS bag, or a pop aimed here) and the outline stays pencil-dark. **Every face-covering piece is clamped by `eyeSafeY`** — the highest eye's top plus the travel a face turn has left (≈0.14·ry) plus the pencil's bite: these fills are opaque, and dark ink drawn on a dark fill is just as gone |

**There is no filled 장발, and that is a rule rather than a gap.** A long back was built (the dome plus a sheet hanging at each side to the chest) and **removed**: the two sheets left a narrow strip open down the middle, and the torso showing through it — narrow, tapering, ending round — made an obscene silhouette on slim, skin-coloured bodies. (`sheets` runs past the torso too, but it is not the same shape: it hangs far outside the body — out to 1.44·rx against a torso half-width of 0.4–1.0·rx — so background shows either side and the torso is never framed into a shaft. The removed pair hugged it.) The fur curtains (`long`, `verylong`) do not have the problem: they are open scribble rather than opaque fill, they hang from the whole head outline instead of two side lobes, and `verylong` deliberately skips the strokes over the middle of the chest. **Two filled masses flanking a gap over the TORSO is a shape to stay away from** — a filled 장발 has to read as one piece across the back, never as a pair. `sheets` is a pair and is fine, because of where it stops: it straddles the **head**, its hem clearing the jaw by a hair, so what shows between the two is the face. (Its hem is not clamped to the shoulder — `bodyTop` is measured *above* the chin on every build, so that clamp would shrink the sheets to nothing; back hair drawing at 0.4, under the body, is what covers the rest.)

Only humans have hair (dogs, cats and the rex are all none via forbid; imps get spikes/none). Bangs, the side bob, the hood type, long hair (long, verylong), twintails (and Ball), the ponytail and the filled family (bobSwept, sheetsSwept) count as hair that may come out
from under a hat or band; cloud and hedgehog go with a band only; and mohawk, bun and the apple tops (apple, appleBig) take no hat. No hair covers the eyes — the front stops at the brow line and the sides go to the ear
([rules.md](rules.md)).

### ghost (2) — every species but the imp, about 1 in 25

`none` / `white`. The board's one **whole-creature look**: a creature that comes out as a single pale tone with every line broken, and nothing looking back.

| | |
| --- | --- |
| the colour | Skin, cloth, hair, accent and a lizard's second scale all collapse to one pale tone off `MARKS.white`, and any pop is dropped — an accent is the opposite of what this is. The tone is picked from `hand` (no rng) |
| the ink | Pinned to the **darkest** of the four INKS rather than whatever the roll drew. Everything else about a ghost is washed out, and the inks run luminance 35~61: on the lightest of them the face came out brown-grey on cream and lost its grip. Black on pale is the whole read |
| the lines | Every line — outline, brows, whiskers, limbs, hair strands, **and the eyes, nose and mouth** — is `PENCIL_SLINE`, the **hairline**: laid once at about a third of the board's width, with the pen lifting now and then so the line comes open for a width or two. That lifting is the broken quality this wants. It was `PENCIL_BROKEN` first, which gets there by stacking three passes — on a creature this pale that read as a thick doubled contour rather than as something barely there. It rides on `spec.outline`, which each `Sketch` made for that creature takes; `BOARD_LINES` is the whole board's switch and would take everyone with it. (An eye with a white draws its rim into the **fills** sketch, so that sketch carries the kind too) |
| the eyes | Always **hollow** — the empty eye, a white and a rim with the pupil taken out. Nothing is looking back, which is the idea. A deterministic overwrite, applied after the late slots (`ghost` is one, so `applyConstraints` has not seen it yet) and before `eyeGeometry`, which the eyewear constraints measure |
| the surface | **No texture at all** — the base fill and nothing laid on it (`only: "base"` from `surfaceHand`). Every tone a goofy material makes is a shade of the part's own colour, and a ghost's collapsed to one pale tone, so its fur, hatching and dust came out pale on pale and it read as a blank shape anyway. Handing the texture a tone of its own was drawn and dropped: grey read as a second outline, and once the marks took the ghost's black, graphite's rules became hard slashes ruled clean across the creature. There is nothing under a ghost's skin to hatch |
| every line black | Not the outline alone: `spec.lineInk` overrides the colour of **every** line the creature draws — the light ink a dark creature's marks take, a hat band's accent, a horn's own colour, a pattern's. On one pale tone anything but the ink is pale on pale and is not there. It sits on `Sketch.pencil`, the primitive every line ends in, and not on `outlines.js draw()`: a hat's band and its brim name a width outright and reach for `pencil` directly, and an override one level up misses exactly those. **Fills are untouched** — a ghost is a pale body with black lines on it, and the body is the fills' job |
| the mood | **Downcast, and settled in the parts.** A ghost has no expressions at all, so whatever mouth and brow it drew is the face it wears for good — and a grinning ghost is a cartoon, not a ghost. The smiling mouths (`smile` `grin` `omega` `three` `blep` `tongue`) are struck out, and so is the `angry` brow: anger is a feeling and this one has none, where `worry` (the inner ends up) is the very shape of gloom. The replacement comes from **the pool that individual would have drawn from** — species over archetype over default, the same four steps as `pickSlot` — so a downcast cat is still drawn like a cat and never lands on an imp's mouth |
| no warm blood | The blush pink is one of the fixed few (`MARKS.blush` — a blush is pink because a blush is pink), and a ghost's palette is the one that overrules it: the cheeks, the tongue, the nose and the inside of the ears all take the ink. A pink flush is the one colour that says a thing is alive. Only a ghost's palette carries a `blush` key at all; everything else falls through to `MARKS` (`blushOf` in palette.js), so nothing else moves |

**A ghost only floats.** That is the motion side of the same idea, and it lives in `motion/table.js` (`ghostMotion`) — it hangs off the floor and drifts, does not walk, sleep or sit, takes no actions and shows none of the expressions. See [../motion/catalog.md](../motion/catalog.md) § the ghost.

A **dark** kind was built too, the same idea inverted: one dark tone with every line light, the face marks coming out pale by the board's own faceInk rule. It was removed — on this paper it read as a heavy black mass rather than as a ghost.

An imp gets no ghost (`ghost: { white: "none" }`): an imp's head is ink-black and that is the species, so a pale one is not an imp. `census --check` caught it.

`ghostPalette()` and `ghostOutline()` in `spec.js` are **pure functions of the pre-ghost palette**, which the spec carries as `palette0`. That is what lets the parts gallery show the slot: it swaps a part and rebuilds nothing, so without them the row drew two identical creatures in whatever the base individual happened to be.

The slot is last in `LATE_SLOTS`, so it costs one rng draw at the very end and nothing after it moves. Measured over 600 creatures: the ghosts changed palette, and every other creature changed **nothing at all** — not a part, not a proportion, not a colour.

### headgear (11) — humans, dogs and cats; imps never (species bias)
`drawHeadgear` in `headgear.js`. none / helmet (a dome from above the brows to over the crown plus a rim and a ridge) / cap (a crown dome plus a brim to one side) / band (a forehead band) / pot (a tub rising from above the brows to higher than the crown) /
beret (a tilted disc plus a nub) / bonnet (a thick band crossing from eye level on both sides over the crown — **disabled**: it reads as frilly and is in no bias; assets and gallery only) /
crown (a band on the crown of the head with a zigzag of four points — a crumpled hand-written polygon, top ≈ crown + 0.32·ry, under the cell ceiling) /
halo (a thin ink ring floating clear above the head — ink only, a mark rather than a thing with a colour; **the one headgear that keeps every hairstyle**, `applyConstraints` exempts it because it covers nothing) /
cone (a party cone — a tall crumpled triangle on the crown leaning to one side, a pom a shade lighter at the tip) /
coronet (the monkey's little crown, measured off the reference: **four** spikes on a band about a quarter of the head's half-width — where the paper `crown` spans nearly all of it — the spikes **splaying outward** to 1.7× the band, and their tips at four **different** heights (0.80 · 1.00 · 0.93 · 0.87 of the tallest, the ripple running either way per individual), which is most of what keeps it from reading as a stamped icon. The reference's spikes rise 0.93·ry over the skull and the cell ceiling here allows about 0.45, so the height is the board's and only the proportions are the reference's). It is **filled in pieces** for the same reason the paper crown is: the V notches between the spikes are concave and a fan from the centre crosses them. The color is accent or pop.

**They all sit above the brow line** — measured from the top edge of the eyes (including eyewear, goggle, patch and monocle rims), so they never cover an individual whose eyes are set high; and their width follows the head outline's
half-width at that height, fitting the head's size and shape. A hat is a separate layer **in front of** the head (fills 2.14, ink 2.16 — it covers the outline, hair, horns and the ears' roots but cannot cover the eyes or eyewear,
[../rig.md](../rig.md)). A dog's and a cat's crown ears sit under it too — a cap worn over the ears covers them, and that is accepted, not a bug.

### horns (7)
`drawHorns` in `headgear.js`. none / curved / straight / antenna (a ball at the tip) / nub (a small bump) / ram (a spiral) / crown (a row of spikes across the crown).
Imps get 1.8×.

**A rex's horns root anywhere from the crown to the temple.** The base slides down the head's own outline per individual — from the old fixed spot (0.56·rx, 0.81·ry) to the sideburn line (0.97·rx, 0.12·ry) — and the whole horn turns by the same angle as it descends, so it keeps pointing away from the skull instead of leaning over the face. Hashed off `hand`, so it costs no rng and moved no roll. It reaches **less** far than the fixed placement did, not more (top 1.237 against 1.260, and it comes no closer to the face's centre: 0.37·rx against 0.33).

**The rex's horns are DRAGON horns** — the same slot values, redrawn by species (the rex-leg rule): filled
bone mass with an ink contour, never a line, the tail-spikes' bone. The kinds map to the maid-dragon show's
dragons: **curved** the thick pair sweeping out then up, ring-segmented (Tohru) · **straight** the straight
pair swept back (Fafnir) · **antenna** thin pale horns with one twig, half an antler (Kanna) · **ram** a tight
curl (Lucoa) · **crown** one BIG pair standing up and out (Ilulu) · **nub** small bone bumps. Bias: none 3 ·
curved 2 · antenna/straight/ram 1.5 · nub/crown 1 — about three rexes in four horned.

### ears (15)
none / round · roundMid · roundBig / pointy · pointyMid · pointyBig / flap (an arc hanging down) / long (a long lobe) / fold · foldMid · foldBig / perk · perkMid · perkBig.
round, pointy, fold and perk come in **three sizes** (1 · 1.4 · 1.8×, the same shape) — strip the Mid/Big off the value name and you have the shape (`earKind`, `EAR_SIZE`).
**fold folds on one side only** — the other is a standing ear (which side folds is per individual, from `hand`, with no rng). Differing left from right is what makes it doglike. **perk** stands on both sides.

**The per-species boundary** — which species gets which ear is drawn by `forbid.ears` in `species.js` (overwritten after the draw) and `identity.ears` (checked by census).

| Species | Ears | Where |
| --- | --- | --- |
| human | none · round (the small one only) | At the side (slightly above eye level). Animal ears (pointy, hanging, folded, long, huge) are not human — all become round/none |
| pup | flap · long · pointy(·Mid) · round(·Mid) · fold(·Mid) · perk(·Mid) | Filled ears on top of and beside the head (§ dog ears). No none and no huge ear |
| cat | pointy (the default — sides slightly concave, a blunt tip) · pointyMid (narrow and tall — opening further, +0.15 rad) · pointyBig (wide and low — a round tip and convex sides) | **Filled triangular bumps at the two corners of the crown (~35°; 30°, slightly inside, on a square head)** — the base tucked inside the outline so they are one mass with the head, the outline the same weight and drawn twice, the base laid along the tangent at the attachment point and the ear's axis halfway between that point's normal and vertical plus a per-kind opening (a round head opens them out, a flat head stands them straight, with a slight left/right difference). **Its sides are sampled, not straight**: it is the one shape on a creature that cannot be a blobPath (its base has to sit on the head outline and its tip has to be a point), and drawn as two straight runs with a single bend — 0.9px of bow at a board cell — it stood on a head of 4~7 lumps looking like a ruler's triangle. Each side is cut into 7, the bow runs a bit over 2× deeper, and a wobble off the creature's own `hand` rides on it; both are enveloped by sin(πk), which pins the base and the tip exactly where they were. All four edges of one ear (two outer, two inner) draw their own wobble, so no two cats and no two sides repeat. The inner ear is **the same shape scaled in, on the same curve** — its base at the ear's base position (0.012 inside), its width 0.62× the ear and its tip 0.7× the height. Per individual (double line 45% · fill 30% · one crease stroke 15% · none 10%). No round, fold, flap, long or none (measured across 70 reference images) |
| imp | none · pointy (the small one only) | At the side |

**cat** gets triangular ears only (measured across 35 creatures in the reference video: small triangles at the corners of the crown, the outline continuing into the ear and a colored head giving the ear the same color,
some with an inner triangle, an ink fill or a tuft at the tip). They are drawn as filled shapes on the layer **in front of** the head (front), so the head outline does not show through the ear's root.
bias pointy 3 · pointyMid 2 · pointyBig 1.5.
**pup** draws the same values as dog ears — the root is one of **two places on the head outline** — the upper corner (a bit below the crown, θ 50°: pointy, round, fold — **on a square head (square, block) it starts at
the vertex, θ 45°**) and the side (slightly out from beside the eyes, θ 88°: flap, long) — and the ear rides that point's normal **at the opposite tilt** (an axis mirrored about the vertical — triangular and round ears stand tilted up and inward, and a lobe hangs while gathering
0.25~0.35 rad inward; the triangular ear alone is the exception — its vertex is embedded and the body droops outward and down). The ear's body lies on the paper **outside** the head — an upper ear embeds its root in the outline and goes 0.02 outside, while a long ear (flap, long) hangs
0.09 clear — and it is drawn **on top of** the head (`drawPupEars`, after the head). Filled lobes: flap a hanging lobe (the reference beagle) · long down past the chin (a basset) · round a small round ear (a pug) ·
pointy the triangular ear — **its vertex embedded in the head (the corner)** with the body drooping outward and down (the base is the outer end, 0.6 rad below horizontal) ·
fold **the folded ear** (a button ear) — drawn in **head-normal coordinates**: the base embeds inside the outline along the **tangent** at the attachment point and the ear grows **along the normal** (out of the head).
Above that the flap bends toward the tangent and hangs **below the crease** — on **one ear only**, the other being a standing ear like perk ·
perk **the standing ear** — a triangle standing straight in the same normal coordinates. The root is generous (the ear is seated on the head) and the tip is **round and blunt** — a razor point reads as a horn, and wide and low becomes the round ear.
**The base of a standing ear is never a line** (perk, and the folded ear's root on both sides): the outline runs from one base corner over the tip to the other as an open stroke, and the fill covers the head outline, so the ear attaches to the head without a line across its root.
It stands **low**: 0.11 tall at size 1 (about twice the root's half-width, 0.048 × 1.1) — taller and it is a fennec's ear, not a dog's. The folded ear's standing side is this ear.
**A dog's ear has three colors.** The **front** face is the dog's own color (the head's); the **back** face is the same a shade darker (0.86×) — it is
the far side; the **inner** face is tender skin — pink (the same as the nose and blush) or the dog's color one step lighter (mixed 45% toward a pale
neutral: never darker, never neon). Which face shows is the ear's pose: a standing ear (pointy, round, perk) shows its front with the inner patch on it,
a hanging ear (flap, long) shows its back, and **the folded ear shows all three** — the standing root (front, the inner patch on it) and the flap bent over it (back).
**The inner ear** — a patch made by scaling the ear shape 0.72 **about its root (where it meets the face)**, with no outline: its base attaches at the root and it narrows going up.
Scale about the centre and it becomes a **patch hanging** mid-ear — the inner ear starts at the root. Per individual, the lighter tone 45% ·
pink 30% · none 25% (`hand`, no rng) — except on the folded ear, which always has it (its "none" falls to pink or the tone): the three colors are its design.
**Cats follow the same rule** — a triangle whose base attaches at the root is drawn inside the triangular ear (0.62× the width, 0.7× the height): double line 45% · fill 30% (pink or a tone in the same family —
toward the light side on black fur) · one crease stroke 15% (from the middle of the root to half the height) · none 10%. The inner **line** is a mark on fur and uses `spec.faceInk` —
a black line on black fur is lost (the outline meets the background, so it stays black). It is not drawn on hanging ears (flap, long) — that pose shows the ear's **outer** face. On a folded ear **the standing root is the inner face**, so it is drawn there from the root up, and
**the flap is the back face folded over**, so it takes the back color — paint it in the inner color and the drawing is inside out. The flap covers the inner patch, leaving only the root side.
Use an inward-leaning axis like the other ears and the base lifts off the scalp and looks like **a box glued on the head**;
curve the tip upward and it is a horn; reach out sideways only and it is a flag. The flap is the ear's inner face, so it is a shade darker, and the crease is **one ink stroke** — on black fur the two pieces are the same color and
without the line the fold is invisible. The root outline is **an open path** (the top edge and the outer edge above it, which the flap covers, are never stroked) — within one layer the ink sits above the fills, so
the flap's fill cannot hide the root outline ([../rig.md](../rig.md)) · no none. Species bias flap 4 · long 3 · pointy 2 · round 1.5 · fold 1.
**cat**'s pointy stands on the crown, not at the side.

Ear positions are taken on **the real head outline** (a superellipse plus the top/bottom width ratio, `headAnchor`) rather than an ellipse — on a square head a point on the ellipse is buried inside the outline.
θ is the parameter angle measured from the crown, and a square head's vertex is at θ = 45°. The normal comes from that outline too.

### nose (9)
Four lines + two nostrils + three areas + none. **All of them are proportional to the head** — at fixed coordinates they become specks on a huge head, so hook, wedge and long all read as the same nose and they disappear on a face turn
(`noseScale` = headRy / 0.31; stroke thickness does not take the multiplier — the same as the dimension-slot rule).

| Value | Human, imp | Note |
| --- | --- | --- |
| hook | A single hooked stroke — coming down from between the brows and bending left | The reference's nose |
| dot | A dot (a short thick horizontal stroke, proportional to headRx) | |
| wedge | A single ∧ | |
| long | A long nose coming down from the forehead | |
| bulb | **A button nose** — a round area. Skin tone ×0.86 fill plus a face-ink rim (on an ink-black face only a light ring is left) | Having a different silhouette from the four line noses is the reason — the mass nose |
| broad | **A broad nose** — a wide, low filled triangle ∇ (the same point layout as the cat's triangular nose, wider and in skin tones) | |
| box | **A square nose** — a rounded square area (superellipse exponent rise 2.5 — the head's square of 1.5 smears into a circle at nose size and does not separate from bulb). The same position, fill and rim as bulb | |
| nostrils | **Two nostrils only** — no nose outline, just **two watermelon seeds** (teardrops pointed at the top, `blobPath` taper 0.55) tilted 0.5 rad up and outward (＼ ／) and filled in face ink | A neighbour of dot — separated by being two seeds, the tilt and the seed shape. Seed half-height 0.052ry, spacing ±0.065rx |
| none | Nothing | |

A nose with width (bulb, broad, box, nostrils) can lap its wings onto an eye (a white) if it goes by the nose reference point alone (`noseY`, which only looks at x=0) — `bulbShape`, `broadShape`, `boxShape` and `nostrilsShape`
re-check the eye's lower edge (`eyeFloor`) at their own width (±0.8rx) and drop by that much if it touches. The faceFront layer is above the eye rig, so an area lapping onto an eye hides the white.
The mouth's position (`noseBottomY`) uses the same functions' `bottom` — have the drawing and the mouth position look at different coordinates and on a big head the mouth bites into the nose.
Distribution: bulb, broad, box and nostrils are humans only (DEFAULT_BIAS; beast biases broad). They are in no cat, dog or imp species bias — in the gallery they are drawn as a cat's triangular nose or a dog's default muzzle.
**Each species reads the same slot differently** — pup as a muzzle form (width, height, nose size) and cat as a cat nose (`catNose`):

| Value | cat |
| --- | --- |
| dot | A small **filled triangle** (drawn as a single line it is mistaken for the mouth) |
| wedge | A heart nose |
| hook | A triangle plus **a philtrum** (a short vertical line from under the nose toward the mouth) — a Y-shaped face |
| long | A wide triangle plus a long philtrum |
| none | Nothing |

A cat nose is a **pink** fill (the same color as the blush and tongue) plus a face-ink rim — it reads on a light face and on black fur alike. Its size is proportional to the head (half-width 0.1·0.13rx).
**A dog's muzzle** (the region the nose and mouth are grouped into) differs in color per individual: light cream 45% · a tone slightly lighter than the fur 30% · **black-ish** (the fur ×0.55) 25% (`muzzleGeometry.fill`, `hand`, no rng).
**It is color only, with no outline** — an outline makes it look like a board tacked onto the face. The mouth ink over the muzzle is split by the muzzle's luminance (black if light, light ink if dark), and
the nose, being an object, is always black but gets a light rim over a dark muzzle (the same rule as the eyepatch, [rules.md](rules.md)).

### face2 — cheeks and the eye area (4)
none / tears (two **waves** running down below the eye, a trickle rather than a straight fall — **humans do not have them**, forbid → none; they belong to imps) / blush (a pink ellipse on the cheek) / circles (**dark circles** — the manga tired-eye shorthand: two short arcs sagging under each unpatched eye, the lower a little narrower. **Every species can be tired** — the one face2 all five carry — and they are drawn in face ink, the tears' rule, so a dark face carries them in light ink). The cheeks sit below the (startle-widened) eye.

Cat **whiskers** are not a slot but fixed per species (`drawWhiskers`) — three strands per side in a slightly drooping fan. The length is per individual (0.42~0.92× the head's half-width), so
over half of all cats have whiskers **poking out through the head outline** (being on the face layer at 2.4, they sit above the outline and ears and reach onto the paper).

### mouth (20) × mouthPos — the mouth position (3) × mouthSize — the mouth size (3)
`mouth.js` — one drawing function per kind (the `MOUTH` table). The reference: humans default to **a very small mouth** and what stands out is **the tooth grid**, the grin and the hatching; dogs get w, o and the tongue;
cats get ω, 3, meow and blep; imps get the **wide** grid, hatching, zigzag, big fangs, and an open mouth with tooth strips.
**An open mouth is a dark-ink cavity (the palette ink) plus a white tooth strip** — fill the cavity with light face ink and an imp's face is left with nothing but an empty bright blob (which reads as a mistake).
The rim is face ink (visible only on a dark face) and the lines over the teeth are palette ink.

| Value | Shape | Mostly |
| --- | --- | --- |
| dot / line / smile / wave | A dot (a short thick bean) / a line / a smiling arc / a wave | Humans, dogs (line, dot, smile), cats (line, dot) |
| frown | ⌢ a small drooping arc | Humans |
| bracket | **)-(** — a short flat mouth with inward-bulging cheek-crease brackets. The Adventure Time "hmm…" (a closed mouth with the cheeks pressed in) | Humans (scholar) |
| open | An open mouth — **a bowl** with a straight upper lip and a rounded bottom: a dark cavity + an upper tooth strip (a white strip with four vertical lines) + the upper lip line (an elliptical blob reads as a cave and is not used) | Humans, dogs (barking), imps |
| shout | □ a square opening — a shouting mouth: **upper and lower tooth strips** inside a big angular cavity (the reference imp) plus the upper lip line | Imps |
| pout | A small startled o (outlined) | Humans |
| meow | A meow — a small filled vertical ellipse | Cats |
| omega | ω — two arcs bulging downward. On a dog, a w under the nose | Cats, dogs |
| smug | A pouting mouth — **one stroke** (y = peak·cos πt) whose middle rises and whose ends drop away. Draw the arc as two and it reads as twin humps and makes a different face (it pairs with the `sharp` eye) | Cats, humans, imps |
| three | 3 — half an ω, thicker (a pursed mouth, the kaomoji 3) | Cats, humans |
| blep | ω plus a pink tongue tip below | Cats |
| tongue | A slightly open bowl (no teeth) plus a pink tongue hanging below (with a centre line) — on a dog this is **the alt mouth for ^^** (panting) | Dogs, imps |
| zigzag | A zigzag | Imps |
| grimace | **The tooth grid** — 3~6 vertical lines (proportional to the width) inside a wide, flat rounded rectangle (white fill plus outline). The **angry mouth** for humans and dogs | Imps, humans (trooper) |
| grin | A grin — white teeth inside a wide smiling arc plus two vertical lines plus the upper line | Humans |
| scribble | A hatched mouth — five bundles of horizontal hatching | Imps, rarely humans |
| fangs | A line plus two **big** white fangs below its ends — the **angry mouth** for imps and cats (a hiss). (The spiked-teeth kind overlapped this and was dropped) | Imps |

**Position** `mouthPos` (a late slot) — **high** (0.22) · **mid** (0.5) · **low** (0.76) between the bottom of the nose (`noseBottomY`) and above the chin (headCy − 0.86·ry). With no nose, the upper limit is
the eye's lower edge or slightly below the head's centre. Dogs follow the muzzle rule (pinned below the nose). Wherever it is, it has to be below the (startle-widened) eye. A biped sits **±0.1rx off to one side** per individual (`hand`) (the reference,
no rng). **Size** `mouthSize` (a late slot) — width multipliers small 0.7 · normal 1 · wide 1.4, with a further species multiplier of 1.3 on imps. Species bias: humans small↑, imps wide↑.
A white fill (the grid, grin, fangs, tooth strips) is paper white and the rims and vertical lines over it are **the palette ink (dark)** — drawn in an imp's light face ink they are lost on the white and leave an empty white bar. The tongue is blush pink.

**State sets** (`faceStates.js`): rest / alt (`ALT_MOUTH` — dot↔line, line↔wave, smile→grin, omega↔three, frown↔smug, grimace→line, tongue→open, fangs→line, shout→open, meow·blep→omega, zigzag·scribble→wave, bracket→line, pout→dot) /
**angry** (`ANGRY_MOUTH` — grimace on humans and dogs, fangs on cats and imps) / **^^** (`HAPPY_MOUTH` — tongue on dogs only; the rest keep their rest mouth). The same kind shares a mesh.

## Body

### body (4)
bean (a crumpled ellipse) / box / dress (a bottom-heavy trapezoid) / tube (a narrow tube). Fill + outline.
A quad is a horizontal blob regardless of the slot value.

### build — the build (5)
On a biped it is the torso's **width and height**; on a quad the torso's **length and thickness** (a quad's body lies horizontally, so the silhouette's width *is* its length).

| Value | Biped: body width | Biped: body height | Biped: leg stance (against the body's half-width) | Quad: length / thickness | |
| --- | --- | --- | --- | --- | --- |
| **skinny** lanky | 0.5 (dress 0.6) — a stick torso | ×1.15 | 0.33 | 1 / 0.62 a thin body | sprite |
| narrow slim | 0.7 (dress 0.75) | ×1.08 | 0.4 — the legs draw together | 0.7 / 1 a short body | sprite |
| medium | 1 | ×1 | 0.5 | 1 / 1 | the default |
| wide broad | 1.4 (dress 1.15 — so the hem does not pass the cell) | ×0.92 stocky | 0.68 — the legs open | 1.45 / 1 a long body (dachshund, munchkin). The body's centre is pulled toward the head so the tail overruns the cell less | blob |
| **small** a small torso | 0.75 (dress 0.8) | ×0.7 | 0.45 | 0.75 / 0.75 a small body | |

Independent of form (body), so 4×5 combinations. **The leg stance (how far they open) is set here, not by the leg slot** — a wide body carries a wide stance
and a narrow body draws the legs together. The shoulder position (on the torso outline) follows along too. On a quad the front and hind leg pairs open along the body's length.
`BUILD` (biped) and `QUAD_BUILD` (quad) in `layout()`. `LATE_SLOTS`. Default weights medium 4 · narrow 1.5 · wide 1.5 · skinny 1 · small 1.
Gallery: `gallery.html?slot=build&fix=legLength:long`.

### pattern (6) — the surface, not a part. **The patterns are the imps'**
The five kinds — stripes (3 horizontal lines) / dots (4 dots) / patch (hatching on the left) / hatch (diagonals over the whole
thing) / spots (3 dalmatian spots) — are **forbidden outside imps** (species.js: they fall to none for humans, cats and dogs), so a
pattern on the board reads as an imp's marking. The sixth value is none. (A **calico** — the tricolor patch, colour regions painted
into a cat's or a dog's base as decals — was here and was removed: the whole decal machinery went with it.)
The five kinds are drawn **over** the goofy material, last of all and clipped to the contour (`paint(…, { pattern })`, `patternOn` in `medium/materials.js`; light ink when the body color's luminance < 120), under the goofy material's texture. They read as a pattern on clothes on a human body and as fur markings on a dog or cat — the same slot. A mark is surface, not form: in 3D terms it is the albedo's pattern.

### legs (6)

A **rex** leg ignores the form slot's line drawings: it is drawn as MASS — a filled tapered thigh and shin and
a big flat three-clawed foot (`limbs.js`, a species branch — the way of drawing differs). The knee and ankle
pivots are the standard ones, so it crouches and keeps its soles level like any biped.

| Value | Biped | Quad (cat, dog) |
| --- | --- | --- |
| stick | A thin line plus a round foot | A thin leg plus a round foot |
| stub | A thick line (0.019) plus a round foot | **The default** — a thick stub plus a toe tip poking forward plus two toe lines (the reference) |
| bent | A bent knee plus a round foot | Drawn as stick |
| boots | A line plus boots filled in the cloth color | Socks — small boots to the ankle |
| tiptoe | A thin line plus a foot pointing downward | Drawn as stick |
| **float** | Rayman style — no leg line, just big feet floating (radius 0.03) | Just the feet floating (0.024) |

Form only. How far they open (the stance) is set by `build` and the length by `legLength` — 6×3×5 combinations.
float hangs off the hip pivot too, so joint jitter and a foot flick make the feet bob about.

Every leg is drawn as **two bones** — the thigh (from the hip pivot) and the shin (from the **knee** at 52%,
carrying the foot) — the arm's upper/forearm arrangement, so motion can fold it (a jump's crouch, a
high five's wind-up; [../motion/catalog.md](../motion/catalog.md) § body actions). **A quad's four legs too**:
the same split, the same joint ends, the foot on its own ankle so the sole stays level however far the knee
folds. The forms are unchanged; float has no leg and so no knee.

**Which way a knee bows** is the limb descriptor's `knee`, and the scene solves the fold off it (`animate.js`).
A quad folds **forward on all four**. The animal itself folds its front elbow back against the hind stifle's
forward fold, and both were drawn here: at this scale the two opposing directions read as one leg drawn wrong
rather than as anatomy. **Cartoon license** — the drawing is chosen over the animal, and it is the *hind* leg's
direction that the pair is unified on. Unified the other way (which it was for a while) gives a quad four legs
buckling backward, the one direction a dog's leg never bends. Measured: 32 legs on 8 standing quads, all forward.

A biped carries no `knee` and falls back to `side`, so its pair bows apart into a plié — which is what a crouch
with its feet planted wants. A **floating** creature is overridden in the scene (`scene/rig.js`) to the same one
direction: there is no ground under it, and the pair has to tuck together.

**The toe points the way its own knee bows.** The foot is drawn toward that same sign in x — a quad's four toes
forward with the fold, a biped's outward with its plié, the rex's already were. Drawn the other way the toe sits
on the outside of the fold and points back along the leg it came from, which is what a leg looks like when it is
on backwards. It applies wherever a foot has a front: the quad's stub toe and its two toe lines, both boots, and
the round feet's small lean (a round foot has no toe, but it leans).

A biped pivots at the hip (0.02 above the hem). **A quad** has its two front and two hind legs **each pair together** (a beast seen from the side — the spacing within a pair is
max(0.03, 16% of the body length)), the front pair at −60% from the body's centre and the hind pair at +60%. The roots are 25% of bodyH up. Species bias: pup stub 4 · stick 2 ·
float 1.5 · boots 1; cat stub 3 · stick 3 · float 1.5 · boots 1.

### legLength (4)
| Value | Length (biped) | Length (quad) | |
| --- | --- | --- | --- |
| long | the legLength ratio × 0.55 (≈0.17) | × 0.4 (≈0.12) | the baseline |
| medium | 65% of that | 65% | |
| short | 30% of that (≈0.05) | 30% — a dachshund or munchkin | The body almost settles to the floor. **Length only, not scale** — the feet, thickness and boot height stay as they are |
| verylong | **200%** of that (≈0.33) | — | Stilts — **imps only** (humans, dogs and cats forbid it → long, checked by identity). If the head top passes the cell ceiling, `layout()` shrinks the head |

Independent of form (legs), so every leg type has a length. `layout()` multiplies it into `legTop` (`LEG_LENGTH`), so the body, head and shoulders come down together.
Quads follow it too. Being in `LATE_SLOTS`, it is drawn at the very end. Default weights long 3 · medium 2 · short 1, plus verylong 1.5 in the imp bias.
Gallery: `gallery.html?slot=legs&fix=legLength:short`.

### tail — the skeleton (7) × tailSkin — the skin (8) × tailLength — the length (3) — quads only
The skeleton is the **rest pose** (BIND, sleep) and sets the bone lengths and where the skin goes. In an awake idle a cat blends its joints 85% toward an **arch** whatever the skeleton (the motion `tailIdlePose`),
and stands it vertical on a ^^ — the skeleton's character shows in the remaining 15%, in sleep and in BIND ([../motion/catalog.md](../motion/catalog.md) § the tail).
The tail is **three slots**: skeleton, skin and length. The skeleton (`tail`) is the spine's shape (a point list), the skin (`tailSkin`) is what goes on it, and the length (`tailLength`) is
the multiplier shrinking the whole skeleton (long 1 · medium 0.7 · short 0.45 — the skin thickness is unchanged). Any skin goes on any skeleton — a plume skin on a stub skeleton
is a pom (`tailSpine`, `tubeSides` in `limbs.js`).

| Skeleton (tail) | Spine |
| --- | --- |
| curl | Rising and curling forward |
| flag | Straight up |
| longtail | Reaching far back, the tip rising |
| stubtail | Blunt (three short points) |
| hook | Standing then hooking at the tip — a question mark (cats) |
| kink | A bend at every joint (cats) |
| ring | A ring curled nearly a full turn over the back — a spitz (dogs) |

| Skin (tailSkin) | What goes on |
| --- | --- |
| line | One thin stroke (thick on a stub) — the reference default |
| thick | A filled body, thick at the root and thinning to the tip (fur color), plus an outline |
| plume | A filled body swollen in the middle plus **hairs** — fine pencil lines (0.25, under the grit's width) rooted at the tube's edge, leaning back, and three fanning past the point (bushy — a spitz or fox) |
| tuft | A thin line plus a filled tuft at the tip (a lion) |
| block | A block — a strip of constant width with a squared tip |
| wedge | A wedge — wide at the root, pointed at the tip — **disabled** (a rat tail). Assets and gallery only |
| ball | Beads — four beads along the spine (getting smaller) on a thin spine line (without it they floated behind the rump); on a stub, one pom |
| puff | A pom — a bushy rabbit tail attached near the rump regardless of the skeleton (a tuft plus fur strokes around it). Dogs |

The pivot is at the tail root. Species bias — skeleton: pup flag 4 · stubtail 3 · longtail 2 · ring 2 · curl 1 · hook 0.5 / cat curl 4 · longtail 3 · hook 2.5 · flag 2 ·
kink 1.5 · stubtail 1 (kink is cats only, ring dogs only). Skin: pup thick 3 · line 2 · plume 2 · puff 2 · tuft 1 · ball 1 · block 0.5 / cat line 3 · thick 2 · plume 1.5 ·
tuft 1 · block 0.5 · ball 0.5 · puff 0.3 (wedge is disabled; ringed was dropped — rings are the pattern's job now). Length: pup long 2 · medium 2 · short 2 / cat long 3 · medium 2 · short 1.
tailSkin and tailLength are late slots (`LATE_SLOTS`). Bipeds draw them but never render them.
The tail is drawn **behind** the torso and head (renderOrder 0.8) — the part curling over the back or lying on the body is hidden.
The tail is **an eight-bone chain under one skin** — the spine is split into 8 (`TAIL_BONES`) with a joint origin and rest-pose direction per bone, and the scene bends each joint separately (the swish,
the tip tapping, follow-through, and the raise as a straight target angle per joint — it shoots up whatever the skeleton, [../motion/catalog.md](../motion/catalog.md) § the tail).
Eight rather than four: a pose is the same curve either way, so twice the joints each turn half as far, and the arch comes out at 15~27° a joint instead of 24~51° — the range
linear blend skinning bends cleanly in. It is what let the joint cap and the rule for a joint that could not reach its pose go: with eight bones no joint needs either.
**One skin.** The skin is drawn **once along the whole spine** in the pivot's space — the tube as a **strip** between its rails on a spine re-sampled every 0.012 and
smoothed (a fan from the centre of a coarse spine throws long triangles across the bones and folds like a paddle when bent), its width **clamped by the bend** (at most
0.85 × the radius of curvature, so a tube is never thicker than its curl), two **fine** side lines (weight 0.7 — at 1 the two lines ate a thin tail's width and its tip was
a black knob), the tip, the pattern. Every triangle the tail draws carries its t along the spine as a **skin tag** (`Sketch.tags`, set by `skinT` / `stripT`) and the skinned
mesh reads its **two or three** bones from the tag (`weightsAt`: a bone covers its own eighth of the tail and reaches ±0.125 of the **tail** past each end, fading out by a
smoothstep, so a turn at one joint is spread along a stretch of tail rather than gathered at a seam) — never from the vertex's
position, which beside a tight curl picks the curl's other arm and tears the skin (`weightsOf` stays as the fallback for untagged triangles — the goofy material's own
marks over a tube, which sit inside it and so land on the right bone anyway; over a bead they take the bead's t and turn with it). A tag goes on **per vertex, not per
quad** (`Sketch.triangle(…, tags)`): a rung's point belongs to two quads, and one tag for the whole quad handed that point two different bone blends — the fill split open in
white wedges and the side lines broke into dashes at every bend (0.014 units on a 0.04-wide plume, a third of its width). The band is held in **tail units, not bone units**:
tie it to a bone's own span and adding bones makes every bend sharper rather than smoother — twice as many joints, each with half the reach (a hook went from 1270 to 1556
degrees of turn per unit of tail). The scene bends it as a
`SkinnedMesh` ([../rig.md](../rig.md)), so a bend **curves** instead of breaking — there are no seams and no caps (four rigid bone meshes opened wedges at every joint). The side lines'
ends are **joints** (`line(…, { joint })`: no overshoot, no thinning); a thin-line tail's root is a joint too and its tip runs free (the pencil's flick). A tube's tip
**tapers to a point** under the lines over 1.6 end-widths (a brush end — a disc and an arc of line were ink on ink) except block, which stays square.
**Color and pattern.** The tail is the body's color (a quad's `cloth` — the head color or a tone of it), at the head's value step like the rest of the mass. A tube carries the creature's
**pattern** (the `pattern` slot, [../drawing.md](../drawing.md) § what takes the goofy material) along itself — stripes as **rings**, dots and spots along the spine, hatch across it — in the
body's pattern ink (light on dark fur). A thin line, a tuft, beads and a pom have no area for it.

### arms — form (5) — bipeds only
| Value | Drawing |
| --- | --- |
| stick | A thin line plus a hand stroke |
| sleeve | A sleeve filled in the cloth color plus a round hand. A long sleeve shows more bare arm |
| stubby | A short thick line (0.017) plus a fist |
| mitten | A line plus a round hand |
| none | **Armless** — no limb and no arm rig. Imps only (bias 2/9 ≈ 23%; humans get stick via forbid). The arm action layer rests (the schedule still runs, so rng is unchanged) while body actions (jumping) carry on |

Three pieces are baked per arm — **the upper arm, the forearm and back (hands behind the back)**. The upper arm is baked hanging from the shoulder's origin and the forearm from the elbow's, and the rig stands them up in the bind pose (T). The shoulder is **on the torso's left/right outline** — the arm comes out of the side (the half-width per form, `SHOULDER_X`: box 0.98 · bean 0.85 · dress 0.76 · tube 0.63; at 22% height from the top). On a sleeve only the upper arm takes the cloth color; the forearm is bare.

### armLength (2)
| Value | Multiplier | |
| --- | --- | --- |
| medium | 1 — the baseline (ARM_BASE 0.242 × armSpread) | Humans, imps |
| long | 1.64 — enough to sweep the floor | **Imps only** (humans get medium via forbid). At idle the hand catches on the floor and the elbow folds outward (the floor clamp in the motion IK) |

Independent of form, so 4×2 combinations. There are only two steps — shorter than the baseline (1) and the hand is near the torso and does not read as an arm;
longer than 1.64 and it goes through the floor. Arm length is **decided by the species** — humans are always medium via forbid, and imps have a
species bias of 3:2. The archetype does not take part.

## Surface

### material (5) — a late slot

The creature's **goofy material** — what the head and the body are made of, how their areas are filled ([../drawing.md](../drawing.md) § the goofy material, the
`GOOFY_MATERIALS` table in `medium/materials.js`): **graphite** (the color hatched with thin
upright pencil strokes, weight 1.5) · **charcoal** (dusted with specks, 1) · **oil** (thick paint in a spread of
lights, 1) · **ink** (solid, scratched open, 0.8) · **watercolour** (a wash drying — one or two pale blooms, a dried edge along part of the
contour, granulation, 0.9; a first wash was dropped as blotchy and this one keeps its blooms few, the size of a brush touch, with no closed rings).
**Every creature is made of one of them.** FLAT — the fill-up with nothing laid on it — was in this slot at weight 5 and left four
creatures in five untextured; it is still a goofy material (the whites of the eyes are filled with it) but it is not something a
creature can be made of. Measured over 40 boards: graphite 26% · oil 21% · watercolour 18% · charcoal 17% · ink 17%.

### bodyMaterial (6) — a late slot

The **body's** goofy material when it is not the head's: **same** (weight 9 — three quarters of the board, one tool through) or one
of the five. A face and a torso are two surfaces and one hand may reach for a second tool between them. The head's side of the line
is the head, the ears, the horns, the hair, the hat, the muzzle, the nose and the face; the body's is the torso, the arms and hands,
the sleeves, the legs and boots, and the tail. Around a quarter of creatures come out split, and one in twelve with two *textured*
materials. The density splits along the same line, on its own slot (`bodyDensity`, below).

### density (5) — a late slot

How dark the goofy material draws this creature — **the value step itself**, one of the five, evenly weighted:
**black · hatch · scribble · stipple · light** (`medium/materials.js` `VALUES`). The roll picks it, so every step turns up on every
species — a pale skin can be hatched black and a black one grazed light. Nothing on flat. Everything on the head's side draws at
that one step, and the body's side too unless `bodyDensity` names another ([../drawing.md](../drawing.md) § the goofy material). The texture is always a tone of the part's own color, so the palette rules hold; the base stays
opaque, so neighbours still hide each other. Everything the creature fills takes a goofy material — the head, the body, the ears and their insides, the muzzle, the
hands, boots and sleeves, the tail, the hats, the eyes, the nose, the mouth — the head's or, where `bodyMaterial` splits them, the
body's ([../drawing.md](../drawing.md) § what takes the goofy material). The contour is not part of it (the goofy outline, PENCIL_STROKE).

### bodyDensity (6) — a late slot, the last

The **body's** value step when it is not the head's: **same** (weight 10 — one pressure through on five boards in six) or one of the
five steps at 0.5 each. It splits along the same line as `bodyMaterial` — the head's side keeps `density`, the body's side (the
torso, the arms and hands, the sleeves, the legs and boots, the tail) takes this — and is independent of it: a graphite head and a
graphite body can sit two steps apart, and a body of another tool can still share the head's pressure. `surfaceHand(spec, where)`
in `draw/body.js` is the one place a step is read, as `materialOf` is for the tool. The last of the late slots, so it costs one draw
at the very end and nothing before it moves; a file without it draws as `same`.

### tailDeco (7) — a late slot, the rex's

An object **worn on the tail** — the rex's dressing-up; every other species forbids the lot (a forced value in
the gallery still draws, on any tail). Drawn last in `tailSketch` so it sits on the hide, every mark carrying a
skin tag at its t — it bends with the bones like the tube it rides. Placement is on the **visible** tail
(`tVis` — where the spine clears the body's edge past the buried root), never on raw spine t: a short flag
hides a third of its spine and wore its ring inside the body.

**none** (25%) · **ribbon** — a ring round the tube and a bow standing on it, upright in screen space, one of
three shapes per individual (pointed bow · round loops · bow with hanging streamers), sized per individual ·
**plates** — 3~5 little back plates on the upper edge, stegosaur grammar, in the second scale color (they ape
the hide) · **dip** — the tip dipped in paint over the visible last half · **club** — the tip a heavy ball, in
the hide itself (the ankylosaur) · **band** — 3~5 knit rings alternating with white (the white is what keeps
it an object when the hide's own rings land in the same tone) · **spikes** — the thagomizer: two or three bone
horns at the end, leaning back, in a pale of the teeth's white.

**Colors.** The ribbon, the dip and the band take a **POP** — the bold palette, one per individual (off
`hand`, stepped when it lands within 35 of luminance of the hide). Bolder than the accents on purpose: a
dressed-up dinosaur is the point. The per-board pop cap governs whole-part accents (hair, a hat, a skin); a
deco is a few strokes. Plates keep the second scale, the club the hide, the spikes bone — those three are the
creature, not its clothes.

## Render order

The `renderOrder` table is in [../rig.md](../rig.md) § the hierarchy.
