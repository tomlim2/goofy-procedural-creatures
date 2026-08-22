# reference — source material

What was looked at while making menagerie, along with what was taken from it and what was deliberately left alone.

## 1. Weird Faces — Matthias Dörfelt (mokafolio)

- Source: <https://www.mokafolio.de/works/Weird-Faces>
- 2012–2013. A series of archival digital prints on paper
- Built with **Paper.js** (a vector scripting framework over HTML5 Canvas)
- The source code is not public. There is no Weird Faces repository on `github.com/mokafolio` — only
  `Paper2` (a C++ port) and `PaperJSWorkshopAustin`

Two structural points the artist has described (paraphrased from the page above, not quoted):
the faces look hand-drawn but are expressed entirely in algorithmic rules; and each facial feature has
presets that are combined at random, with the presets themselves algorithmic, so a single preset carries
endless variation.

**What was taken** — the structure of combining per-feature presets, and the principle of getting a
hand-drawn texture from rules alone, with no texture or brush images. The slot structure in
`src/character/vocabulary/slots.js` corresponds to this.

**What was not taken** — the artist's facial vocabulary and drawing style. The part kinds and the six
archetypes were put together separately for this lab. Having a torso, limbs and color is a decision here too.

**Observed directly** (features read off the images, not the artist's own description):
- The head outline is not a geometric figure. It is lumpy and squashed on one side → `blobPath`
- Hair is not filled as an area but drawn densely back and forth with a pen → `Sketch.scribble`
- Left-right asymmetry is strong. Eye size and height are openly different → `eyeSizeSkew`, `eyeHeightSkew`
- The nose is a single hooked stroke → the `nose` slot

## 2. A procedural creature grid (source unknown)

Notes from observing the original video frame by frame are in [video-notes.md](video-notes.md).

- A screenshot of a social post, supplied by the user. The original post URL was never confirmed
- The post's text: the creatures breathe, blink and glance around on their own clocks, and each one is
  a seed plus three.js code
- A 7×5 lattice, a hand-drawn floor line per cell, a paper-textured background, pencil tones and pale fills

**What was taken** — the lattice layout and the floor line, the big head + small torso + stick limb
skeleton, and the idea that **each individual moves on its own clock**. `src/motion/` corresponds to this.
Thirty-five creatures blinking at once look like a machine.

**What was not taken** — the character design. The only thing in common is the use of three.js; the
internals are unknowable.

## 3. kindergrimm — how it is drawn

- Source: <https://kindergrimm.vercel.app/how.html>
- A procedural creature page with its own "how" page — a legend of its pencil, its shapes, its materials,
  its head, its boil and its seed, every figure drawn live by the same code
- Its pencil: a filled ribbon on a 2D canvas at **62% ink**; the spine re-sampled every `max(2.2, w·.9)` px
  and bent by three summed sines per stroke (drift 1.5–3.5 · waver 5–9 · tremor 11–17, shares .55/.3/.15);
  the width breathing on two more (7.3 and 19, shares .38/.14) with a per-stroke jitter of .88–1.14; the
  ends running past where they should stop; thick lines shedding ink crumbs to ±1.05 of the half width, 45%
  of them paper-coloured squares biting back in. Three kinds from one function — `sline` (detail, the pen
  sometimes lifts) · `stroke` (mass) · `broken` (contour, 2–3 overlapping passes). A mulberry32 reseeded per
  boil frame, so the same seed gives back the same stroke crumb for crumb

**What was taken** — the line, as `Sketch.pencil()` next to `stroke()`: the two-sine wander per length, the
breathing width, the overshoot and the shed, with every number in `PENCIL` (`src/stroke.js`,
[drawing.md](../guidelines/drawing.md) § the pencil). And the idea of the page itself — `/how.html` is a
legend drawn by the code it describes, like theirs.

**What was not taken** — the 62% ink (a deliberate exclusion: our ink stays opaque), the tremor (the sizzle
was tried and rejected — the lines here are quiet), the three-role split (`sline`/`stroke`/`broken` — ours is
one `stroke()` for everything, plus the pencil), their shape recipe (the two fixed sines and the Chaikin pass;
`blobPath` keeps its noise lumps), and the canvas, media and editor systems around it.

## Image files

The original images are not kept in this folder. Both are someone else's work, so keeping them here would
amount to copying and redistributing them in the repo — better to keep them locally only and put them in
`.gitignore`.

To keep them for local reference, just drop them in this folder under names like `weird-faces.png` and
`creature-grid.png`. The repo root's `.gitignore` already excludes images in this folder, so they will not
be committed.
