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
import { ramp, smoothstep, envelope, damp } from "./ease.js";

export { MOTION } from "./table.js";
export { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS, ARM_POSES, bindArm, solveArm, solveArms } from "./actions.js";
export { EMOJI } from "./emoji.js";

// 바인드 상태 — 아무 모션도 받지 않은 캐릭터. 모든 값이 정지·기본이다: 두발은 팔 T포즈,
// 네발은 다리 수직·꼬리 그린 그대로. scene이 BIND 뷰에서 clock 대신 이걸 리그에 넣는다.
// (모션의 기본 상태는 이게 아니라 idle이다 — 두발 A포즈, 네발 선 자세(legStance·tailIdle). 바인드는 모션이 없을 때다.)
export const BIND_STATE = Object.freeze({
  breathe: 0, lid: 0, gaze: [0, 0], startle: 0, eyeFx: null, regen: false, emoji: null,
  browAlt: false, mouthAlt: false,
  sway: 0, rock: 0, headAngle: 0, headBob: 0,
  hopY: 0, squashX: 0, squashY: 0, stretchX: 0, shiverX: 0,
  jellyX: 0, jellyY: 0, faceTurn: [0, 0],
  happy: false, winkSide: 0, tailAngle: 0, tailTip: 0, tailPuff: 0,
  arms: { "-1": bindArm(-1), "1": bindArm(1) }, action: null, actionSide: 0, bodyAction: null,
  mode: "idle", sleep: 0, walk: 0, walkX: 0, facing: 1,
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
  // 꼬리 끝 마디(고양이 위주) — 팔로스루 상태·채찍질·세움. 예약이 아니라 이벤트에 딸려 시작하므로 rng는 시작할 때만
  const TT = M.tailTip || null;
  const tailFollow = { x: 0, v: 0 };
  let tailPrevBase = null;
  const lash = { start: -1 };
  const raise = { until: -1, start: -1 };

  // 강제 행위 (화면 ACTION 카드). 그 층은 이걸 계속 하고 다른 층은 idle. null이면 예약대로,
  // "idle"이면 모든 층 idle. 팔 행위(ACTIONS)는 두발, 네발 행위(QUAD_ACTIONS)는 네발, 몸 행위(BODY_ACTIONS)는 공통.
  let forced = null;
  let forcedMode = null;   // "sleep" | "walk" | "idle" | null — ACTION 카드가 기본 상태도 정할 수 있다
  let forcedSide = 1;
  let forcedStart = -1;
  const arm = rig ? rig.arm : null;
  const quad = !!(rig && rig.quad);
  const armed = !!arm;   // 팔 리그가 있어야 팔 행위 층이 산다 (팔 없는 도깨비는 두발이어도 쉰다)
  const canSleep = quad;   // 잠 자세는 네발만 정의돼 있다
  // 잠 정도 0~1. 상태가 바뀌면 여기로 이징한다 — 엎드리고 일어나는 게 튀지 않게. 태어날 때 자는 개체는 1로 시작
  let sleepK = mode.mode === "sleep" && canSleep ? 1 : 0;
  // 걷기 정도 0~1 (걷기 상태로 이징). 걸음 위상은 개체별로 어긋나게 — rng 없이 시드로
  const W = M.walk || null;
  let walkK = mode.mode === "walk" && W ? 1 : 0;
  const walkPhase = ((seed % 97) / 97) * Math.PI * 2;
  // 걷기는 자리를 옮긴다 — 집(셀 가운데, x 0)에서 왼쪽이나 오른쪽으로 조금 걸어가 거기서 평소처럼 idle(자기도) 하다가,
  // 다음 걷기는 **무조건 온 방향으로** 집에 돌아온다. leg = 한 번의 이동 { from, to, start, dur }. 속도는 종족(W.speed, 셀/초)
  const trip = { x: 0, from: 0, to: 0, start: -1, dur: 0, dir: 0 };
  let facing = 1;                 // 네발만 뒤집는다: 오른쪽으로 걸을 땐 -1(거울). 0을 지나며 종이처럼 얇아졌다 뒤집힌다
  let lastMode = mode.mode;
  const startLeg = (t) => {
    const home = Math.abs(trip.x) < 1e-4;
    if (home) {   // 집에서 출발 — 방향과 거리는 rng
      trip.dir = rng.chance(0.5) ? 1 : -1;
      trip.to = trip.dir * rng.float(W.trip[0], W.trip[1]);
    } else {      // 밖에서 출발 — 집으로만
      trip.dir = trip.x > 0 ? -1 : 1;
      trip.to = 0;
    }
    trip.from = trip.x;
    trip.start = t;
    trip.dur = Math.abs(trip.to - trip.from) / W.speed;
  };
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
      else if (action === "walk") { forced = null; forcedMode = "walk"; }   // 걷는 중에도 팔 행위는 예약대로 (걸으며 인사)
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
      let modeName = forcedMode || S.stepMode(mode, t, rng, M);
      // 걷기 시작 — 이동 한 구간을 잡고, 걷기 유지는 도착까지로 맞춘다 (표의 walk 유지 대신 거리/속도)
      if (W && modeName === "walk" && (lastMode !== "walk" || trip.start < 0)) {
        startLeg(t);
        if (!forcedMode) mode.next = t + trip.dur + 0.2;
      }
      if (W && modeName === "walk" && trip.start >= 0 && t >= trip.start + trip.dur) {
        // 도착. 강제 걷기면 바로 다음 구간(집↔밖 왕복), 아니면 상태 기계가 idle로 넘긴다
        trip.x = trip.to; trip.start = -1;
        if (forcedMode === "walk") startLeg(t);
        else { modeName = "idle"; mode.mode = "idle"; mode.next = t + rng.float(M.modeHold.idle[0], M.modeHold.idle[1]); }
      }
      if (trip.start >= 0 && modeName === "walk") {
        const p = smoothstep(0, 1, (t - trip.start) / Math.max(trip.dur, 1e-6));
        trip.x = trip.from + (trip.to - trip.from) * p;
      }
      lastMode = modeName;
      // 네발은 걷는 방향을 본다 — 오른쪽이면 거울(-1). 집에 돌아와 서면 다시 왼쪽(+1). 밖에서 idle 중엔 마지막 방향 그대로
      const facingTarget = !quad ? 1 : (modeName === "walk" && trip.start >= 0) ? (trip.dir > 0 ? -1 : 1) : (Math.abs(trip.x) < 1e-4 ? 1 : facing < 0 ? -1 : 1);
      facing += (facingTarget - facing) * 0.18;
      const asleep = modeName === "sleep" && canSleep;
      sleepK += ((asleep ? 1 : 0) - sleepK) * 0.03;
      if (sleepK < 0.001) sleepK = 0;
      const awake = 1 - sleepK;
      // 걷기 — 제자리 걸음. walkK로 들어가고 나온다(0.5초쯤). 걸음 위상 ph는 t 기반이라 끊기지 않는다
      const walking = modeName === "walk" && !!W;
      walkK += ((walking ? 1 : 0) - walkK) * 0.06;
      if (walkK < 0.001) walkK = 0;
      const ph = W ? t * Math.PI * 2 * W.hz + walkPhase : 0;
      const stepBump = 0.5 - 0.5 * Math.cos(2 * ph);   // 걸음마다 한 번(주기의 두 배) 0→1→0

      // 얼굴
      const bl = E.stepBlink(blink, t, rng);
      E.stepGlanceTarget(glance, t, rng);
      // 둘러보기 — 유지 중이면 시선 목표를 그쪽으로 잡고(동공이 먼저), 얼굴이 뒤따라 돈다
      let looking = S.stepLook(look, t, rng, M);
      if (!quad && modeName === "walk" && trip.start >= 0) looking = [trip.dir * 0.9, 0];   // 두발은 걷는 쪽을 본다
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
      const startleBefore = surprise.start;
      const startle0 = E.stepSurprise(surprise, t, rng, M);
      // 놀람이 막 시작하면 — ♥ 변형은 ♥ 이모지를 같이, 나머지는 30%로 ! 를 쏜다 (이모지 트리거). 자는 중엔 놀라지 않는다
      if (startleBefore < 0 && surprise.start >= 0 && !asleep) {
        if (surprise.variant === "heart") triggerEmoji(emoji, "heart", t);
        else if (rng.chance(0.3)) triggerEmoji(emoji, "bang", t);
      }
      lid = Math.max(lid, sleepK);
      const startle = startle0 * awake;   // 놀람 0~1 — 동공 수축량
      // 놀람의 눈 변형 — ☆_☆ / ♥_♥ 로 눈이 바뀐다 (scene이 눈 위에 덮개+글리프를 얹는다). k는 놀람 봉투 그대로
      const eyeFx = startle > 0 && surprise.variant && surprise.variant !== "plain" ? { kind: surprise.variant, k: startle } : null;
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
      if (asleep || walkK > 0.5) bact = null;   // 자는 중·걷는 중엔 몸 행위 없음 (예약은 위에서 이미 돌렸다)
      const hp = bact ? jumpCurve(t - bact.start, BODY_ACTIONS[bact.action]) : { hopY: 0, squashX: 0, squashY: 0 };
      // 걷기 — 걸음마다 몸이 살짝 들썩인다
      if (walkK > 0 && W) hp.hopY += W.bob * stepBump * walkK;
      // 잠 — 몸이 밑단까지 내려앉고 납작해진다
      if (sleepK > 0 && rig) { hp.hopY -= rig.legTop * sleepK; hp.squashY -= 0.06 * sleepK; hp.squashX += 0.06 * sleepK; }
      const stretchX = E.stepStretch(stretch, t, rng, M);
      const shiverX = E.stepShiver(shiver, t, rng, M);

      // 팔 — 기본은 idle(A포즈), 행위가 있으면 그 행위가 정한 팔만 덮는다. 리그에 IK로 풀고,
      // 그 위에 진자·점프·지터를 얹는다.
      // 예약은 강제 중에도 계속 돌린다(rng 소비를 같게 — 강제를 풀어도 시계가 흐트러지지 않는다).
      const scheduledArm = S.stepArmAction(armAction, t, rng, M);   // 예약은 팔이 없어도 돌린다 (rng 소비 고정)
      const act = armed ? resolveLayer(t, scheduledArm, ACTIONS, true,
        (def, start) => ({ action: forced, side: forcedSide, start, until: Infinity })) : null;
      const arms = solveArms(arm, act, t);
      const swing = R.stepArmSwing(armSwing, sway, t, M);
      for (const side of [-1, 1]) {
        const arm = arms[String(side)];
        // 진자(스웨이 역위상) · 점프 시 팔 위로 · 관절 지터. 팔꿈치는 절반 (관절이 따로 끓는다)
        let off = -side * swing;
        if (hp.hopY > 0 && !(walkK > 0.5)) off += side * hp.hopY * 4;
        if (walkK > 0 && W) off += Math.sin(ph + (side > 0 ? Math.PI : 0)) * W.arm * walkK;   // 걷기 — 팔이 다리와 엇갈려 흔들린다
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
      // 걷기 — 네발은 대각선 쌍(0·3 / 1·2)이 번갈아 앞뒤로, 두발은 두 다리가 번갈아 벌렸다 모은다(정면 걸음)
      if (walkK > 0 && W) {
        const s = Math.sin(ph) * W.leg * walkK;
        if (quad) { legOffset[0] += s; legOffset[3] += s; legOffset[1] -= s; legOffset[2] -= s; }
        else { legOffset[0] += s; legOffset[1] -= s; }
      }
      for (let i = 0; i < 4; i += 1) legOffset[i] += R.legJitter(t, i);

      // 꼬리 · 젤리 — 꼬리 기본은 idle 각(tailIdle), 그 위에 스위시·플릭. 끝 마디(tailTip)는 뿌리 기준 상대각
      let tailAngle = (M.tailIdle || 0) + R.stepTailSwish(tailSwish, t);
      let tailTip = 0;
      const flick = E.stepTailFlick(tailFlick, t, rng, M);
      // 고양이는 플릭이 **끝만 톡톡**(twitch — 뿌리는 가만), 개는 통째로 플릭
      if (TT && TT.twitch) tailTip += flick * (TT.twitch.amp / 0.35);
      else tailAngle += flick;
      if (walkK > 0 && W && quad && W.tail) tailAngle += Math.sin(ph) * W.tail * walkK;   // 걷기 — 개만 꼬리가 걸음에 맞춰 살랑 (table walk.tail)
      // 놀람에 딸린 꼬리 — 채찍질(plain 변형 시작 때 lash 확률) · 세움(♥ 변형 시작 때) · 부풀림(시작 순간)
      let tailPuff = 0;
      if (TT && quad && startleBefore < 0 && surprise.start >= 0 && !asleep) {
        if (surprise.variant === "heart" && TT.raise) { raise.start = t; raise.until = t + rng.float(TT.raise.hold[0], TT.raise.hold[1]); }
        else if (surprise.variant === "plain" && TT.lash > 0 && rng.chance(TT.lash)) lash.start = t;
      }
      if (TT && TT.puff && surprise.start >= 0) {
        const kp = (t - surprise.start) / 1.2;
        if (kp < 1) tailPuff = envelope(kp, 0.1, 0.5) * TT.puff;
      }
      if (lash.start >= 0) {
        // 채찍질 — 뿌리+끝 크게 3번, 1초. 끝은 같은 방향으로 조금 덜
        const k = (t - lash.start) / 1.0;
        if (k >= 1) lash.start = -1;
        else { const w = Math.sin(k * Math.PI * 6) * envelope(k, 0.12, 0.4); tailAngle += w * 0.6; tailTip += w * 0.4; }
      }
      if (raise.until >= 0) {
        // 세움 — 뿌리를 위로 들고(ramp 0.4초) 유지, 끝은 잔떨림(quiver). 유지가 끝나면 0.6초에 내린다
        const kIn = ramp(Math.min(1, (t - raise.start) / 0.4));
        const kOut = t > raise.until ? 1 - ramp(Math.min(1, (t - raise.until) / 0.6)) : 1;
        const kr = kIn * kOut;
        if (t > raise.until + 0.6) raise.until = -1;
        tailAngle += TT.raise.angle * kr;
        tailTip += Math.sin(t * Math.PI * 2 * TT.raise.quiver[1]) * TT.raise.quiver[0] * kr;
      }
      const j = R.stepJelly(jelly, t);

      // 네발 행위 — 다리 하나·꼬리를 idle 위에 덮는다. 진동은 이징 없이(legOsc·꼬리), 봉투로 페이드
      // 강제 네발 행위는 그 종족 목록에 있는 것만 — 고양이는 꼬리 흔들기(wag)를 안 한다 (표에 없다), 강제해도 idle
      const quadApplies = quad && (!forced || (M.quadActions || []).some(([name]) => name === forced));
      let qact = resolveLayer(t, S.stepQuadAction(quadAction, t, rng, M), QUAD_ACTIONS, quadApplies, (def, start) => {
        const index = def.leg === "front" ? (forcedSide > 0 ? 1 : 0) : def.leg === "hind" ? (forcedSide > 0 ? 3 : 2) : -1;
        return { action: forced, index, start, until: Infinity };
      });
      if (asleep || walkK > 0.5) qact = null;   // 자는 중·걷는 중엔 네발 행위 없음
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
        tailTip = tailTip * awake - 0.6 * sleepK;   // 끝을 더 접어 몸에 붙인다
      }
      // 팔로스루 — 끝 마디는 뿌리 각속도의 반대로 조금 늦게 따라온다 (임계감쇠). 프레임 기반이라 결정적
      if (TT && TT.follow) {
        const vel = tailPrevBase === null ? 0 : tailAngle - tailPrevBase;
        tailPrevBase = tailAngle;
        damp(tailFollow, Math.max(-0.5, Math.min(0.5, -vel * TT.follow * 60)), 0.25);
        tailTip += tailFollow.x;
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
        breathe: br, lid, gaze, startle, eyeFx, regen: regenNow, emoji: em,
        browAlt: md.browAlt, mouthAlt: md.mouthAlt,
        sway: sw.sway + (walkK > 0 && W ? Math.sin(ph) * W.sway * walkK : 0), rock: sw.rock,
        headAngle: (tiltAngle + rollAngle) * awake + sleepHead,
        headBob: headBob * awake + sleepBob + (walkK > 0 && W ? W.bob * 0.5 * stepBump * walkK : 0),
        hopY: hp.hopY, squashX: hp.squashX, squashY: hp.squashY, stretchX, shiverX,
        jellyX: j.jellyX, jellyY: j.jellyY, faceTurn: [faceTurn[0], faceTurn[1]],
        happy: isHappy, winkSide, tailAngle, tailTip, tailPuff,
        arms, legOffset, legOsc,
        mode: modeName, sleep: sleepK, walk: walkK, walkX: trip.x, facing,
        // 지금 하는 행위 — 팔 층(두발) 또는 다리·꼬리 층(네발) + 어느 쪽(활동 팔 side / 다리 index), 그리고 몸 층. 디버그·통계용
        action: act ? act.action : qact ? qact.action : null,
        actionSide: act ? act.side : qact ? qact.index : 0,
        bodyAction: bact ? bact.action : null
      };
    }
  };
}
