// 스펙 → 획. 파츠별 그리기 함수를 조립한다. 무엇을 고를지는 여기서 정하지 않는다.
// 문서: guidelines/character/parts.md, guidelines/rig.md

import { Sketch } from "../../stroke.js";
import { makeNoise, makeRng } from "../../rng.js";
import { layout, eyeGeometry } from "./layout.js";
import { drawHead, drawEars, drawPupEars, drawHair, drawHeadgear, drawHorns } from "./head.js";
import { drawEyes, drawFace2, drawEyewear, drawNose } from "./face.js";
import { drawBody, drawMarks } from "./body.js";

export { facePartKinds, facePartSketch } from "./face.js";
export { limbSketches, armRig, BIND_ARM, tailSketch } from "./limbs.js";

// 스펙 하나를 그려서 지오메트리 재료를 돌려준다.
// 몸·머리·얼굴을 분리해 굽는다 — scene이 머리만 굴리고 끄덕이고, 얼굴(이목구비)만 통째로
// 밀어 머리를 돌린 착시를 만들 수 있게. 머리 = 윤곽·귀·뿔·머리카락·모자, 얼굴 = 눈·볼·코·
// 수염·주둥이·안경 (눈썹·입은 상태 전환용 별도 메시, 살아 있는 눈은 눈 리그).
// variant는 보일 프레임 번호다. 지터 위상만 달라지고 구도는 같다.
export function drawCreature(spec, variant = 0) {
  const rng = makeRng((spec.proportions.wobbleSeed ^ (variant * 0x9e3779b9)) >>> 0);
  const noise = makeNoise(rng);
  const wobble = spec.proportions.wobble;

  const bodyInk = new Sketch(noise, wobble);
  const bodyFills = new Sketch(noise, wobble);
  const headInk = new Sketch(noise, wobble);
  const headFills = new Sketch(noise, wobble);
  const faceInk = new Sketch(noise, wobble);
  const faceFills = new Sketch(noise, wobble);
  const hatInk = new Sketch(noise, wobble);
  const hatFills = new Sketch(noise, wobble);
  const box = layout(spec);
  const eyes = eyeGeometry(spec, box);

  const body = drawBody(bodyInk, bodyFills, spec, box, noise);
  drawMarks(bodyInk, spec, body);

  drawEars(headInk, headFills, spec, box);
  drawHead(headInk, headFills, spec, box, noise);
  drawPupEars(headInk, headFills, spec, box);   // 개 귀는 머리 위 (안쪽으로 기울어도 얼굴 밖으로 보이게)
  drawHorns(headInk, headFills, spec, box, noise);
  drawEyes(faceInk, faceFills, spec, box, eyes);
  drawFace2(faceInk, faceFills, spec, box, eyes);
  drawNose(faceInk, faceFills, spec, box, eyes);
  // 눈썹과 입은 여기서 굽지 않는다. 상태 전환을 위해 scene이
  // facePartSketch로 별도 메시를 세운다.
  if (spec.species === "cat") {
    const wy = box.headCy - box.headRy * 0.3;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        const y0 = wy + (i - 1) * 0.028;
        faceInk.stroke([
          [side * box.headRx * 0.3, y0],
          [side * (box.headRx * 0.3 + 0.09), y0 + (i - 1) * 0.012]
        ], { color: spec.palette.ink, width: 0.006, jitter: 0.004 });
      }
    }
  }
  drawEyewear(faceInk, faceFills, spec, box, eyes);
  drawHair(headInk, spec, box, noise);
  // 모자는 머리 **앞**에 따로 굽는다 — 머리 윤곽·머리카락·뿔 밑동을 덮는다 (한 스케치에 넣으면 윤곽선이 모자를 뚫고 비친다)
  drawHeadgear(hatInk, hatFills, spec, box);

  // 동공이 움직이는 눈만 골라 넘긴다. 외눈도 살아 있다.
  const live = ["ring", "wide", "cyclops"].includes(spec.parts.eyes)
    ? eyes.filter((e) => e.side !== spec.parts.patchSide)
    : [];

  return {
    body: { ink: bodyInk, fills: bodyFills },
    head: { ink: headInk, fills: headFills },
    face: { ink: faceInk, fills: faceFills },
    hat: { ink: hatInk, fills: hatFills },
    eyes: live,
    box,
    // 머리 회전 축. 몸 꼭대기(턱 언저리)다.
    neckY: box.bodyTop,
    // 얼굴 그룹 원점. 머리 중심 — 돌림으로 눌러도 여기를 축으로 눌린다.
    faceCy: box.headCy,
    headTop: box.headCy + box.headRy,
    quad: box.quad
  };
}

