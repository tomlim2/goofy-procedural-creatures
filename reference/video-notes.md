# Observation notes on the video reference

Taken from the original video (32 s, 812×720, supplied by the user — source unknown), pulled apart into
9 frames at 4-second intervals. Structure that the two screenshots did not show came out in the video.

## Structure

1. **A row = a fixed lane.** The species of the five rows stay fixed for the whole 32 s — kid / kid / dog /
   cat / imp. The species belongs to the row and only the individual changes.
2. **Individuals regenerate over time.** Through the loop they keep being replaced by different individuals
   within the same lane. The "own clock" applies not only to breathing and blinking but to regeneration too.

## Drawing

3. **The fill is not flat.** The inside of an area is filled with a pencil scribble or hatching, so the
   stroke direction shows. The biggest gap against the current implementation (flat fill + offset).
4. **Color accents.** It is nearly monotone, yet only 1~3 saturated colors are mixed into one board —
   a blue hat, a green beret, orange hair, red hair, a yellow scribble.
5. The paper grain is coarser and a vertical fold mark is visible.

## Parts (per lane)

6. **Dog**: long ears hanging from the side of the head (scribble-filled), a light muzzle blob plus a black
   nose dot, a short tail, a striped body.
7. **Cat**: a triangular nose, patch markings, X eyes, a tail held up. The ears are small triangles at the
   two corners of the crown — bumps in the silhouette that the outline continues into, and on a colored head
   the ear is the same color. Narrow-and-tall and wide-and-low ones are mixed, and huge ears are rare. Some
   have a small inner triangle (a double line), an ink-filled inner ear, or a tuft at the tip. There are no
   round, folded or hanging ears, and a few have round heads with no ears at all (measured across 35).
8. **Imp**: the horns are far bigger and more varied than the current ones (long devil horns, antennae with
   balls). The body is not only ink-black — **light striped bodies are mixed in too**. A horizontal row of teeth.
9. **Kid**: tear marks (vertical lines from the eye), blush and freckles, berets and knit caps.

## Rigging (confirmed by comparing frames)

One individual was tiled as 12 frames at 0.5 s/24 fps and 16 frames at 2 s/8 fps, and adjacent frames compared.
It is not a limb skeleton rig but **a face part rig plus a line boil**.

10. **Line boil.** In adjacent frames the outlines and hatching are redrawn slightly differently. The
    traditional animation boil, re-drawing the hand-shake jitter on a low period. This is the core of the
    "living drawing" feeling.
11. **Eye-openness rigging.** The eye white grows from small to saucer-wide and comes back (a startle).
    A separate axis from blinking.
12. **Held lid states.** Not only momentary blinks — a half-closed state or a squint is held for seconds.
13. **Brow state switching.** Angry ↔ neutral ↔ raised changes over time.
14. **Mouth state switching.** Line ↔ open ↔ wave changes.
15. **Eye kind switching.** An individual in the dog lane was seen alternating X eyes ↔ dot eyes.
16. Breathing is a fine up-and-down bounce. Apart from the boil the limbs are almost static.

## Torso rigging (a full-body crop plus tracking one slot for 32 s)

One slot was tracked at 1 fps for the whole 32 s, and a full-body crop compared at 3 s/10 fps.

17. **The torso has essentially no skeleton rig.** The legs are planted to the floor and there is no walking
    or jumping. The arms have no movement worth calling a pose change either. All of the body's liveliness
    comes from the fine breathing bounce plus the line boil.
18. **Measured regeneration period: 5~13 s per slot.** Over 32 s, four individuals passed through one slot
    (yellow hair → knit helmet → striped sweater → yellow beret). The timing is offset per slot, so the whole
    board does not change at once — individuals are replaced on their own clocks.
19. **Emotes.** A mark like ♥ floats above the head for a few seconds, bobbing, then disappears.
    (! and ? types were observed in other frames)
20. **A cat's tail changes angle slightly.** Closer to the boil than to a wag.
21. Color accents confirmed again: yellow hair, a highly saturated yellow beret, a brown vest — only a few
    are kept on one board through each regeneration.

## Per-species idle motion (a second, closer pass)

Re-observed from 7 sets of 4 s/8 fps tiles (2 individuals per species) plus 1 s/24 fps bursts.

26. **The quality of the motion.** The pupils and head slide smoothly frame to frame (easing, not stepping).
    Only the boil breaks up and boils, at roughly 8~12 fps. "The movement is smooth and only the lines boil"
    is the reference's texture.
27. **Face yaw.** In every species the whole set of features moves side to side within the head. It is not
    just the pupils — the eyes and mouth shift as one, faking a turned head.
28. **Smile blinks.** Some blinks close into a happy ^^ arch. Dogs hold that state for seconds.
29. **Kid — arm pose switching.** The stick arms move between down, open and raised. Side-to-side rocking,
    a fine bounce and a front-to-back sway all run together.
30. **Dog — the head roll is the dominant motion.** The head keeps rolling ±10~15° side to side and the ears
    slosh after it. Dipping downward as if sniffing is frequent too. The tail flicks intermittently.
31. **Cat — the tail is alive at all times.** Its curl slowly winds and unwinds over and over, and now and
    then snaps quickly. A wink (one eye closing), front-to-back rocking of the body and a sideways stretch
    were also observed.
32. **Imp — the mass sloshes like jelly.** The silhouette itself wobbles more than the other species', and
    the eye state (white openness, kind) cycles unusually often. A "..." muttering mark beside the mouth.

