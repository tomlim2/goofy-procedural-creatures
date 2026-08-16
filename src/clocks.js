// 개체별 시계. 35마리가 같은 박자로 움직이면 기계처럼 보인다.
//
// 종족마다 지배 모션이 다르다 (레퍼런스 2차 관찰, video-notes 26~32):
//   kid — 좌우·앞뒤 락킹, 폴짝, 팔 포즈
//   pup — 머리 롤·딥, 행복 눈 유지, 꼬리 플릭
//   cat — 꼬리 스위시 상시, 갸웃, 윙크, 기지개
//   imp — 젤리 워블, 부르르, 눈 사이클, "..." 중얼
// 움직임은 이징으로 매끄럽게, 선(보일)만 끓는다.

import { makeRng } from "./rng.js";

const BLINK_TIME = 0.13;

// 종족별 모션 성격. [min, max]는 이벤트 간격(초), null은 그 모션 없음.
const MOTION = {
  kid: {
    // 팔: 레퍼런스에서 팔은 벌린 채 미세하게만 흔들린다. 큰 동작은 드물게.
    armSwing: 0.045, armLift: [18, 40], armWave: [30, 70],
    // 다리: 발 까딱 드물게. 다리는 바닥에 붙어 거의 정지한다.
    legTap: [12, 30], legStep: null,
    sway: [0.012, 0.032], swayPeriod: [2.6, 4.6],
    rock: 0.006,
    roll: null, dip: null,
    hop: [40, 90], stretch: null,
    tilt: [7, 18], tiltAmp: 0.1,
    jelly: null, shiver: [26, 60],
    arm: [5, 14], wink: null, happyHold: null,
    tailSwish: null, tailFlick: null,
    surprise: [8, 22], yaw: 0.5,
    emotes: ["heart", "bang", "quest"]
  },
  pup: {
    armSwing: 0, armLift: null, armWave: null,
    // 레퍼런스의 개 다리는 4초 내내 바닥 고정. 몸이 흔들려 다리가 따라 보일 뿐이다.
    legTap: [14, 32], legStep: [30, 70],
    sway: [0.004, 0.01], swayPeriod: [3, 6],
    rock: 0.003,
    roll: { amp: [0.07, 0.14], period: [2.4, 4.8] },
    dip: [4, 10],
    hop: [30, 70], stretch: null,
    tilt: [9, 20], tiltAmp: 0.08,
    jelly: null, shiver: [40, 80],
    arm: null, wink: null, happyHold: [6, 16],
    tailSwish: null, tailFlick: [3, 9],
    surprise: [10, 26], yaw: 0.7,
    emotes: ["heart", "bang", "quest"]
  },
  cat: {
    armSwing: 0, armLift: null, armWave: null,
    // 앞발 꾹꾹이 드물게, 스텝은 더 드물게
    legTap: [16, 36], legStep: [40, 90],
    sway: [0.002, 0.007], swayPeriod: [3.5, 7],
    rock: 0.004,
    roll: null, dip: null,
    hop: null, stretch: [10, 26],
    tilt: [5, 12], tiltAmp: 0.14,
    jelly: null, shiver: [40, 90],
    arm: null, wink: [8, 20], happyHold: null,
    tailSwish: { amp: [0.16, 0.3], period: [2.4, 5] }, tailFlick: [4, 11],
    surprise: [9, 24], yaw: 0.8,
    emotes: ["heart", "quest", "bang"]
  },
  imp: {
    // 짧은 스텁 팔. 젤리 워블에 딸려 미세하게 떨릴 뿐이다.
    armSwing: 0.06, armLift: [22, 50], armWave: [40, 90],
    legTap: [14, 34], legStep: null,
    sway: [0.015, 0.04], swayPeriod: [2, 3.8],
    rock: 0.004,
    roll: null, dip: null,
    hop: [50, 110], stretch: null,
    tilt: [8, 18], tiltAmp: 0.09,
    jelly: { amp: [0.008, 0.018], freq: [1.1, 1.9] }, shiver: [12, 30],
    arm: [8, 20], wink: null, happyHold: null,
    tailSwish: null, tailFlick: null,
    surprise: [4, 12], yaw: 0.6,
    emotes: ["dots", "dots", "bang", "quest", "heart"]
  }
};

