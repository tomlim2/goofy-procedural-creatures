# The name screen

> Basis: `index.html`, `src/name.js`, `src/card.js`, `src/character/name.js`, `src/medium/type.js`, `fonts/`, `scripts/names.mjs`. When the
> code changes, fix this document in the same commit.

**Type a name and draw its card.** The same name always stands up the same creature — its species, its parts, its
colours and the way it moves — on a trading card with its ♥, its moves and its rarity, and the visitor saves the card.
It is the front door (`/`): the board shows thirty-odd creatures that belong to nobody; this one is yours.

Settled with the owner (2026-09-15): the name is the seed and the species is optional, ALL first; the result is a
trading card at the card's 5:7; the front door holds nothing but the controls; SAVE keeps the card, only the card, as it
is seen; the card carries the name, its species and its rarity, and no story; the board moved to `/board.html`. After v1.0.0 the
owner asked for two more: the card is to be shared by its link, so the card drawn rides in the address (§ the screen), and the first
screen is not to be empty, so the card lies face down until a DRAW turns it over (§ the back).

## What it is not

- **Not random.** The name is the seed: like a random button, except the same name presses it the same way every time.
  A name that gave a new creature on every press would make the name decoration, and nobody could say "my name is this
  cat". There is no REDRAW for a name.
- **Not a new drawing.** No drawing, vocabulary or motion code changed for it. A name becomes a roll and a species, and
  from there it is `makeCreature` → `deriveSpec` → the scene, exactly as a board cell.
- **Not a hub.** No header, no nav, no link out. The board and the tools keep addresses of their own (§ the board's
  address) and are reached by typing them, as `/debug.html` always was.
- **Not remembered.** Nothing is kept in storage. The card drawn rides in the address instead (§ the screen), so a reload
  draws it again and a link shares it — and the name goes wherever the address goes.
- **Not filtered.** Nothing checks a name anywhere: the card says only what was typed, or what a link carried.
- **Not a story.** The card says what the creature is and what it does and tells no tale. A story a species — six
  lines each, a line for its ghost, a lore line for the blank card, in two languages — was written and dropped: more
  writing, checking and translating than the wrap-up wanted. With no sentences of its own, the card's words are the
  vocabulary's, in English, and nothing is translated — written in the goofy type (§ the type), labels in capitals.
- **Not another game's card.** It borrows the trading card's shape and its reading order — name, kind, picture, moves —
  and nothing of any game's look: no borrowed logo, symbol, typeface, colour or border. Its frame is this project's
  pencil.

## The screen

```
   before a name                            a card drawn

   [ YOUR NAME       ] [ ALL ▾ ] [ DRAW ]   [ YOUR NAME       ] [ ALL ▾ ] [ DRAW ] [ SAVE ]
        ┌──────────────────────┐                 ┌──────────────────────┐
        │                      │                 │                      │
        │      MENAGERIE       │   ── DRAW ──▶   │       the card       │
        │      TYPE A NAME     │    turns it     │        (5 : 7)       │
        │                      │      over       │                      │
        └──────────────────────┘                 └──────────────────────┘
              its back                              the creature's side
```

- **The controls, and nothing else** — the name field, the species dropdown, **DRAW**, and **SAVE** once a card stands.
  One row across the top; at 520px and under the field takes the whole width and the rest share the row under it. The
  card stands under them, sized from the height the screen leaves it and never wider than the screen (`styles.css`
  `.namecard`). Before a name it lies face down (§ the back): the screen is never empty, and DRAW turns the card over.
- **The field** — placeholder `YOUR NAME`, `maxlength="40"` (a name, not a sentence), `autocomplete="off"`,
  `spellcheck="false"`, focused when the page opens.
- **The dropdown** — `ALL · HUMAN · CAT · PUP · IMP · REX`, ALL first and chosen when the page opens: ALL lets the name
  pick the species, the rest fix it. Changing it while a card stands draws again, as DRAW does.
- **DRAW, or Enter in the field** — draws the card. A key that comes out empty (§ a name → a creature) draws nothing and
  puts the focus back in the field.
