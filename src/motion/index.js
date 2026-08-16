// 개체별 시계. rhythm(상시) · events(간헐) · states(유지)를 조립한다.
//
// ⚠ rng 호출 순서가 곧 시드다. 아래 init 순서와 update 순서는 원본(단일 함수
// 시절)과 동일하게 고정돼 있다. 새 모션은 각 블록의 **끝에** 붙인다.
// 순서를 바꾸면 기존 시드의 모션이 전부 달라진다 (guidelines/determinism.md).
//
// 모든 예약은 출생 시각(birth) 기준 상대 시간이다.
// 문서: guidelines/motion/motion.md

import { makeRng } from "../rng.js";
import { MOTION } from "./table.js";
import * as R from "./rhythm.js";
import * as E from "./events.js";
import * as S from "./states.js";

export { MOTION } from "./table.js";

// 바인드 상태 — 아무 모션도 받지 않은 캐릭터. 모든 값이 정지·기본이다.
// scene이 BIND 뷰에서 clock 대신 이걸 리그에 넣는다. 형태·파츠를 판단할 때 쓴다.
export const BIND_STATE = Object.freeze({
  breathe: 0, lid: 0, gaze: [0, 0], aperture: 1, regen: false, emote: null,
  browAlt: false, mouthAlt: false,
  sway: 0, rock: 0, headAngle: 0, headBob: 0,
  hopY: 0, squashX: 0, squashY: 0, stretchX: 0, shiverX: 0,
  jellyX: 0, jellyY: 0, faceYaw: 0,
  happy: false, winkSide: 0, tailAngle: 0,
  armOffset: { "-1": 0, "1": 0 }, legOffset: [0, 0, 0, 0], armAction: "tpose"
});

export function makeClock(seed, birth = 0, species = "kid", noHang = false) {
  const rng = makeRng(seed ^ 0x5bf03635);
  const M = MOTION[species] || MOTION.kid;

  // ── init: 원본 순서 ──
  const breathe = R.initBreathe(rng);            // 1
  const blink = E.initBlink(rng);                // 2
  const glance = E.initGlance(rng);              // 3
  const surprise = E.initSurprise(rng, M);       // 4
  const squint = S.initSquint(rng);              // 5
  const regen = E.initRegen(rng);                // 6
  const mood = S.initMood(rng);                  // 7
  const emote = E.initEmote(rng);                // 8
  const sway = R.initSway(rng, M);               // 9  (sway·rock)
  const roll = R.initRoll(rng, M);               // 10
  const dip = E.initDip(rng, M);                 // 11
  const tilt = S.initTilt(rng, M);               // 12
  const nod = E.initNod(rng);                    // 13
  const hop = E.initHop(rng, M);                 // 14
  const stretch = E.initStretch(rng, M);         // 15
  const shiver = E.initShiver(rng, M);           // 16
  const armSwing = R.initArmSwing(rng);          // 17
  const armAction = S.initArmAction(rng);         // 18
  const armLift = E.initArmLift(rng, M);         // 19
  const armWave = E.initArmWave(rng, M);         // 20
  const legTap = E.initLegTap(rng, M);           // 21
  const legStep = E.initLegStep(rng, M);         // 22
  const wink = S.initWink(rng, M);               // 23
  const happy = S.initHappy(rng, M);             // 24
  const tailSwish = R.initTailSwish(rng, M);     // 25
  const tailFlick = E.initTailFlick(rng, M);     // 26
  const jelly = R.initJelly(rng, M);             // 27

  return {
    update(globalT) {
      const t = globalT - birth;

      // ── update: 원본 순서 ──
      // 얼굴
      const bl = E.stepBlink(blink, t, rng);
      E.stepGlanceTarget(glance, t, rng);
      const gaze = R.stepGaze(glance);
      const faceYaw = R.stepYaw(glance, M);
      let lid = bl.lid;
      let isHappy = bl.happy;
      lid = S.stepSquint(squint, t, rng, lid);
      if (S.stepHappy(happy, t, rng, M)) { lid = 1; isHappy = true; }
      const winkSide = S.stepWink(wink, t, rng, M);
      const aperture = E.stepSurprise(surprise, t, rng, M);

      // 몸통
      const sw = R.stepSway(sway, t, M);
      const tiltAngle = S.stepTilt(tilt, t, rng, M);
      const rollAngle = R.stepRoll(roll, t);
      let headBob = E.stepNod(nod, t, rng);
      headBob += E.stepDip(dip, t, rng, M);
      const hp = E.stepHop(hop, t, rng, M);
      const stretchX = E.stepStretch(stretch, t, rng, M);
      const shiverX = E.stepShiver(shiver, t, rng, M);

      // 팔
      const action = S.stepArmAction(armAction, t, rng, M, noHang);
      const swing = R.stepArmSwing(armSwing, sway, t, M);
      const liftSide = E.stepArmLift(armLift, t, rng, M);
      const wave = E.stepArmWave(armWave, t, rng, M);
      const armOffset = { "-1": swing, "1": -swing };
      // 파닥임 — 좋아서 팔을 들고 빠르게 아래위로 (6Hz)
      const flapping = action === "flap" ? Math.sin(t * Math.PI * 12) * 0.35 : 0;
      for (const side of [-1, 1]) {
        const key = String(side);
        const outward = -side;
        if (flapping) armOffset[key] += outward * flapping;
        if (liftSide === side) armOffset[key] += outward * 0.55;
        if (wave.k >= 0 && wave.side === side) {
          const env = Math.sin(Math.min(1, wave.k) * Math.PI);
          armOffset[key] += outward * 0.7 * env + Math.sin(wave.k * Math.PI * 6) * 0.18 * env;
        }
        if (hp.hopY > 0) armOffset[key] += outward * hp.hopY * 4;
        armOffset[key] += R.armJitter(armSwing, t, side);
      }

      // 다리
      const legOffset = [0, 0, 0, 0];
      E.stepLegTap(legTap, t, rng, M, legOffset);
      E.stepLegStep(legStep, t, rng, M, legOffset);
      if (hp.squashY < 0) { legOffset[0] += hp.squashY * 1.5; legOffset[1] -= hp.squashY * 1.5; }
      for (let i = 0; i < 4; i += 1) legOffset[i] += R.legJitter(t, i);

      // 꼬리 · 젤리
      let tailAngle = R.stepTailSwish(tailSwish, t);
      tailAngle += E.stepTailFlick(tailFlick, t, rng, M);
      const j = R.stepJelly(jelly, t);

      // 표정 상태 · 이벤트
      const md = S.stepMood(mood, t, rng);
      const regenNow = E.stepRegen(regen, t, rng);
      const em = E.stepEmote(emote, t, rng, M);
      const br = R.stepBreathe(breathe, t);

      return {
        breathe: br, lid, gaze, aperture, regen: regenNow, emote: em,
        browAlt: md.browAlt, mouthAlt: md.mouthAlt,
        sway: sw.sway, rock: sw.rock, headAngle: tiltAngle + rollAngle, headBob,
        hopY: hp.hopY, squashX: hp.squashX, squashY: hp.squashY, stretchX, shiverX,
        jellyX: j.jellyX, jellyY: j.jellyY, faceYaw,
        happy: isHappy, winkSide, tailAngle,
        armOffset, legOffset, armAction: action
      };
    }
  };
}