export function makeClock(seed, birth = 0, species = "kid", armRest = "rest", noRest = false) {
  const rng = makeRng(seed ^ 0x5bf03635);
  const M = MOTION[species] || MOTION.kid;

  const breathePeriod = rng.float(2.6, 5.4);
  const breathePhase = rng.float(0, Math.PI * 2);

  let nextBlink = rng.float(0, 4);
  let blinkStart = -1;
  let blinkHappy = false;

  let nextGlance = rng.float(0, 3);
  let gaze = [0, 0];
  let gazeTarget = [0, 0];

  let nextSurprise = rng.float(M.surprise[0], M.surprise[1]);
  let surpriseStart = -1;

  let nextSquint = rng.float(6, 18);
  let squintUntil = -1;

  let regenAt = rng.float(6, 14);

  let nextMood = rng.float(3, 10);
  let moodUntil = -1;
  let nextMouth = rng.float(2, 8);
  let mouthUntil = -1;

  let nextEmote = rng.float(5, 30);
  let emoteStart = -1;
  let emoteKind = "heart";

  // ── 몸통 idle ──
  const swayAmp = rng.float(M.sway[0], M.sway[1]);
  const swayPeriod = rng.float(M.swayPeriod[0], M.swayPeriod[1]);
  const swayPhase = rng.float(0, Math.PI * 2);

  // 앞뒤 락킹 — y스케일 미세 진동. 좌우 스웨이와 다른 주기라 어긋난다.
  const rockPeriod = rng.float(2.1, 3.9);
  const rockPhase = rng.float(0, Math.PI * 2);

  const roll = M.roll
    ? { amp: rng.float(M.roll.amp[0], M.roll.amp[1]), period: rng.float(M.roll.period[0], M.roll.period[1]), phase: rng.float(0, Math.PI * 2) }
    : null;

  let nextDip = M.dip ? rng.float(M.dip[0], M.dip[1]) : Infinity;
  let dipStart = -1;

  let nextTilt = rng.float(M.tilt[0], M.tilt[1]);
  let tiltUntil = -1;
  let tiltTarget = 0;
  let headAngle = 0;

  let nextNod = rng.float(9, 24);
  let nodStart = -1;

  let nextHop = M.hop ? rng.float(M.hop[0], M.hop[1]) : Infinity;
  let hopStart = -1;

  let nextStretch = M.stretch ? rng.float(M.stretch[0], M.stretch[1]) : Infinity;
  let stretchStart = -1;

  let nextShiver = rng.float(M.shiver[0], M.shiver[1]);
  let shiverStart = -1;

  let nextArm = M.arm ? rng.float(M.arm[0], M.arm[1]) : Infinity;
  let armUntil = -1;

  // ── 팔다리 ──
  const armSwingPhase = rng.float(0, Math.PI * 2);
  // 팔 자세. 쉼 자세는 개체 성격(spec.proportions.armRest)이고 clock은
  // 그 자세를 기본으로 두다가 이따금 다른 자세로 넘어갔다 돌아온다.
  const restPose = armRest || "rest";
  let armPose = restPose;
  let nextPoseChange = rng.float(8, 24);
  let poseUntil = -1;
  let nextArmLift = M.armLift ? rng.float(M.armLift[0], M.armLift[1]) : Infinity;
  let armLiftUntil = -1;
  let armLiftSide = 0;
  let nextArmWave = M.armWave ? rng.float(M.armWave[0], M.armWave[1]) : Infinity;
  let armWaveStart = -1;
  let armWaveSide = 0;

  let nextLegTap = M.legTap ? rng.float(M.legTap[0], M.legTap[1]) : Infinity;
  let legTapStart = -1;
  let legTapIndex = 0;
  let nextLegStep = M.legStep ? rng.float(M.legStep[0], M.legStep[1]) : Infinity;
  let legStepStart = -1;

  let nextWink = M.wink ? rng.float(M.wink[0], M.wink[1]) : Infinity;
  let winkUntil = -1;
  let winkSide = 0;

  let nextHappy = M.happyHold ? rng.float(M.happyHold[0], M.happyHold[1]) : Infinity;
  let happyUntil = -1;

  const tailSwish = M.tailSwish
    ? { amp: rng.float(M.tailSwish.amp[0], M.tailSwish.amp[1]), period: rng.float(M.tailSwish.period[0], M.tailSwish.period[1]), phase: rng.float(0, Math.PI * 2) }
    : null;
  let nextFlick = M.tailFlick ? rng.float(M.tailFlick[0], M.tailFlick[1]) : Infinity;
  let flickStart = -1;

  const jelly = M.jelly
    ? { amp: rng.float(M.jelly.amp[0], M.jelly.amp[1]), freq: rng.float(M.jelly.freq[0], M.jelly.freq[1]), phase: rng.float(0, Math.PI * 2) }
    : null;

  let faceYaw = 0;

  return {
    update(globalT) {
      const t = globalT - birth;

      if (t >= nextBlink) {
        blinkStart = t;
        // 깜빡임의 일부는 ^^ 로 닫힌다
        blinkHappy = rng.chance(0.22);
        nextBlink = t + rng.float(1.8, 6.5);
        if (rng.chance(0.22)) nextBlink = t + BLINK_TIME * 2.4;
      }

      if (t >= nextGlance) {
        gazeTarget = [rng.around(0, 1), rng.around(0, 0.7)];
        nextGlance = t + rng.float(1.4, 5.0);
      }
      gaze = [gaze[0] + (gazeTarget[0] - gaze[0]) * 0.12, gaze[1] + (gazeTarget[1] - gaze[1]) * 0.12];

      // 얼굴 요 — 이목구비가 시선을 천천히 따라간다. 머리를 돌린 착시.
      faceYaw += (gaze[0] * M.yaw - faceYaw) * 0.06;

      let lid = 0;
      let happy = false;
      if (blinkStart >= 0) {
        const k = (t - blinkStart) / BLINK_TIME;
        if (k >= 1) blinkStart = -1;
        else {
          lid = Math.sin(Math.min(1, k) * Math.PI);
          if (blinkHappy && lid > 0.7) happy = true;
        }
      }

      if (t >= nextSquint && squintUntil < 0) {
        squintUntil = t + rng.float(1.2, 2.8);
        nextSquint = t + rng.float(8, 20);
      }
      if (squintUntil >= 0) {
        if (t >= squintUntil) squintUntil = -1;
        else lid = Math.max(lid, 0.5);
      }

      // 행복 눈 유지 — 눈을 ^^ 로 닫고 몇 초 버틴다 (개)
      if (t >= nextHappy && happyUntil < 0) {
        happyUntil = t + rng.float(2, 5);
        nextHappy = t + rng.float(M.happyHold[0], M.happyHold[1]);
      }
      if (happyUntil >= 0) {
        if (t >= happyUntil) happyUntil = -1;
        else { lid = 1; happy = true; }
      }

      // 윙크 — 한쪽만 감는다 (고양이)
      if (t >= nextWink && winkUntil < 0) {
        winkSide = rng.chance(0.5) ? -1 : 1;
        winkUntil = t + rng.float(0.5, 1.3);
        nextWink = t + rng.float(M.wink[0], M.wink[1]);
      }
      if (winkUntil >= 0 && t >= winkUntil) { winkUntil = -1; winkSide = 0; }

      let aperture = 1;
      if (t >= nextSurprise && surpriseStart < 0) {
        surpriseStart = t;
        nextSurprise = t + rng.float(M.surprise[0], M.surprise[1]);
      }
      if (surpriseStart >= 0) {
        const k = (t - surpriseStart) / 1.1;
        if (k >= 1) surpriseStart = -1;
        else aperture = 1 + 0.65 * Math.pow(Math.sin(Math.PI * k), 0.6);
      }

      // ── 몸통 ──
      const sway = Math.sin((t / swayPeriod) * Math.PI * 2 + swayPhase) * swayAmp;
      const rock = Math.sin((t / rockPeriod) * Math.PI * 2 + rockPhase) * (M.rock || 0);

      if (t >= nextTilt && tiltUntil < 0) {
        tiltTarget = rng.around(0, M.tiltAmp);
        tiltUntil = t + rng.float(1.2, 3.2);
        nextTilt = t + rng.float(M.tilt[0], M.tilt[1]);
      }
      if (tiltUntil >= 0 && t >= tiltUntil) tiltUntil = -1;
      const rollAngle = roll ? Math.sin((t / roll.period) * Math.PI * 2 + roll.phase) * roll.amp : 0;
      headAngle += ((tiltUntil >= 0 ? tiltTarget : 0) - headAngle) * 0.07;

      let headBob = 0;
      if (t >= nextNod && nodStart < 0) {
        nodStart = t;
        nextNod = t + rng.float(9, 24);
      }
      if (nodStart >= 0) {
        const k = (t - nodStart) / 0.7;
        if (k >= 1) nodStart = -1;
        else headBob = -Math.abs(Math.sin(k * Math.PI * 2)) * 0.014;
      }

      // 킁킁 딥 — 머리가 깊게 내려갔다 온다 (개)
      if (t >= nextDip && dipStart < 0) {
        dipStart = t;
        nextDip = t + rng.float(M.dip[0], M.dip[1]);
      }
      if (dipStart >= 0) {
        const k = (t - dipStart) / 1.2;
        if (k >= 1) dipStart = -1;
        else headBob -= Math.sin(Math.min(1, k) * Math.PI) * 0.035;
      }

      let hopY = 0;
      let squashX = 0;
      let squashY = 0;
      if (t >= nextHop && hopStart < 0) {
        hopStart = t;
        nextHop = t + rng.float(M.hop[0], M.hop[1]);
      }
      if (hopStart >= 0) {
        const k = (t - hopStart) / 0.55;
        if (k >= 1) hopStart = -1;
        else if (k < 0.2) {
          squashY = -0.07 * Math.sin((k / 0.2) * Math.PI);
          squashX = -squashY * 0.8;
        } else if (k < 0.8) {
          const j = (k - 0.2) / 0.6;
          hopY = Math.sin(j * Math.PI) * 0.05;
          squashY = 0.05 * Math.sin(j * Math.PI);
          squashX = -squashY * 0.7;
        } else {
          squashY = -0.05 * Math.sin(((k - 0.8) / 0.2) * Math.PI);
          squashX = -squashY * 0.8;
        }
      }

      // 기지개 — 가로로 쭉 (고양이)
      let stretchX = 0;
      if (t >= nextStretch && stretchStart < 0) {
        stretchStart = t;
        nextStretch = t + rng.float(M.stretch[0], M.stretch[1]);
      }
      if (stretchStart >= 0) {
        const k = (t - stretchStart) / 1.6;
        if (k >= 1) stretchStart = -1;
        else stretchX = Math.sin(Math.min(1, k) * Math.PI) * 0.06;
      }

      let shiverX = 0;
      if (t >= nextShiver && shiverStart < 0) {
        shiverStart = t;
        nextShiver = t + rng.float(M.shiver[0], M.shiver[1]);
      }
      if (shiverStart >= 0) {
        const k = (t - shiverStart) / 0.35;
        if (k >= 1) shiverStart = -1;
        else shiverX = Math.sin(k * Math.PI * 9) * 0.008 * (1 - k);
      }

      // 팔 포즈 전환
      if (t >= nextArm && armUntil < 0) {
        armUntil = t + rng.float(1, 3);
        nextArm = t + rng.float(M.arm[0], M.arm[1]);
      }
      if (armUntil >= 0 && t >= armUntil) armUntil = -1;

      // ── 팔 자세 ──
      // 쉼 자세에서 이따금 다른 자세로. 뒷짐인 개체가 팔을 꺼내 벌리거나,
      // 늘어뜨린 개체가 잠깐 뒷짐지거나.
      if (t >= nextPoseChange && poseUntil < 0) {
        // 매우 긴 팔은 늘어뜨리면 바닥을 뚫으므로 rest 자세를 후보에서 뺀다
        const others = ["rest", "out", "behind", "up"].filter((p) => p !== restPose && !(noRest && p === "rest"));
        armPose = rng.weighted(others.map((p) => [p, p === "up" ? 0.5 : p === "behind" ? 1.5 : 2]));
        poseUntil = t + rng.float(2, 6);
        nextPoseChange = t + rng.float(12, 36);
      }
      if (poseUntil >= 0 && t >= poseUntil) { poseUntil = -1; armPose = restPose; }

      // ── 팔 ──
      // 기본 흔들림: 스웨이와 반대 위상으로 살짝 진자 운동
      const armSwing = Math.sin((t / swayPeriod) * Math.PI * 2 + swayPhase + Math.PI + armSwingPhase * 0.3) * (M.armSwing || 0);
      // 한 팔 들기 — 몇 초 유지
      if (t >= nextArmLift && armLiftUntil < 0) {
        armLiftSide = rng.chance(0.5) ? -1 : 1;
        armLiftUntil = t + rng.float(1.2, 3);
        nextArmLift = t + rng.float(M.armLift[0], M.armLift[1]);
      }
      if (armLiftUntil >= 0 && t >= armLiftUntil) { armLiftUntil = -1; armLiftSide = 0; }
      // 손 흔들기 — 들어 올린 채 좌우로 파닥
      let armWaveK = -1;
      if (t >= nextArmWave && armWaveStart < 0) {
        armWaveStart = t;
        armWaveSide = rng.chance(0.5) ? -1 : 1;
        nextArmWave = t + rng.float(M.armWave[0], M.armWave[1]);
      }
      if (armWaveStart >= 0) {
        armWaveK = (t - armWaveStart) / 1.6;
        if (armWaveK >= 1) { armWaveStart = -1; armWaveK = -1; }
      }
      // 팔별 목표 회전(기준각 대비 오프셋). 스무딩은 scene이 한다.
      const armOffset = { "-1": armSwing, "1": -armSwing };
      for (const side of [-1, 1]) {
        const key = String(side);
        const outward = -side;
        // 레퍼런스 실측: 팔 동작은 작다. 들기 ~0.5rad, 손 흔들기는 그 위에 잔진동.
        if (armLiftSide === side) armOffset[key] += outward * 0.55;
        if (armWaveK >= 0 && armWaveSide === side) {
          const env = Math.sin(Math.min(1, armWaveK) * Math.PI);
          armOffset[key] += outward * 0.7 * env + Math.sin(armWaveK * Math.PI * 6) * 0.18 * env;
        }
        // 폴짝 때 팔이 살짝 뜬다
        if (hopY > 0) armOffset[key] += outward * hopY * 4;
        // 관절 지터 — 팔도 선처럼 미세하게 끓는다. 이게 레퍼런스 팔의 실체다.
        armOffset[key] += Math.sin(t * 7.3 + side * 2.1 + armSwingPhase) * 0.012
          + Math.sin(t * 11.7 + side * 0.7) * 0.008;
      }

      // ── 다리 ──
      // 발 까딱 — 한 발을 발끝 축으로 톡톡
      let legOffset = [0, 0, 0, 0];
      if (t >= nextLegTap && legTapStart < 0) {
        legTapStart = t;
        legTapIndex = rng.int(0, M.legStep ? 3 : 1);
        nextLegTap = t + rng.float(M.legTap[0], M.legTap[1]);
      }
      if (legTapStart >= 0) {
        const k = (t - legTapStart) / 0.9;
        if (k >= 1) legTapStart = -1;
        else legOffset[legTapIndex] += Math.abs(Math.sin(k * Math.PI * 3)) * 0.09 * (legTapIndex % 2 ? -1 : 1);
      }
      // 제자리 스텝 — 네 발이 대각선으로 번갈아 (네발)
      if (t >= nextLegStep && legStepStart < 0) {
        legStepStart = t;
        nextLegStep = t + rng.float(M.legStep[0], M.legStep[1]);
      }
      if (legStepStart >= 0) {
        const k = (t - legStepStart) / 2.4;
        if (k >= 1) legStepStart = -1;
        else {
          const env = Math.sin(Math.min(1, k) * Math.PI);
          const ph = k * Math.PI * 2 * 3;
          legOffset[0] += Math.sin(ph) * 0.07 * env;
          legOffset[3] += Math.sin(ph) * 0.07 * env;
          legOffset[1] += Math.sin(ph + Math.PI) * 0.07 * env;
          legOffset[2] += Math.sin(ph + Math.PI) * 0.07 * env;
        }
      }
      // 폴짝 준비·착지 때 다리 접힘 (스쿼시와 함께)
      if (squashY < 0) { legOffset[0] += squashY * 1.5; legOffset[1] -= squashY * 1.5; }
      // 다리 관절 지터 — 아주 미세하게. 바닥에 붙은 발이 떠 보이면 안 된다.
      for (let i = 0; i < 4; i += 1) legOffset[i] += Math.sin(t * 6.1 + i * 1.9) * 0.006;

      // 꼬리 — 상시 스위시(고양이) + 간헐 플릭
      let tailAngle = tailSwish
        ? Math.sin((t / tailSwish.period) * Math.PI * 2 + tailSwish.phase) * tailSwish.amp
        : 0;
      if (t >= nextFlick && flickStart < 0) {
        flickStart = t;
        nextFlick = t + rng.float(M.tailFlick[0], M.tailFlick[1]);
      }
      if (flickStart >= 0) {
        const k = (t - flickStart) / 0.5;
        if (k >= 1) flickStart = -1;
        else tailAngle += Math.sin(k * Math.PI * 3) * 0.35 * (1 - k);
      }

      // 젤리 워블 — 덩어리가 출렁인다 (도깨비)
      let jellyX = 0;
      let jellyY = 0;
      if (jelly) {
        const w = Math.sin(t * jelly.freq * Math.PI * 2 + jelly.phase);
        jellyX = w * jelly.amp;
        jellyY = -w * jelly.amp * 0.9;
      }

      if (t >= nextMood && moodUntil < 0) {
        moodUntil = t + rng.float(1.5, 4);
        nextMood = t + rng.float(6, 16);
      }
      if (moodUntil >= 0 && t >= moodUntil) moodUntil = -1;

      if (t >= nextMouth && mouthUntil < 0) {
        mouthUntil = t + rng.float(0.8, 2.2);
        nextMouth = t + rng.float(4, 12);
      }
      if (mouthUntil >= 0 && t >= mouthUntil) mouthUntil = -1;

      let regen = false;
      if (t >= regenAt) {
        regen = true;
        regenAt = t + rng.float(6, 14);
      }

      let emote = null;
      if (t >= nextEmote && emoteStart < 0) {
        emoteStart = t;
        emoteKind = rng.pick(M.emotes);
        nextEmote = t + rng.float(14, 40);
      }
      if (emoteStart >= 0) {
        const k = (t - emoteStart) / 2.2;
        if (k >= 1) emoteStart = -1;
        else emote = { kind: emoteKind, k };
      }

      const breathe = Math.sin((t / breathePeriod) * Math.PI * 2 + breathePhase);

      return {
        breathe, lid, gaze, aperture, regen, emote,
        browAlt: moodUntil >= 0, mouthAlt: mouthUntil >= 0,
        sway, rock, headAngle: headAngle + rollAngle, headBob,
        hopY, squashX, squashY, stretchX, shiverX,
        jellyX, jellyY, faceYaw,
        armAlt: armUntil >= 0, happy, winkSide, tailAngle,
        armOffset, legOffset, armPose
      };
    }
  };
}