- **On Enter, not while typing.** Live, every keystroke would stand a different creature up — a Korean name passes
  through `ㅎ`, `호`, `홍` on its way — and the reveal would be a flicker of creatures that are nobody's. For the same
  reason **Enter is ignored while an input method is composing** — `event.isComposing`, or `keyCode` 229, which Safari
  sends for that Enter with `isComposing` already false: the Enter that commits a Hangul syllable must not also draw.
- **The address carries the card** — `?name=` the shown name, and `&species=` the dropdown's choice, left out on ALL as
  every screen leaves its starting values out (`character/name.js` `addressOfName`; `URLSearchParams` escapes it, so a
  name with `&`, `#`, `+` or a space in it comes back as it went). It is written in place whenever a card is drawn
  (`history.replaceState` — no history entry a name, so BACK leaves the page), and only then: a DRAW that draws nothing
  leaves the address on the card still standing, and a species picked with no card up leaves it as it was.
- **A link opened** (`nameOfAddress`) fills the field and the dropdown and draws, as DRAW would. A name longer than the
  field is cut to its 40 by whole characters, where typing would have stopped (`maxlength` holds back typing, not a value
  set from a script); a species no name can be is ALL; an address with no name leaves the card face down. Until the card is
  drawn — the type loading, on a first visit — the link's name waits in the field over the back.
- **What the address costs** is what every address costs: the name is in what gets copied, pasted and kept in a browser's
  history, and opening a link sends it, with the rest of the address, to the host serving the page. Typing a name and
  drawing it send nothing.
- **For a screen reader** — the card's words go into an `aria-live="polite"` caption, so drawing one reads out who stood
  up; the canvas is hidden from it.

## A name → a creature

`src/character/name.js`, exported from `src/character/index.js`, so the node scripts read the same mapping as the page.

