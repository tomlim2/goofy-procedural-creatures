// 개체별 시계. rhythm(상시) · events(간헐) · states(유지) · actions(행위)를 조립한다.
//
// ⚠ rng 호출 순서가 곧 시드다. 아래 init 순서와 update 순서는 고정돼 있다. 새 모션은
// 각 블록의 **끝에** 붙인다. 순서를 바꾸면 기존 시드의 모션이 전부 달라진다
// (guidelines/determinism.md).
//
// 모든 예약은 출생 시각(birth) 기준 상대 시간이다.
// 문서: guidelines/motion/catalog.md, guidelines/motion/rules.md

import { makeRng } from "../rng.js";
import { MOTION } from "./table.js";
import * as R from "./rhythm.js";
import * as E from "./events.js";
import * as S from "./states.js";
import { ACTIONS, bindArm, solveArms } from "./actions.js";

export { MOTION } from "./table.js";
export { ACTIONS, ARM_POSES, bindArm, solveArm, solveArms } from "./actions.js";

// 바인드 상태 — 아무 모션도 받지 않은 캐릭터. 모든 값이 정지·기본이고 팔은 T포즈다.
// scene이 BIND 뷰에서 clock 대신 이걸 리그에 넣는다. 형태·파츠를 판단할 때 쓴다.
// (모션의 기본 상태는 이게 아니라 idle이다 — actions.js. 바인드는 모션이 없을 때다.)
export const BIND_STATE = Object.freeze({
  breathe: 0, lid: 0, gaze: [0, 0], aperture: 1, regen: false, emote: null,
  browAlt: false, mouthAlt: false,
  sway: 0, rock: 0, headAngle: 0, headBob: 0,
  hopY: 0, squashX: 0, squashY: 0, stretchX: 0, shiverX: 0,
  jellyX: 0, jellyY: 0, faceYaw: 0,
  happy: false, winkSide: 0, tailAngle: 0,
  arms: { "-1": bindArm(-1), "1": bindArm(1) }, armAction: null, armSide: 0,
  legOffset: [0, 0, 0, 0]
});

// rig: character/draw/limbs.js armRig(spec) — 어깨 위치·팔 길이·몸 앵커. 행위를 IK로 푸는 데 쓴다.
// 네발은 null (팔이 없다).
export function makeClock(seed, birth = 0, species = "kid", rig = null) {
  const rng = makeRng(seed ^ 0x5bf03635);
  const M = MOTION[species] || MOTION.kid;

  // ── init: 고정 순서 ──
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
  const armAction = S.initArmAction(rng);        // 18
  const legTap = E.initLegTap(rng, M);           // 19
  const legStep = E.initLegStep(rng, M);         // 20
  const wink = S.initWink(rng, M);               // 21
  const happy = S.initHappy(rng, M);             // 22
  const tailSwish = R.initTailSwish(rng, M);     // 23
  const tailFlick = E.initTailFlick(rng, M);     // 24
  const jelly = R.initJelly(rng, M);             // 25

  // 강제 행위 (화면 ACTION 카드). 예약된 행위 대신 이걸 계속 한다. null이면 예약대로,
  // "idle"이면 행위 없이 idle만.
  let forced = null;
  let forcedSide = 1;
  let forcedStart = -1;

  return {
    force(action, side = 1) {
      forced = action === "idle" || (action && ACTIONS[action]) ? action : null;
      forcedSide = side;
      forcedStart = -1;
    },
    update(globalT) {
      const t = globalT - birth;

      // ── update: 고정 순서 ──
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

      // 팔 — 기본은 idle(A포즈), 행위가 있으면 그 행위가 정한 팔만 덮는다. 리그에 IK로 풀고,
      // 그 위에 진자·폴짝·지터를 얹는다.
      // 예약은 강제 중에도 계속 돌린다(rng 소비를 같게 — 강제를 풀어도 시계가 흐트러지지 않는다).
      const scheduled = S.stepArmAction(armAction, t, rng, M);
      let act = scheduled;
      if (forced === "idle") act = null;
      else if (forced) {
        if (forcedStart < 0) forcedStart = t;
        act = { action: forced, side: forcedSide, start: forcedStart, until: Infinity };
      }
      const arms = solveArms(rig, act, t);
      const swing = R.stepArmSwing(armSwing, sway, t, M);
      for (const side of [-1, 1]) {
        const arm = arms[String(side)];
        // 진자(스웨이 역위상) · 폴짝 시 팔 위로 · 관절 지터. 팔꿈치는 절반 (관절이 따로 끓는다)
        let off = -side * swing;
        if (hp.hopY > 0) off += side * hp.hopY * 4;
        off += R.armJitter(armSwing, t, side);
        arm.shoulder += off;
        arm.elbow += off * 0.5;
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
      let em = E.stepEmote(emote, t, rng, M);
      const br = R.stepBreathe(breathe, t);
      // 행위가 이모트를 동반하면(파닥임 → ♥) 그게 우선
      if (act && ACTIONS[act.action].emote) em = { kind: ACTIONS[act.action].emote, k: 0.5 };

      return {
        breathe: br, lid, gaze, aperture, regen: regenNow, emote: em,
        browAlt: md.browAlt, mouthAlt: md.mouthAlt,
        sway: sw.sway, rock: sw.rock, headAngle: tiltAngle + rollAngle, headBob,
        hopY: hp.hopY, squashX: hp.squashX, squashY: hp.squashY, stretchX, shiverX,
        jellyX: j.jellyX, jellyY: j.jellyY, faceYaw,
        happy: isHappy, winkSide, tailAngle,
        arms, armAction: act ? act.action : null, armSide: act ? act.side : 0,
        legOffset
      };
    }
  };
}
