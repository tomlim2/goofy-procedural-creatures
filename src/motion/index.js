// 개체별 시계. 조각(face/body/limbs/events)을 원본과 같은 rng 호출 순서로 조립한다.
//
// 순서가 곧 시드다. 초기화 순서와 update 내 호출 순서를 바꾸면 기존 시드의
// 모션이 전부 달라진다 (guidelines/determinism.md). 조각을 옮기려면 두 곳 다 옮긴다.
//
// 모든 예약은 출생 시각(birth) 기준 상대 시간이다. 재생성으로 태어난 개체의
// 시계가 절대 시간을 쓰면 예약이 전부 과거가 되어 매 프레임 재생성되는 폭주가 난다.
// 문서: guidelines/motion.md

import { makeRng } from "../rng.js";
import { MOTION } from "./table.js";
import { initBlinkGaze, initSurprise, initSquint, initMood, initWink, initHappy, stepEyes, stepMood } from "./face.js";
import { initBreathe, initBody, initJelly, stepBody, stepJelly, stepBreathe } from "./body.js";
import { initArmToggle, initArms, initLegs, initTail, stepArmToggle, stepArms, stepLegs, stepTail } from "./limbs.js";
import { initRegen, initEmote, stepRegen, stepEmote } from "./events.js";

export { MOTION } from "./table.js";

export function makeClock(seed, birth = 0, species = "kid", armRest = "rest", noRest = false) {
  const rng = makeRng(seed ^ 0x5bf03635);
  const M = MOTION[species] || MOTION.kid;

  // ── 초기화. 원본 순서 그대로 ──
  const breathe = initBreathe(rng);
  const blinkGaze = initBlinkGaze(rng);
  const surprise = initSurprise(rng, M);
  const squint = initSquint(rng);
  const regen = initRegen(rng);
  const mood = initMood(rng);
  const emote = initEmote(rng);
  const body = initBody(rng, M);
  const armToggle = initArmToggle(rng, M);
  const arms = initArms(rng, M, armRest || "rest");
  const legs = initLegs(rng, M);
  const wink = initWink(rng, M);
  const happy = initHappy(rng, M);
  const tail = initTail(rng, M);
  const jelly = initJelly(rng, M);

  const face = { blinkGaze, surprise, squint, wink, happy };

  return {
    update(globalT) {
      const t = globalT - birth;

      // ── update. 원본 순서 그대로 ──
      const eyes = stepEyes(face, t, rng, M);
      const b = stepBody(body, t, rng, M);
      const armAlt = stepArmToggle(armToggle, t, rng, M);
      const a = stepArms(arms, t, rng, M, b, noRest);
      const legOffset = stepLegs(legs, t, rng, M, b);
      const tailAngle = stepTail(tail, t, rng, M);
      const j = stepJelly(jelly, t);
      const md = stepMood(mood, t, rng);
      const regenNow = stepRegen(regen, t, rng);
      const em = stepEmote(emote, t, rng, M);
      const br = stepBreathe(breathe, t);

      return {
        breathe: br, lid: eyes.lid, gaze: eyes.gaze, aperture: eyes.aperture, regen: regenNow, emote: em,
        browAlt: md.browAlt, mouthAlt: md.mouthAlt,
        sway: b.sway, rock: b.rock, headAngle: b.headAngle, headBob: b.headBob,
        hopY: b.hopY, squashX: b.squashX, squashY: b.squashY, stretchX: b.stretchX, shiverX: b.shiverX,
        jellyX: j.jellyX, jellyY: j.jellyY, faceYaw: eyes.faceYaw,
        armAlt, happy: eyes.happy, winkSide: eyes.winkSide, tailAngle,
        armOffset: a.armOffset, legOffset, armPose: a.armPose
      };
    }
  };
}
