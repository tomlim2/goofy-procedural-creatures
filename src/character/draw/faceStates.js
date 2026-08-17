// 눈썹·입의 상태 벌 — 쉼 / 대체 / 화남 / ^^. scene이 벌마다 메시를 세우고 시계 상태(browAlt·mouthAlt·angry·happy)로 바꿔 켠다.
// 문서: guidelines/motion/catalog.md § 얼굴 (눈썹 전환·입 전환·화남·^^), guidelines/character/parts.md § mouth

import { Sketch } from "../../stroke.js";
import { makeNoise, makeRng } from "../../rng.js";
import { layout, eyeGeometry } from "./layout.js";
import { SPECIES } from "../vocabulary/species.js";
import { drawBrow } from "./face.js";
import { drawMouth } from "./mouth.js";

// 눈썹의 대체 상태. 쉬는 상태에서 이따금 이 상태로 넘어갔다 돌아온다.
// 눈썹이 없는 개체는 대체도 없다 — 없는 파트를 기분 전환 때 그려 넣지 않는다
const ALT_BROW = { none: "none", flat: "worry", angry: "flat", worry: "flat" };

// 입의 대체 상태 — 같은 기분의 이웃으로 살짝 바뀐다 (선↔물결, 점↔3, 웃음→씨익, 긴장↔격자…)
const ALT_MOUTH = {
  dot: "line", line: "wave", open: "line", wave: "line", smile: "grin", pout: "dot", omega: "three", zigzag: "wave",
  frown: "line", three: "omega", grimace: "line", grin: "smile", scribble: "wave", tongue: "open", fangs: "line", shout: "open", meow: "omega", blep: "omega", bracket: "line"
};

// 화남(state.angry)의 입 — 종족별. 사람·개는 이빨 격자(악문 이), 도깨비·고양이는 송곳니(하악). 문서: guidelines/character/parts.md § mouth
const ANGRY_MOUTH = { human: "grimace", pup: "grimace", cat: "fangs", imp: "fangs" };
// ^^(state.happy)의 입 — 개만 혀를 내민다(헥헥). 나머지는 쉼 입 그대로 (같은 종류면 같은 메시)
const HAPPY_MOUTH = { pup: "tongue" };

// 벌 목록: brow [쉼, 대체, 화남] · mouth [쉼, 대체, 화남, ^^]. 값에는 종족 forbid를 적용한다 — 눈썹이 없는 종족(개·고양이)이
// 기분 전환 때 눈썹을 달면 안 된다. 같은 종류가 두 벌에 있으면 scene이 메시 하나를 나눠 쓴다
export function facePartKinds(spec) {
  const forbid = (SPECIES.find((s) => s.name === spec.species) || {}).forbid || {};
  const allow = (slot, value) => (forbid[slot] && forbid[slot][value] !== undefined ? forbid[slot][value] : value);
  const brow = spec.parts.brow, mouth = spec.parts.mouth;
  return {
    brow: [brow, allow("brow", ALT_BROW[brow] || "flat"), allow("brow", brow === "none" ? "none" : "angry")],
    mouth: [
      mouth,
      allow("mouth", ALT_MOUTH[mouth] || "line"),
      allow("mouth", ANGRY_MOUTH[spec.species] || "grimace"),
      allow("mouth", HAPPY_MOUTH[spec.species] || mouth)
    ]
  };
}

// 눈썹 또는 입 한 상태를 독립 Sketch로 굽는다. scene이 상태별 메시로 세운다.
export function facePartSketch(spec, part, kind) {
  const rng = makeRng((spec.proportions.wobbleSeed + (part === "brow" ? 101 : 202)) >>> 0);
  const noise = makeNoise(rng);
  const sketch = new Sketch(noise, spec.proportions.wobble);
  const box = layout(spec);
  if (part === "brow") drawBrow(sketch, spec, box, eyeGeometry(spec, box), kind);
  else drawMouth(sketch, sketch, spec, box, kind);
  return sketch;
}
