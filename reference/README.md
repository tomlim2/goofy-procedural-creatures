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

## Image files

The original images are not kept in this folder. Both are someone else's work, so keeping them here would
amount to copying and redistributing them in the repo — better to keep them locally only and put them in
`.gitignore`.

To keep them for local reference, just drop them in this folder under names like `weird-faces.png` and
`creature-grid.png`. The repo root's `.gitignore` already excludes images in this folder, so they will not
be committed.
