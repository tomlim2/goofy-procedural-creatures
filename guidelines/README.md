# guidelines — menagerie working rules

This lab splits into two axes: **character** (what it is — everything static that the seed decides) and
**motion** (how it moves — everything dynamic that the clock decides). The code and the documents both
follow that split. It is not per-part animation.

The rules for this repo are all here (it was split out of the anju monorepo's `web/menagerie/` — the entry
point is the root [`CLAUDE.md`](../CLAUDE.md)).

| Axis | Code | Catalog (what exists) | Rules (how to change it) |
| --- | --- | --- | --- |
| **Character** | `src/character/` | [character/types.md](character/types.md) species, archetypes, proportions, palette, constraints<br>[character/parts.md](character/parts.md) 23 slots, 180 parts | [character/rules.md](character/rules.md) the procedure for adding a part, separating form from motion, distribution standards |
| **Motion** | `src/motion/` | [motion/catalog.md](motion/catalog.md) the state object, per-species parameters, every motion | [motion/rules.md](motion/rules.md) classifying rhythm/events/states, rng order, measuring firing |
| Shared | `src/scene/` `src/stroke.js` `src/color.js` `src/rng.js` `src/control.js` `src/ui.js` `src/export.js` | [rig.md](rig.md) the three.js hierarchy and origins | [determinism.md](determinism.md) the seed contract<br>[drawing.md](drawing.md) lines, color, layers<br>[performance.md](performance.md) draw calls, materials, measurement |

## What to judge by

Looking good to the eye and being right are different things. There is a tool for each judgement.

| Judgement | Tool | Where |
| --- | --- | --- |
| One part's **form** | The parts gallery — every value of a slot (or a few chosen with `values=`) on the same individual, side by side | `/gallery.html?slot=…&species=…&fix=…&values=…` ([../README.md](../README.md) § Running) |
| Part **distribution** and species identity | `node scripts/census.mjs [--slot X \| --check]` | [character/rules.md](character/rules.md) § distribution is read with census |
| Whether a face part **is visible in every state** | The face part audit — the whole board × 22 face states, the pixel difference per part | `/audit.html?seed=…` ([character/rules.md](character/rules.md) § a face part has to be visible in every state) |
| What the **medium** itself does | The medium page — every stroke kind, blobPath knob and palette group, drawn live by `stroke.js` | `/how.html` ([drawing.md](drawing.md)) |
| How one **action** looks | The on-screen ACTION card (forcing it on every biped, IDLE) | [motion/catalog.md](motion/catalog.md) § the bind pose and arm actions |
| Motion **frequency** | Counting firings in a 60 s simulation | [motion/rules.md](motion/rules.md) § count the firing frequency |
| Motion noise while judging form | POSE BIND (pinned to the T-pose) · INK STILL (the boil stopped) | [rig.md](rig.md) § pose and ink |
| **Invariance** before and after a refactor | `node scripts/snapshot.mjs before/after` (specs, one board's geometry, motion trajectories) · `node scripts/drawdiff.mjs` (drawing — every slot value against HEAD) | [determinism.md](determinism.md) |
| **Performance** (frame cost) | Read `renderer.info.render.calls` and the frame time from the console | [performance.md](performance.md) § how it is measured |

## In one line each

- The same seed has to give the same result. If that breaks, this lab means nothing
- Character is slots (form) only; motion is rhythm/events/states only. Hands behind the back is not a form
  but a pose (motion)
- Looking good to the eye and having the right distribution and frequency are different things. If you
  changed it, count it