## Limbs (a third, close-up pass)

The limbs of 2 kids, a dog and an imp at 2× zoom, compared at 4 s/12 fps (48 frames).

33. **The arms stay open and only shake finely.** Kid A (arms open) barely changes angle across 48 frames —
    nothing but boil jitter. Kid B (hands behind the back) is completely still. Big joint events like raising
    an arm or waving appear nowhere across 4 individuals × 4 s.
34. **The legs are nailed to the floor.** All 4 of the dog's legs change angle by 0. The body (the back)
    wobbles finely and the legs only look like they follow. There is no frame where a foot leaves the ground.
35. **The imp's arms are short stubs.** They tremble as part of the jelly wobble, with no independent motion.
36. Conclusion: the reference's limb liveliness is **joint jitter (the boil) plus fine movement subordinate
    to the body**. Add big joint events and it is more than the reference and looks like a puppet show.
37. **There are several arm types** (joints at 4× zoom). Behind the back (disappearing behind the body) /
    a sleeve plus a round hand / a short stub plus a fist / a hanging stick / open. The types are mixed
    within one row.
38. **A leg always ends in a round foot.** There is no stick leg without a foot. Boot types exist too.
39. **A limb comes out from inside the body outline.** The shoulder and hip are inside the outline rather
    than on it, so the sleeve and leg root cover the body. That is what makes a joint look "embedded".
40. **A dog's legs are thick stubs attached under the torso, plus toe marks.**

## Variety of form

The same frames observed again for the silhouette alone.

22. **The head outline kinds really do differ.** Not only circles — rounded squares, tall rectangles,
    bottom-heavy pears, sideways-spread ellipses and flat crowns are mixed in. The outline itself creates as
    much variety as the parts do.
23. **The size contrast between neighbours is large.** Head sizes differ by 1.5~2× between adjacent seats.
    A small individual has to sit next to a huge-headed one for the board to look alive.
24. **Extremes of aspect ratio are allowed.** A tall thin individual and a sideways-spread one coexist in
    one row.
25. Hats, ears and horns change the silhouette a lot — a beret expands the width, a pot the height, dog ears
    downward, imp horns upward.

**Implementation finding:** the current code draws `SLOTS.head` (round/square/tall/pear/wide) and `draw.js`
never uses it at all — a dead slot. Every head is the same elliptical blob, differing only by proportion
jitter. It needs bringing to life with an outline generator (a superellipse blend plus taper plus lumps).
Being a drawing-only change, it does not break seeds.

## Whether it was adopted

| # | Item | Status |
| --- | --- | --- |
| 1 | Fixed lanes | **adopted** — human, human, cat, dog, imp (LANE_TABLE) |
| 2 | Individual regeneration | **adopted** — 6~14 s per slot, species kept |
| 3 | Scribble fill | **adopted** — a single zigzag stroke fill, stroke direction visible |
| 4 | Color accents | **adopted** — capped at 3 per board |
| 6 | Dog ears and muzzle | **adopted** — a hanging ear lobe plus muzzle and nose |
| 8 | Imp horns and body | **adopted** — horns 1.8×, light striped bodies half the time |
| 9 | Tears, blush, beret | **adopted** — the face2 slot plus beret |
| 10 | Line boil | **adopted** — 3 sets cycling, once every 1.5~1.9 s per individual (much slower than the reference — faster and it looks like trembling) |
| 11 | Eye openness | **adopted** — eye rig scale, the startle event |
| 12~14 | Lid, brow and mouth states | **adopted** — two state sets baked, toggled by the clock |
| 18 | Individual regeneration (5~13 s) | **adopted** |
| 19 | Emotes (♥ ! ?) | **adopted** — an emoji animation layer (a curve per kind), the idle schedule plus motion triggers (flap, think, startle, tail) |
| 22 | Head outline kinds | **adopted** — 5 kinds of superellipse + taper |
| 23 | Size contrast between neighbours | **adopted** — spread 0.34 |
| 26 | The quality of the motion (easing + boil) | **adopted** — eased transitions, boil at 8~10 fps |
| 27 | Face yaw | **adopted** — every feature (eyes, nose, mouth, brows, eyewear, cheeks, whiskers, muzzle) goes in faceGroup and is shifted on x·y and squashed slightly to turn. Gaze following plus the look state |
| 28 | Smile blinks | **adopted** — the ^^ arch, held as a state on dogs |
| 29 | Kid arm poses and rocking | **adopted** — two arm state sets toggled |
| 30 | Dog head roll and dip | **adopted** — head and body separated, rotation about the neck axis |
| 31 | Cat tail, wink, stretch | **adopted** — tail pivot meshes |
| 32 | Imp jelly and muttering | **adopted** — anti-phase scale plus the dots emoji |
| 33~36 | Limbs = jitter + subordinate | **adopted** — joint pivots are kept but the standing amplitude is at boil level (~0.01 rad), with big events under 0.5 rad at 18~90 s intervals |
| 37~40 | Limb types, feet, roots inside the outline | **adopted** — arms 4 kinds × 2 lengths, legs 5 kinds × 2 lengths, round feet/boots, leg roots inside the outline, dog stubs plus toes. Arm roots are on the torso's left/right outline (the side) — further in and it looks like it sprouts from the middle of the chest |

The video file itself is someone else's work and is not put in the repo. `.gitignore` excludes images and
video in this folder.
