# guidelines — menagerie working rules

This lab splits into two axes: **character** (what it is — everything static that the seed decides) and
**motion** (how it moves — everything dynamic that the clock decides). The code and the documents both
follow that split. It is not per-part animation.

The rules for this repo are all here (it was split out of the anju monorepo's `web/menagerie/` — the entry
point is the root [`CLAUDE.md`](../CLAUDE.md)).

| Axis | Code | Catalog (what exists) | Rules (how to change it) |
| --- | --- | --- | --- |
| **Character** | `src/character/` | [character/types.md](character/types.md) species, archetypes, proportions, palette, constraints<br>[character/parts.md](character/parts.md) 28 slots, 207 parts | [character/rules.md](character/rules.md) the procedure for adding a part, separating form from motion, distribution standards |
| **Motion** | `src/motion/` | [motion/catalog.md](motion/catalog.md) the state object, per-species parameters, every motion | [motion/rules.md](motion/rules.md) classifying rhythm/events/states, rng order, measuring firing |
| Shared | `src/scene/` `src/stroke.js` `src/shape.js` `src/medium/` `src/color.js` `src/rng.js` `src/control.js` `src/ui.js` `src/export.js` | [rig.md](rig.md) the three.js hierarchy and origins | [determinism.md](determinism.md) the seed contract<br>[drawing.md](drawing.md) lines, color, layers<br>[performance.md](performance.md) draw calls, materials, measurement |

## The seven screens

Every page carries the same nav, so any screen is one click from any other. Six of them judge a different
thing; the editor is the one that **makes** rather than judges.

| Screen | What it is for |
| --- | --- |
| `/index.html` **GRID** | The board itself — the thing being made. Seed, species, grid size, PNG |
| `/debug.html` **DEBUG** | The board plus the judging controls, folded into one JUDGING card: POSE (bind), INK (boil), ACTION (force one), HIGH FIVE (rush), REGEN (live). Folded, the summary names whatever is away from its default, so a screen left on BIND never reads as a bug. Every control rides in the address |
| `/gallery.html` **GALLERY** | One slot's every value on the same individual, side by side |
| `/editor.html` **EDITOR** | The character maker — a species, then every slot, colour and proportion by hand |
| `/audit.html` **AUDIT** | The face part audit — the whole board × 22 face states, counted in pixels |
| `/pixeldiff.html` **DIFF** | The rendered board against a reference, pixel by pixel — the only gate that sees the scene and the shaders |
| `/how.html` **HOW** | The medium page — outlines, materials, fur, shapes and palette, drawn live by the real code |

**Watching a high five.** A pair fives every 300~720 s, so a screen sits quiet for minutes. DEBUG's HIGH FIVE
**RUSH** divides that wait (and a fresh board's first-five wait) by 60 — `?five=rush`. Only the waiting is
shortened: the pair logic, the hurry over, the wind-up and the slap are the board's own, so what you watch is
the real swing. It is settled when the scene is built, so the button reloads the page with the value in the
address.

## What to judge by

Looking good to the eye and being right are different things. There is a tool for each judgement.

| Judgement | Tool | Where |
| --- | --- | --- |
| One part's **form** | The parts gallery — every value of a slot (or a few chosen with `values=`) on the same individual, side by side | `/gallery.html?slot=…&species=…&fix=…&values=…` ([../README.md](../README.md) § Running) |
| Part **distribution** and species identity | `node scripts/census.mjs [--slot X \| --check]` | [character/rules.md](character/rules.md) § distribution is read with census |
| Whether a face part **is visible in every state** — and a quad's tail at all | The face part audit — the whole board × 22 face states, the pixel difference per part; each tail at rest and raised | `/audit.html?seed=…` ([character/rules.md](character/rules.md) § a face part has to be visible in every state) |
| What the **medium** itself does | The medium page — the goofy outlines, the goofy materials as shader balls, the goofy fur, the shapes and the palette, drawn live by `stroke.js` from its own tables | `/how.html` ([drawing.md](drawing.md)) |
| How one **action** looks | The debug screen's ACTION card (forcing it on every biped, IDLE). A forced action releases every running high five — a forced arm would fight it | `/debug.html?action=…` · [motion/catalog.md](motion/catalog.md) § the bind pose and arm actions |
| Motion **frequency** | Counting firings in a 60 s simulation | [motion/rules.md](motion/rules.md) § count the firing frequency |
| The **high five** — how often pairs land one, and whether the palms meet | `node scripts/hifive-sim.mjs` — the real pair logic over real clocks, both palms run back through FK at contact. To watch one instead of counting them, `/debug.html?five=rush` (§ the six screens) | [motion/catalog.md](motion/catalog.md) § the high five |
| Motion noise while judging form | POSE BIND (pinned to the T-pose) · INK STILL (the boil stopped) | `/debug.html?pose=bind&ink=still` · [rig.md](rig.md) § pose and ink |
| **Invariance** before and after a refactor | `node scripts/snapshot.mjs before/after` (specs, one board's geometry, motion trajectories) · `node scripts/drawdiff.mjs` (drawing — every slot value against HEAD) · `/pixeldiff.html` (the picture — the rendered board against a ref, pixel by pixel; the only gate that sees the scene and the shaders) | [determinism.md](determinism.md) |
| **Performance** (frame cost) | Read `renderer.info.render.calls` and the frame time from the console | [performance.md](performance.md) § how it is measured |

## In one line each

- The same seed has to give the same result. If that breaks, this lab means nothing
- Character is slots (form) only; motion is rhythm/events/states only. Hands behind the back is not a form
  but a pose (motion)
- Looking good to the eye and having the right distribution and frequency are different things. If you
  changed it, count it
- The editor is the one screen whose creature is **not** something a seed could have made. It edits a spec
  directly and reports the rules instead of applying them, so what it saves is the spec, not a seed. Nothing
  in it touches rng, and the generator remains the only thing a seed drives