| Step | Rule |
| --- | --- |
| The key (`nameKey`) | `normalize("NFKC")` → drop control and zero-width characters (`\p{Cc}`, U+200B–U+200D, U+2060, U+FEFF) → collapse every run of white space (`\s`, the ideographic space included) to one space → trim → `toLowerCase()`. `" 홍길동 "`, the decomposed (NFD) `홍길동` a copied file name carries, `Tom  Lim`, `TOM LIM` and the full-width `ＴＯＭ ＬＩＭ` are each one name |
| Refused | A key that comes out empty — `creatureOfName` returns null |
| The roll (`nameRoll`) | FNV-1a (32-bit, over the UTF-8 bytes) of `menagerie:name:v1:` + the key, through murmur3's `fmix32` finalizer — an unsigned 32-bit roll, the kind `randomRoll()` makes |
| The species (`nameSpecies`) | On ALL, the same hash of `menagerie:name:v1:species:` + the key, modulo 5, into `NAME_SPECIES` = human · cat · pup · imp · rex (the board's lanes without the house) — one in five each. A species chosen in the dropdown is used as it is |
| The creature | `makeCreature(roll, species)` |
| The shown name (`shownName`) | What was typed, NFC and trimmed. The key is only ever hashed |

**The roll is the name's alone** — the dropdown never touches it — so choosing the species ALL would have given draws
the identical creature. The species on ALL has a hash of its own rather than the roll's bits, so which species a name is
and what it looks like do not lean on each other. **`v1` in the salt names the mapping**: if the mapping itself ever has
to change, a new salt says so out loud instead of quietly moving every name.

The clock is keyed by the spec's roll (`makeClock(spec.roll, …)`, `scene/rig.js`), so a name also has **its own way of
moving** — the same blinks, glances and actions, in the same order.

### What the same name promises

- **Within one version of the code, one card.** The same key and the same dropdown choice give the same creature and
  the same numbers, on every load, browser and machine. Only the pose is the moment's: the creature on the card is
  alive, and SAVE keeps whatever it is doing when it is pressed.
- **Across versions, the creature follows the generator.** The mapping above is frozen, but `makeCreature` promises
  nothing across versions ([determinism.md](determinism.md)): add a slot or move a weight and a name's creature changes
  with every other roll. A change like that draws every name again, and it is made knowing that — `snapshot.mjs` keeps
  six names (§ checks), and the rarity cut-offs and the ♥ range are measured constants that `names.mjs` fails on when
  they drift.
- **A link keeps the name, not the creature.** The address holds what was typed and the dropdown's choice — never the
  roll or the spec — so a link opened after a generator change draws the creature that name makes then, as typing it would.
- **A saved card keeps what it was.** It is a picture; nothing about it can move.

A frozen copy of the generator for this screen was considered and left: the spec would hold still but the drawing
would not, so the creature would drift anyway, and the copy would be a second generator to keep.

**This bends one rule, on purpose.** [determinism.md](determinism.md) and [README.md](README.md) say no screen shows a
roll or takes one; both carry this screen as the one exception. It takes a name, turns it into a roll, and shows neither.

## The card

```
┌────────────────────────────────────┐
│ 홍길동                        ♥ 130 │
│ WANDERER · REX                     │
│ ┌────────────────────────────────┐ │
│ │                                │ │
│ │                                │ │
│ │     the creature, on paper     │ │
│ │     (alive on the screen)      │ │
│ │                                │ │
│ │                                │ │
│ └────────────────────────────────┘ │
│ ONE HAND UP                     ×6 │
│ ARMS UP                         ×5 │
│ ★ COMMON              MENAGERIE v1 │
└────────────────────────────────────┘
```

**5:7** — the 63 × 88 mm trading card. Every number on it is read off the creature itself (`src/card.js` `cardOf`).

**The area and the card** are two things, and the rest of this document keeps them apart. The **area** is the canvas: the whole 5:7
rectangle, the paper in it, and what SAVE writes out. The **card** is what the pencil draws inside the area — its edge `CARD.inset`
(0.035 of the width) in from the area's own, so a margin of paper shows around it. A turn turns the card; the area does not move
(§ the back).

| On the card | What it shows | Read from |
| --- | --- | --- |
| The name | The shown name as it was typed, shrunk to fit 64% of the width when it runs longer | What was typed |
| ♥ | 30 to 150, in tens | Its size — `sizeOf`, the head's and the body's areas (`layout`: `headRx·headRy + bodyW·bodyH`), laid onto 30–150 over `HEART_RANGE`, the 5th and 95th percentile of that area over all five species together (0.0594–0.2341), so a rex runs high and a cat low. A big creature has more to love |
| The kind | `ARCHETYPE · SPECIES` | The spec (`archetype`, `species`) |
| The picture | The creature on its paper, alive | The board's own scene at 1×1 (`scene.build([spec], 1)`, `SOLO_PAD`) with the camera's zoom at 1.2, REGEN STILL (a live regen would swap it for somebody else's) |
| The moves | Two actions and how many times each starts in the creature's first five minutes | Its own clock run tick by tick, 24 a second ([motion/rules.md](motion/rules.md) § count the firing frequency), named by the action's `label` cut at its first parenthesis. **The arm layer (a quad's legs and tail) comes first and the body layer only fills in**: the body has one action, the hop, and every creature starts it — counted with the rest it opened nearly every card (13 hops in five minutes against 6 of the likeliest arm action). A cat's first move is always its scratch and a dog's its wag, their quad layers' whole list; a human's spreads over ten arm actions. Fewer than two, the card shows what it has: an armless imp only jumps, and a ghost, which does nothing but float, shows `floating` |
| Rarity | `★ COMMON` · `★★ RARE` · `★★★ LEGENDARY` | `rarityScore` — how unlikely its parts are together, the sum of −ln(share) over them, each share taken from the weights that picked the part (`slotWeights`, the one lookup `pickSlot` draws with: species > archetype > default > even; a value not in those weights, a constraint's overwrite, is left out) — cut at its species' 60th and 90th percentile (`RARITY_CUTS`), so the stars fall to 60 · 30 · 10% of every species. Per species, because the score is not fair across them: a human carries 2–4 parts under a 10% share where a cat carries 0–2, and a human's cut-offs sit at 43.2 · 46.8 where a rex's sit at 31.5 · 35.1 |
| The foot | `MENAGERIE v1` | The release |

Where each thing stands is one table, `CARD` in `src/card.js` — fractions of the card's width (x, a word's em) and height
(y, a word's baseline), with each word's weight (500 or 700) and whether it is soft (the ink a third of the way to the paper:
the kind and the foot).

- **The frame** is the pencil (`src/stroke.js`), drawn by `src/name.js` into the scene with the creature: the card's edge
  and the picture's window as closed lines with round corners, laid from the camera's world rectangle and laid again if
  it moves. Three boil frames, flipped at the creature's own cadence (`boilRate`), over the paper and the floor line and
  under every creature (render order 1.2), and under the same sheet (`post.js`) as the creature. It takes the
  creature's ink from before a ghost pales it (`palette0.ink`).
- **The picture's window holds the emoji.** An emoji rides 0.15 over the head's top and rises up to 0.072 more; on the
  tallest head the board makes (1.05, a human), its top stands at 18.2% of the card's height, under the window's top
  edge at 15.5%. That is what sets the zoom: the cell and the emoji over it fill the window, and the creature stands half
  the card wide.
- **The words** are the goofy type (§ the type) — the name as it was typed, the labels in capitals — traced by `layCard`
  and written by `src/name.js` into the same meshes as the frame, so they boil with it and lie under the same sheet. The
  card is one canvas: nothing is written over the scene.
- **SAVE keeps the card and nothing else** — no controls, no page around it — as it is seen. The renderer is set to
  **1000 × 1400** for one draw of the state already on the screen (the same tick, the same boil frame, the frame and the
  words with it), the scene is copied onto a 2D canvas in that task, and the renderer is set back; so a card saved from
  a phone is as sharp as one saved from a desktop. Named `<name>.png`, the characters a file system refuses
  (`/ \ : * ? " < > |`) turned into `_`. On a phone whose share sheet takes files (`navigator.canShare({ files })`, a
  coarse pointer) SAVE opens it — save to photos, send it on — and everywhere else it downloads (`export.js savePng`,
  which reads the PNG with `toDataURL` so the share call stays inside the click that asked for it). There is no creature
  file (JSON) on this screen.

## The back

`src/name.js` `layBack`. Asked for by the owner (2026-09-16): the first screen is not to be empty. Of the ways to fill it — a title
and a line over the controls, a hint written on a blank card, an example card already drawn, creatures walking past — the card's own
back won, because DRAW already means *draw a card*.

```
┌────────────────────────────────────┐
│ ┌────────────────────────────────┐ │
│ │                                │ │
│ │           MENAGERIE            │ │
│ │           TYPE A NAME          │ │
│ │                                │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

- **The card's own edge** (`CARD.inset`, `CARD.corner`), a border inside it at 0.075 of the width, and the wordmark over the hint,
  written in the goofy letters (§ the letters) — the project's own capitals, on the card they were drawn for. The hint takes the
  soft ink the kind and the foot take; everything else is the page's ink, since a card with nobody on it has no palette.
- **It boils** like everything else — three frames at roll 0's cadence — over the paper of the same empty 1×1 scene the creature
  will stand in, so nothing under the card moves when the first one arrives.
- **DRAW turns the card over** (`turnOver`, `stepTurn`): the card is squashed across until it stands on its edge, what it shows is
  swapped there — the creature stood up, the frame and the words laid, where there is nothing to see — and it opens out again, half
  a turn each way in 0.2 s. The angle turns at a constant speed and the card stands as wide as its cosine, taken absolute, so the
  side that comes round is the right way about rather than mirrored. Every later DRAW turns the card too — one card never dissolves
  into another — and the slowest work there is, standing a creature up, happens where it cannot be seen.
- **The card turns, not the area.** The turn is drawn in the scene rather than in CSS: `scene/index.js` `setTurn(k)` squashes
  everything drawn on the paper — every creature, and the floor line under it — and this page squashes the frame group with it,
  while the paper and the sheet over it are left alone, so the page the card lies on holds still while the card turns on it. It has
  to ride in the scene because `applyState` writes a creature's `scale.x` (its facing) every tick, so the turn is multiplied in
  after it.
- **On the loop's own clock** — `stepTurn` off the tick, 24 a second — so the card boils as it turns, and a turn waits with
  everything else while a tab is hidden.
- **One turn at a time.** A DRAW during a turn waits for it (`turning`, a promise the turns queue on), so a held Enter or a run
  down the dropdown plays out as turns rather than a stutter. SAVE is disabled while a turn runs, since a card caught mid-turn would
  save squashed, and a visitor who asks for less motion (`prefers-reduced-motion: reduce`) gets the swap with no turn at all.

## The type

`src/medium/type.js` — how the card writes any script. Settled with the owner (2026-09-15): the project's own capitals
(§ the letters) write only Latin, and a Korean pencil hand is not worth drawing, so the card traces a real font and gives it
the pencil's wiggle instead.

- **The font** is Noto Sans and Noto Sans KR at 500 and 700, served from `fonts/` (subset: Latin, Greek, Cyrillic, every
  Hangul syllable, the jamo, kana, CJK punctuation and the card's marks — 1.6 MB for the four files; `fonts/README.md` says
  how they were made) under the SIL Open Font License. `styles.css` names the faces for this page (`Menagerie Sans`,
  `Menagerie Sans KR`), so a copy installed on the machine never stands in.
- **All four faces load whatever is typed** (`loadType`, when the page opens). A font service sends only the slices a page's
  text needs, and a slice fetched for a name tells the service which characters the name holds; a face of our own fetched
  only when a name needs it would still say which script. Loading them all keeps the fonts from saying anything about a name:
  a name typed and drawn reaches no request, and only a link, opened, carries one — in its own address (§ the screen). A DRAW
  waits for them.
- **Traced, not set** (`traceType`). A line is written onto a canvas at 96 px to the em, and the canvas's coverage is traced
  by marching squares at half — the crossings placed along each cell edge where the coverage passes 0.5, so a ring follows
  the antialiased edge rather than the pixels' steps — the segments joined into rings and each simplified to 0.6 px. A ring
  inside an odd number of others is a hole in the smallest outline round it. A line is traced once and remembered.
- **Written in the pencil** (`typeWith`). Every point is pushed about by a wiggle of its own — 0.035 of an em along the
  sketch's noise, at the boil frame's own phase, so each frame wiggles the words its own way — the shape is filled with its
  holes (three.js's ear clipping, `ShapeUtils.triangulateShape`), and each ring is edged in a pencil line 0.035 of an em
  wide in a hand of 0.5.
- **Any script.** A character neither font holds — a kanji, a hanja, an emoji — is written in the platform's font and traced
  all the same; an emoji comes out an ink silhouette.

## The letters

`src/medium/letters.js` — the project's own capitals, asked for by the owner (2026-09-15) and the card's words until the type
replaced them (they write only Latin); kept, drawn on the medium page (`how.html` § the goofy letters) and writing the card's back
(§ the back): 26 letters, ten
digits and a few marks (`. , ' · - _ / : ! ? + ( ) × ♥ ★` and the space). Not a font file — every glyph is a list of strokes,
and each stroke goes down as one pencil line (`sketch.pencil`), so a word wanders, sheds and boils like the drawing it sits on.

- **Drawn in cap heights**: x from 0 to the glyph's width, y from the baseline (0) to the cap (1), a tail or a comma
  below. A word is laid out (`layOut`) glyph by glyph with `LETTER_GAP` (0.22 of a cap) between, and a run of characters
  with no glyph is kept whole and measured by the caller, so a syllable or an emoji sequence is never cut apart.
- **A corner is two strokes, never one bent line.** The pencil re-samples a line at a fixed step (`PENCIL.step`, 0.01)
  and cuts every corner it walks round; on a letter a few steps tall a cut corner is a round A. Two strokes meeting keep
  it, and where the pen runs past a stroke's end it runs past the way a hand does. A curve is one stroke; a loop (O, 0,
  8, a dot) is closed; a dot, ♥ and ★ are filled under their line.
- **The pen is a share of the cap** — `LETTER_PENS` S 0.08 · M 0.11 · L 0.15, the letters' own ladder as every outline
  kind names its own (`medium/outlines.js`): a title at L, everything else at M. A word a few steps tall has strokes that
  are stubs to the pencil (`PENCIL.stub`) — they keep their ends and shed nothing, which is what keeps it legible. The
  letters' hand (`LETTER_HAND`) is 0.5 of the frame's wobble for the same reason.
- **Capitals only** — no lower case, no accents, no other script, which is why the card writes in the type.

## The board's address

`/` is the name screen, so the board moved: **`index.html` → `board.html`**, the same `src/main.js`. Every tool page's
header keeps its nav — GRID goes to `./board.html`, and the MENAGERIE mark to `./`, the front door. `how.html`'s two links
to the board follow it. The scene lays out one row for an empty cast (`scene/index.js` `build`), so the card's back stands the
paper up in the same 1×1 view its creature will, with no floor line under nobody.

## Checks

- **`node scripts/names.mjs`** — the mapping and the card on their own, each check exiting 1 when it fails: the species
  over 10,000 made-up names on ALL (each within 20% ± 1.5 — measured 19.2–20.6%); every variant in the key's row coming
  out as one name, and a name of only spaces and invisible characters as no name; the roll unmoved by the dropdown; an
  address bringing back the card it was drawn at (Hangul, kana, an accent and an emoji, spaces, and `& = # + % ? /`, each on
  ALL and on CAT), ALL left out of it, a species no name can be read as ALL and an address with no name as nobody; each
  species' stars at 60 · 30 · 10% (± 3) with the cut-offs the page carries; the ♥ range within 5% of its measure; a label
  for every move a card can show. It reports how many cards show two moves (193 of 200 humans, cats, dogs and rexes — the
  seven without are ghosts — and 151 of 200 imps, the rest armless) and lists sample names with their cards.
  `--measure` prints `RARITY_CUTS` and `HEART_RANGE` as they measure, to paste after a change to the weights or the layout.
- **`scripts/snapshot.mjs`** keeps the creatures of six sample names (`names`), so a generator change says how many it
  moved.
- At the build: snapshot diff 0 against the tree before (specs, geometry, motion — `slotWeights` is `pickSlot`'s lookup
  moved, not changed); drawdiff against HEAD 187,360 sketches, 0 spec and 0 drawing differences; census 0; fanspill 0; pixeldiff 0 on the board (4 boards × 35).
- **By hand** — a card drawn and redrawn by the dropdown, a 40-character name shrinking onto its line, a
  ghost's `floating`, a name in four scripts and an emoji (`Élodie 김たなか 🐈`) written and saved at 1000 × 1400 holding only
  the card, the four faces loaded before the first DRAW, and the page at 375px wide: the card 339 × 475, 5:7, under two rows
  of controls. Enter mid-composition with a Korean input method, and the share sheet on a phone, want a real keyboard and a
  real phone.
- **The address, by hand** — a link opened (`홍길동` on CAT: the field, the dropdown and the card); a name typed and the
  dropdown moved to ALL, each rewriting the address in place with no history entry; a refused DRAW leaving it; a name with
  `& = # + % ? /` drawn, reloaded and standing the same card; a link's 43-unit name cut to 39 at the emoji that would have
  passed 40, with `species=dragon` read as ALL.
- **The back and the turn, by hand** — `/` standing the card face down at 748 × 863 and at 375 × 812 (555 × 777 and 339 × 475, 5:7),
  the wordmark and the hint reading at both; DRAW turning it over — the card caught part way, narrow, with the paper and its shadow
  around it not moving, and the creature and its floor line narrowing with the card; the dropdown turning the card again to another
  species' card and `&species=…`; a link (`홍길동` on CAT) opening on the back with the name already in the field and turning over by
  itself; SAVE after a turn 1000 × 1400, the card's edge at 3.3% and 96.8% across (flat on, not caught mid-turn), with the canvas set
  back; and the board drawing as it did, the turn being the name screen's alone.
