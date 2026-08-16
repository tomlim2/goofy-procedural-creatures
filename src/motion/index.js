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
import { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS, jumpCurve, bindArm, solveArms } from "./actions.js";
import { initEmoji, triggerEmoji, stepEmoji } from "./emoji.js";
import { ramp } from "./ease.js";

export { MOTION } from "./table.js";
export { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS, ARM_POSES, bindArm, solveArm, solveArms } from "./actions.js";
export { EMOJI } from "./emoji.js";

// 바인드 상태 — 아무 모션도 받지 않은 캐릭터. 모든 값이 정지·기본이다: 두발은 팔 T포즈,
// 네발은 다리 수직·꼬리 그린 그대로. scene이 BIND 뷰에서 clock 대신 이걸 리그에 넣는다.
// (모션의 기본 상태는 이게 아니라 idle이다 — 두발 A포즈, 네발 선 자세(legStance·tailIdle). 바인드는 모션이 없을 때다.)
export const BIND_STATE = Object.freeze({
  breathe: 0, lid: 0, gaze: [0, 0], aperture: 1, regen: false, emoji: null,
  browAlt: false, mouthAlt: false,
  sway: 0, rock: 0, headAngle: 0, headBob: 0,
  hopY: 0, squashX: 0, squashY: 0, stretchX: 0, shiverX: 0,
  jellyX: 0, jellyY: 0, faceTurn: [0, 0],
  happy: false, winkSide: 0, tailAngle: 0,
  arms: { "-1": bindArm(-1), "1": bindArm(1) }, action: null, actionSide: 0, bodyAction: null,
  mode: "idle", sleep: 0,
  legOffset: [0, 0, 0, 0], legOsc: [0, 0, 0, 0]
});

