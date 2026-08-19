// 스펙 → 획. 파츠별 그리기 함수를 조립한다. 무엇을 고를지는 여기서 정하지 않는다.
// 문서: guidelines/character/parts.md, guidelines/rig.md

import { Sketch } from "../../stroke.js";
import { makeNoise, makeRng } from "../../rng.js";
import { layout, eyeGeometry } from "./layout.js";
import { drawHead, drawEars, drawPupEars, drawCatEars } from "./head.js";
import { drawHair } from "./hair.js";
import { drawHeadgear, drawHorns } from "./headgear.js";
import { drawEyes, drawFace2, drawEyewear, drawNose, drawWhiskers, RIG_EYES, patched } from "./face.js";
import { drawBody, drawMarks, drawHeadMarks } from "./body.js";

export { facePartKinds, facePartSketch } from "./faceStates.js";
export { limbSketches, motionRig, BIND_ARM, tailSketch } from "./limbs.js";

// 층 이름 — 스케치 쌍(잉크·채색) 하나씩. scene/rig.js가 같은 이름으로 메시를 세운다 (렌더 순서는 guidelines/rig.md)
//   body 몸 · crownBack 옆귀 · head 머리 윤곽 · horns 뿔 · hairBack 뒷머리 · hairCrown 두피 위 머리카락 · hairFront 앞머리 · front 개/고양이 귀 ·
//   hat 모자 · face 볼·수염 · staticEyeBack/staticEyeFront 정지 눈(눈마다 한 층) · faceFront 코·주둥이·안경
// 머리에 붙는 층(귀·뿔·머리카락·모자)은 scene/rig.js가 층마다 **깊이(DEPTH)** 를 줘 얼굴 돌림에 앞뒤로 다르게 민다 — 앞머리는 얼굴 쪽으로 조금, 뒷머리는 머리 뒤라 반대로
// 정지 눈은 **눈마다 따로** 굽는다 — 윙크처럼 한쪽만 아치로 바꿀 때 그 눈의 층만 끄고 다른 눈은 남겨야 한다 (두 눈이 한 메시면 반대쪽 눈이 같이 사라진다).
// 작은 눈이 Back, 큰 눈이 Front — 겹치면 큰 눈이 앞(hollow의 흰자가 작은 눈의 테를 덮는다, 교차선 없음)
export const STATIC_EYE_KEYS = ["staticEyeBack", "staticEyeFront"];
export const HAIR_KEYS = ["hairBack", "hairCrown", "hairFront"];
export const LAYER_KEYS = ["body", "crownBack", "head", "horns", ...HAIR_KEYS, "front", "hat", "face", ...STATIC_EYE_KEYS, "faceFront"];

