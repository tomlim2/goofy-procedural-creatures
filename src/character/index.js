// 캐릭터 — "무엇인가". 시드가 결정하는 정적인 모든 것.
//   vocabulary/  무엇이 있는가 (슬롯·종족·아키타입·팔레트)
//   spec.js      시드 → 스펙 (조합 규칙·제약·비율)
//   draw/        스펙 → 획 (지오메트리)
// 움직임은 여기 없다. 그건 ../motion/이다.
// 문서: guidelines/character/

export { makeCreature, makeGrid, laneSpecies, LANES } from "./spec.js";
export { drawCreature, facePartKinds, facePartSketch, limbSketches, motionRig, BIND_ARM, tailSketch, LAYER_KEYS, HAIR_KEYS, STATIC_EYE_KEYS } from "./draw/index.js";
export { layout, eyeGeometry } from "./draw/layout.js";
export { RIG_EYES, eyeShape, patched, starPath, heartPath, angryEyeSketch } from "./draw/face.js";
export { SLOTS, DEFAULT_BIAS, ARCHETYPES, SPECIES, PAPER, INKS, FILLS, ACCENTS, POPS, DARKS } from "./vocabulary/index.js";
