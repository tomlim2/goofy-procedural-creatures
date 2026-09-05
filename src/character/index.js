// Character — "what it is". Everything static that the roll decides.
//   vocabulary/  what exists (slots, species, archetypes, palette)
//   spec.js      roll -> spec (combination rules, constraints, proportions)
//   draw/        spec -> strokes (geometry)
// Movement is not here. That is ../motion/.
// Docs: guidelines/character/

export { makeCreature, makeGrid, makeBoard, boardCells, cellRoll, laneSpecies, LANES, ghostPalette, ghostOutline, ghostInk, isGhost, applyForbid, applyConstraints, applyLateConstraints } from "./spec.js";
export { deriveSpec, readCreature, readBoard, creatureJson, boardJson, isHouse, BOARD_FILE } from "./file.js";
export { drawCreature, facePartKinds, facePartSketch, limbSketches, motionRig, BIND_ARM, tailSketch, LAYER_KEYS, HAIR_KEYS, STATIC_EYE_KEYS } from "./draw/index.js";
export { layout, eyeGeometry } from "./draw/layout.js";
export { RIG_EYES, eyeShape, eyeWob, patched, starPath, heartPath, angryEyeSketch } from "./draw/face.js";
export { SLOTS, DEFAULT_BIAS, ARCHETYPES, SPECIES, PAPER, INKS, FILLS, ACCENTS, POPS, DARKS, paintOf, markInkOf } from "./vocabulary/index.js";