// 스펙 하나를 그려서 지오메트리 재료를 돌려준다.
// 몸·머리·얼굴을 분리해 굽는다 — scene이 머리만 굴리고 끄덕이고, 얼굴(이목구비)만 통째로
// 밀어 머리를 돌린 착시를 만들 수 있게. 머리 = 윤곽·귀·뿔·머리카락·모자, 얼굴 = 눈·볼·코·
// 수염·주둥이·안경 (눈썹·입은 상태 전환용 별도 메시, 살아 있는 눈은 눈 리그).
// 머리에 붙는 것들은 얼굴 돌림 때 윤곽은 그대로 두고 살짝 밀린다(시차): 귀(crownBack 옆귀 · front 개/고양이 귀)는 얼굴과 **반대로**,
// crown(뿔·머리카락) · hat(모자)은 얼굴과 같은 방향으로 덜, hairFront(앞머리)는 아주 조금. 정지 눈은 따로 굽는다 — 놀람 변형(☆_☆·♥_♥) 때
// 눈을 덮지 않고 **없앴다가** 글리프로 대체하려면 눈만 끌 수 있어야 한다.
// variant는 보일 프레임 번호다. 지터 위상만 달라지고 구도는 같다.
export function drawCreature(spec, variant = 0) {
  const rng = makeRng((spec.proportions.wobbleSeed ^ (variant * 0x9e3779b9)) >>> 0);
  const noise = makeNoise(rng);
  const wobble = spec.proportions.wobble;
  const L = {};
  for (const key of LAYER_KEYS) L[key] = { ink: new Sketch(noise, wobble), fills: new Sketch(noise, wobble) };
  const box = layout(spec);
  const eyes = eyeGeometry(spec, box);

  const body = drawBody(L.body.ink, L.body.fills, spec, box, noise);
  drawMarks(L.body.ink, L.body.fills, spec, body, noise);   // 선 무늬는 ink, 삼색 얼룩은 fills(채움) + ink(안쪽 가장자리)

  drawEars(L.crownBack.ink, L.crownBack.fills, spec, box);   // 옆귀 — 머리 채색 뒤(뿌리가 머리에 가린다)
  const headPath = drawHead(L.head.ink, L.head.fills, spec, box, noise);
  drawHeadMarks(L.head.ink, L.head.fills, spec, headPath, noise);   // 삼색 얼룩 — 머리 채색 위·윤곽 아래(같은 층의 채움)
  // 머리 앞 층 — 개 귀·고양이 귀. 머리 잉크 위에 채움이 얹혀야 윤곽선이 귀를 뚫고 비치지 않는다
  drawPupEars(L.front.ink, L.front.fills, spec, box);
  drawCatEars(L.front.ink, L.front.fills, spec, box);
  drawHorns(L.horns.ink, L.horns.fills, spec, box, noise);
  // 두피 위 머리카락은 뿔과 같은 자리(2.06)에 그리되 층은 따로 — 획 위상만 뿔에서 이어받는다 (뿔·머리카락을 한 스케치에 그리던 때와 같은 떨림)
  L.hairCrown.ink.phase = L.horns.ink.phase;
  L.hairCrown.fills.phase = L.horns.fills.phase;
  // 정지 눈 — 안대에 안 가린 눈을 작은 것부터 층 하나씩(Back → Front). 살아 있는 눈(RIG_EYES)은 drawEyes가 안 그리므로 층이 빈다
  const staticEyes = [...eyes].filter((e) => !patched(spec, e)).sort((a, b) => a.r - b.r)
    .map((eye, i) => ({ key: STATIC_EYE_KEYS[i], side: eye.side, eye }));
  staticEyes.forEach(({ key, eye }, i) => {
    if (i > 0) {   // 획 위상을 앞 눈에서 이어받는다 — 두 눈을 한 스케치에 그리던 때와 같은 떨림 (지오메트리가 그대로다)
      const prev = L[staticEyes[i - 1].key];
      L[key].ink.phase = prev.ink.phase;
      L[key].fills.phase = prev.fills.phase;
    }
    drawEyes(L[key].ink, L[key].fills, spec, box, [eye]);
  });
  drawFace2(L.face.ink, L.face.fills, spec, box, eyes);
  // 코·안경은 얼굴 **맨 앞**(눈 리그보다 위) — 놀라 커진 흰자·감긴 눈꺼풀이 코·안경테를 덮어 사라지게 하지 않는다
  drawNose(L.faceFront.ink, L.faceFront.fills, spec, box, eyes);
  // 눈썹과 입은 여기서 굽지 않는다. 상태 전환(쉼·대체·화남·^^)을 위해 scene이 facePartSketch(faceStates.js)로 별도 메시를 세운다.
  drawWhiskers(L.face.ink, spec, box);   // 고양이 수염 — 얼굴 층이라 윤곽 위로 그려져 밖으로 뚫고 나올 수 있다
  drawEyewear(L.faceFront.ink, L.faceFront.fills, spec, box, eyes);
  // 머리카락 세 층 — 뒷머리(머리 뒤) · 두피 위(뿔과 같은 자리) · 앞머리(얼굴 위). 층마다 깊이가 달라 얼굴 돌림에 따로 밀린다 (rig.js DEPTH). hair.js 참조
  drawHair({ back: L.hairBack.ink, crown: L.hairCrown.ink, front: L.hairFront.ink }, spec, box, noise);
  drawHeadgear(L.hat.ink, L.hat.fills, spec, box);   // 모자는 귀보다 위 층 — 귀 밑동을 덮는다

  // 동공이 움직이는 눈만 골라 넘긴다. 외눈도 살아 있다.
  const live = RIG_EYES.includes(spec.parts.eyes) ? eyes.filter((e) => !patched(spec, e)) : [];

  return {
    ...L,
    eyes: live,
    // 정지 눈 층 ↔ 눈 — [{ key, side, eye }] 작은 눈부터. 리그 눈이면 층은 비어 있다 (rig.js가 감은 눈·놀람 변형을 눈 자리에 세우는 데 쓴다)
    staticEyes: RIG_EYES.includes(spec.parts.eyes) ? [] : staticEyes,
    box,
    // 머리 회전 축. 몸 꼭대기(턱 언저리)다.
    neckY: box.bodyTop,
    // 얼굴 그룹 원점. 머리 중심 — 돌림으로 눌러도 여기를 축으로 눌린다.
    faceCy: box.headCy,
    headTop: box.headCy + box.headRy,
    quad: box.quad
  };
}