// rig: character/draw/limbs.js motionRig(spec) — { arm(두발 팔 IK 치수 | null), legTop, quad }.
// 행위를 IK로 풀고, 네발이 엎드려 잘 때 몸이 내려앉는 거리를 안다.
export function makeClock(seed, birth = 0, species = "human", rig = null) {
  const rng = makeRng(seed ^ 0x5bf03635);
  const M = MOTION[species] || MOTION.human;

  // ── init: 고정 순서 ──
  const breathe = R.initBreathe(rng);            // 1
  const blink = E.initBlink(rng);                // 2
  const glance = E.initGlance(rng);              // 3
  const surprise = E.initSurprise(rng, M);       // 4
  const squint = S.initSquint(rng);              // 5
  const regen = E.initRegen(rng);                // 6
  const mood = S.initMood(rng);                  // 7
  const emojiSchedule = E.initEmojiSchedule(rng); // 8
  const sway = R.initSway(rng, M);               // 9  (sway·rock)
  const roll = R.initRoll(rng, M);               // 10
  const dip = E.initDip(rng, M);                 // 11
  const tilt = S.initTilt(rng, M);               // 12
  const nod = E.initNod(rng);                    // 13
  const bodyAction = S.initBodyAction(rng, M);   // 14
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
  const look = S.initLook(rng, M);               // 26
  const quadAction = S.initQuadAction(rng, M);   // 27
  const mode = S.initMode(rng, M);               // 28 (기본 상태 idle/sleep — 상태가 하나뿐인 종족은 rng 안 씀)
  const zzzPhase = rng.float(0, 6);              // 29 (잠 중 z 이모지 위상 — 매 프레임 rng 없이 6초마다)

  // 강제 행위 (화면 ACTION 카드). 그 층은 이걸 계속 하고 다른 층은 idle. null이면 예약대로,
  // "idle"이면 모든 층 idle. 팔 행위(ACTIONS)는 두발, 네발 행위(QUAD_ACTIONS)는 네발, 몸 행위(BODY_ACTIONS)는 공통.
  let forced = null;
  let forcedMode = null;   // "sleep" | "idle" | null — ACTION 카드가 기본 상태도 정할 수 있다
  let forcedSide = 1;
  let forcedStart = -1;
  const arm = rig ? rig.arm : null;
  const biped = !!arm;   // 팔 리그가 있으면 두발
  const canSleep = !!(rig && rig.quad);   // 잠 자세는 네발만 정의돼 있다
  // 잠 정도 0~1. 상태가 바뀌면 여기로 이징한다 — 엎드리고 일어나는 게 튀지 않게. 태어날 때 자는 개체는 1로 시작
  let sleepK = mode.mode === "sleep" && canSleep ? 1 : 0;
  let zzzLast = -1;
  // 이모지 채널 — 모션과 별개 층. 예약(idle 중 가끔)과 모션의 이모지 트리거가 여기로 쏜다
  const emoji = initEmoji();
  const lastAction = { arm: null, quad: null };   // 행위 시작 감지용 (시작할 때 한 번만 트리거)

  // 행위 층 하나를 정한다: 강제가 없으면 예약된 것, 강제가 이 층 것이면 그것(계속), 다른 층 것이거나 "idle"이면 null.
  // makeForced(def, start)가 강제 행위의 { action, …, start, until }을 만든다.
  const resolveLayer = (t, scheduled, defs, applies, makeForced) => {
    if (!forced) return scheduled;
    if (!(applies && defs[forced])) return null;
    if (forcedStart < 0) forcedStart = t;
    return makeForced(defs[forced], forcedStart);
  };
  // 행위가 막 시작했고 이모지 트리거가 있으면 쏜다
  const fireEmoji = (key, act, defs, t) => {
    const name = act ? act.action : null;
    if (name && name !== lastAction[key] && defs[name].emoji) triggerEmoji(emoji, defs[name].emoji, t);
    lastAction[key] = name;
  };

  return {
    // 강제. null → 예약대로. "idle" → 모든 층 idle·깨어 있음. "sleep" → 잠(네발). 행위 이름 → 그 층만 그 행위, 깨어 있음
    force(action, side = 1) {
      if (!action) { forced = null; forcedMode = null; }
      else if (action === "sleep") { forced = "idle"; forcedMode = "sleep"; }
      else if (action === "idle") { forced = "idle"; forcedMode = "idle"; }
      else if (ACTIONS[action] || QUAD_ACTIONS[action] || BODY_ACTIONS[action]) { forced = action; forcedMode = "idle"; }
      else { forced = null; forcedMode = null; }
      forcedSide = side;
      forcedStart = -1;
    },
    update(globalT) {
      const t = globalT - birth;

      // ── update: 고정 순서 ──
      // 기본 상태 — idle(서 있음)/sleep(엎드려 잠). 예약은 강제 중에도 돌린다. sleepK로 자세를 섞는다
      const modeName = forcedMode || S.stepMode(mode, t, rng, M);
      const asleep = modeName === "sleep" && canSleep;
      sleepK += ((asleep ? 1 : 0) - sleepK) * 0.03;
      if (sleepK < 0.001) sleepK = 0;
      const awake = 1 - sleepK;

      // 얼굴
      const bl = E.stepBlink(blink, t, rng);
      E.stepGlanceTarget(glance, t, rng);
      // 둘러보기 — 유지 중이면 시선 목표를 그쪽으로 잡고(동공이 먼저), 얼굴이 뒤따라 돈다
      const looking = S.stepLook(look, t, rng, M);
      if (looking && !asleep) glance.gazeTarget = looking;
      const gaze0 = R.stepGaze(glance);
      const faceTurn0 = R.stepFaceTurn(glance, M, asleep ? null : looking);
      // 잠 — 눈 감고 시선 가운데, 얼굴은 살짝 아래로
      const gaze = [gaze0[0] * awake, gaze0[1] * awake];
      const faceTurn = [faceTurn0[0] * awake, faceTurn0[1] * awake - 0.35 * sleepK];
      let lid = bl.lid;
      let isHappy = bl.happy;
      lid = S.stepSquint(squint, t, rng, lid);
      if (S.stepHappy(happy, t, rng, M)) { lid = 1; isHappy = true; }
      const winkSide = sleepK > 0.5 ? 0 : S.stepWink(wink, t, rng, M);
      if (sleepK > 0.5) S.stepWink(wink, t, rng, M);   // (rng 소비 고정 — 결과만 버린다)
      const apertureBefore = surprise.start;
      const aperture0 = E.stepSurprise(surprise, t, rng, M);
      // 놀람이 막 시작하면 30%는 ! 를 쏜다 (이모지 트리거). 자는 중엔 놀라지 않는다
      if (apertureBefore < 0 && surprise.start >= 0 && rng.chance(0.3) && !asleep) triggerEmoji(emoji, "bang", t);
      lid = Math.max(lid, sleepK);
      const aperture = 1 + (aperture0 - 1) * awake;
      if (sleepK > 0.5) isHappy = false;

      // 몸통
      const sw = R.stepSway(sway, t, M);
      const tiltAngle = S.stepTilt(tilt, t, rng, M);
      const rollAngle = R.stepRoll(roll, t);
      let headBob = E.stepNod(nod, t, rng);
      headBob += E.stepDip(dip, t, rng, M);
      // 몸 행위(제자리 점프) — 팔·네발 행위와 다른 층. 예약은 강제 중에도 돌린다(rng 소비 고정).
      // 강제 점프는 쉬었다 반복 — 점프 길이 + 1.2초 주기
      let bact = resolveLayer(t, S.stepBodyAction(bodyAction, t, rng, M), BODY_ACTIONS, true, (def, start0) => {
        const period = def.hops * def.dur + 1.2;
        const start = start0 + Math.floor((t - start0) / period) * period;
        return { action: forced, start, until: start + def.hops * def.dur };
      });
      if (asleep) bact = null;   // 자는 중엔 행위 없음 (예약은 위에서 이미 돌렸다)
      const hp = bact ? jumpCurve(t - bact.start, BODY_ACTIONS[bact.action]) : { hopY: 0, squashX: 0, squashY: 0 };
      // 잠 — 몸이 밑단까지 내려앉고 납작해진다
      if (sleepK > 0 && rig) { hp.hopY -= rig.legTop * sleepK; hp.squashY -= 0.06 * sleepK; hp.squashX += 0.06 * sleepK; }
      const stretchX = E.stepStretch(stretch, t, rng, M);
      const shiverX = E.stepShiver(shiver, t, rng, M);

      // 팔 — 기본은 idle(A포즈), 행위가 있으면 그 행위가 정한 팔만 덮는다. 리그에 IK로 풀고,
      // 그 위에 진자·점프·지터를 얹는다.
      // 예약은 강제 중에도 계속 돌린다(rng 소비를 같게 — 강제를 풀어도 시계가 흐트러지지 않는다).
      const act = resolveLayer(t, S.stepArmAction(armAction, t, rng, M), ACTIONS, biped,
        (def, start) => ({ action: forced, side: forcedSide, start, until: Infinity }));
      const arms = solveArms(arm, act, t);
      const swing = R.stepArmSwing(armSwing, sway, t, M);
      for (const side of [-1, 1]) {
        const arm = arms[String(side)];
        // 진자(스웨이 역위상) · 점프 시 팔 위로 · 관절 지터. 팔꿈치는 절반 (관절이 따로 끓는다)
        let off = -side * swing;
        if (hp.hopY > 0) off += side * hp.hopY * 4;
        off += R.armJitter(armSwing, t, side);
        arm.shoulder += off;
        arm.elbow += off * 0.5;
      }

      // 다리 — 기본은 idle 자세(네발은 legStance로 선 자세, 두발은 수직). 그 위에 까딱·스텝·점프·지터.
      const legOffset = M.legStance ? [...M.legStance] : [0, 0, 0, 0];
      const legOsc = [0, 0, 0, 0];
      E.stepLegTap(legTap, t, rng, M, legOffset);
      E.stepLegStep(legStep, t, rng, M, legOffset);
      if (hp.squashY < 0) { legOffset[0] += hp.squashY * 1.5; legOffset[1] -= hp.squashY * 1.5; }
      for (let i = 0; i < 4; i += 1) legOffset[i] += R.legJitter(t, i);

      // 꼬리 · 젤리 — 꼬리 기본은 idle 각(tailIdle), 그 위에 스위시·플릭
      let tailAngle = (M.tailIdle || 0) + R.stepTailSwish(tailSwish, t);
      tailAngle += E.stepTailFlick(tailFlick, t, rng, M);
      const j = R.stepJelly(jelly, t);

      // 네발 행위 — 다리 하나·꼬리를 idle 위에 덮는다. 진동은 이징 없이(legOsc·꼬리), 봉투로 페이드
      let qact = resolveLayer(t, S.stepQuadAction(quadAction, t, rng, M), QUAD_ACTIONS, !biped, (def, start) => {
        const index = def.leg === "front" ? (forcedSide > 0 ? 1 : 0) : def.leg === "hind" ? (forcedSide > 0 ? 3 : 2) : -1;
        return { action: forced, index, start, until: Infinity };
      });
      if (asleep) qact = null;
      if (qact) {
        const def = QUAD_ACTIONS[qact.action];
        const env = ramp(Math.max(0, Math.min(1, Math.min((t - qact.start) / 0.35, (qact.until - t) / 0.35))));
        const w = Math.sin((t - qact.start) * Math.PI * 2 * ((def.osc || def.tail?.osc || { hz: 1 }).hz)) * env;
        if (qact.index >= 0) {
          legOffset[qact.index] = def.angle;
          if (def.osc) legOsc[qact.index] = def.osc.amp * w;
        }
        if (def.tail) tailAngle += def.tail.osc.amp * w;
      }

      // 잠 자세 — 다리를 몸 밑으로 접고(앞다리는 뒤로, 뒷다리는 앞으로) 꼬리를 내리고 머리를 앞발에 얹는다.
      // sleepK로 섞어 엎드리고 일어나는 게 부드럽다
      if (sleepK > 0) {
        const fold = [1.35, 1.25, -1.3, -1.2];
        for (let i = 0; i < 4; i += 1) legOffset[i] = legOffset[i] * awake + fold[i] * sleepK;
        tailAngle = tailAngle * awake - 0.55 * sleepK;
      }
      const sleepHead = sleepK * 0.32 * (seed % 2 ? 1 : -1);      // 머리를 한쪽으로 기울여 얹는다
      const sleepBob = -0.05 * sleepK;

      // 표정 상태 · 이벤트
      const md = S.stepMood(mood, t, rng);
      const regenNow = E.stepRegen(regen, t, rng);
      // 호흡 — 자면 느리고 깊게
      const br = R.stepBreathe(breathe, t * (1 - 0.35 * sleepK)) * (1 + 0.6 * sleepK);
      // 잠 중 z — 6초마다 (위상은 개체별). rng 없이
      if (sleepK > 0.5) {
        const tick = Math.floor((t - zzzPhase) / 6);
        if (tick !== zzzLast) { zzzLast = tick; triggerEmoji(emoji, "zzz", t); }
      } else zzzLast = -1;

      // 이모지 — 예약된 것(idle 중 가끔) + 모션의 트리거(행위가 시작하는 순간 한 번). 채널이 애니메이션을 돈다
      const scheduledEmoji = E.stepEmojiSchedule(emojiSchedule, t, rng, M);
      if (scheduledEmoji) triggerEmoji(emoji, scheduledEmoji, t);
      fireEmoji("arm", act, ACTIONS, t);
      fireEmoji("quad", qact, QUAD_ACTIONS, t);
      const em = stepEmoji(emoji, t);

      return {
        breathe: br, lid, gaze, aperture, regen: regenNow, emoji: em,
        browAlt: md.browAlt, mouthAlt: md.mouthAlt,
        sway: sw.sway, rock: sw.rock, headAngle: (tiltAngle + rollAngle) * awake + sleepHead, headBob: headBob * awake + sleepBob,
        hopY: hp.hopY, squashX: hp.squashX, squashY: hp.squashY, stretchX, shiverX,
        jellyX: j.jellyX, jellyY: j.jellyY, faceTurn: [faceTurn[0], faceTurn[1]],
        happy: isHappy, winkSide, tailAngle,
        arms, legOffset, legOsc,
        mode: modeName, sleep: sleepK,
        // 지금 하는 행위 — 팔 층(두발) 또는 다리·꼬리 층(네발) + 어느 쪽(활동 팔 side / 다리 index), 그리고 몸 층. 디버그·통계용
        action: act ? act.action : qact ? qact.action : null,
        actionSide: act ? act.side : qact ? qact.index : 0,
        bodyAction: bact ? bact.action : null
      };
    }
  };
}
