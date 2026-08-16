// 얼굴 모션 — 깜빡임·시선·요·반감김·^^·윙크·놀람·눈썹·입.
// 문서: guidelines/motion.md § 얼굴
//
// 각 조각은 init(rng, M, opts)로 상태를 만들고 step(t, rng, ctx)로 부분 상태를 돌려준다.
// rng 호출 순서는 index.js가 정한다 — 여기서는 순서를 바꾸지 않는다.

import { BLINK_TIME } from "./table.js";

// 깜빡임 + 시선 + 얼굴 요 + 반감김. 초기화 순서: blink, glance, (surprise는 밖), squint
export function initBlinkGaze(rng) {
  return { nextBlink: rng.float(0, 4), blinkStart: -1, blinkHappy: false, nextGlance: rng.float(0, 3), gaze: [0, 0], gazeTarget: [0, 0], faceYaw: 0 };
}
export function initSurprise(rng, M) {
  return { next: rng.float(M.surprise[0], M.surprise[1]), start: -1 };
}
export function initSquint(rng) {
  return { next: rng.float(6, 18), until: -1 };
}
export function initMood(rng) {
  return { nextMood: rng.float(3, 10), moodUntil: -1, nextMouth: rng.float(2, 8), mouthUntil: -1 };
}
export function initWink(rng, M) {
  return { next: M.wink ? rng.float(M.wink[0], M.wink[1]) : Infinity, until: -1, side: 0 };
}
export function initHappy(rng, M) {
  return { next: M.happyHold ? rng.float(M.happyHold[0], M.happyHold[1]) : Infinity, until: -1 };
}

// step — index.js가 원본 순서로 부른다: blink → glance → yaw → lid → squint → happy → wink → surprise
export function stepEyes(s, t, rng, M) {
  const bg = s.blinkGaze;
  if (t >= bg.nextBlink) {
    bg.blinkStart = t;
    bg.blinkHappy = rng.chance(0.22);
    bg.nextBlink = t + rng.float(1.8, 6.5);
    if (rng.chance(0.22)) bg.nextBlink = t + BLINK_TIME * 2.4;
  }
  if (t >= bg.nextGlance) {
    bg.gazeTarget = [rng.around(0, 1), rng.around(0, 0.7)];
    bg.nextGlance = t + rng.float(1.4, 5.0);
  }
  bg.gaze = [bg.gaze[0] + (bg.gazeTarget[0] - bg.gaze[0]) * 0.12, bg.gaze[1] + (bg.gazeTarget[1] - bg.gaze[1]) * 0.12];
  bg.faceYaw += (bg.gaze[0] * M.yaw - bg.faceYaw) * 0.06;

  let lid = 0;
  let happy = false;
  if (bg.blinkStart >= 0) {
    const k = (t - bg.blinkStart) / BLINK_TIME;
    if (k >= 1) bg.blinkStart = -1;
    else {
      lid = Math.sin(Math.min(1, k) * Math.PI);
      if (bg.blinkHappy && lid > 0.7) happy = true;
    }
  }

  const sq = s.squint;
  if (t >= sq.next && sq.until < 0) {
    sq.until = t + rng.float(1.2, 2.8);
    sq.next = t + rng.float(8, 20);
  }
  if (sq.until >= 0) {
    if (t >= sq.until) sq.until = -1;
    else lid = Math.max(lid, 0.5);
  }

  const hp = s.happy;
  if (t >= hp.next && hp.until < 0) {
    hp.until = t + rng.float(2, 5);
    hp.next = t + rng.float(M.happyHold[0], M.happyHold[1]);
  }
  if (hp.until >= 0) {
    if (t >= hp.until) hp.until = -1;
    else { lid = 1; happy = true; }
  }

  const wk = s.wink;
  if (t >= wk.next && wk.until < 0) {
    wk.side = rng.chance(0.5) ? -1 : 1;
    wk.until = t + rng.float(0.5, 1.3);
    wk.next = t + rng.float(M.wink[0], M.wink[1]);
  }
  if (wk.until >= 0 && t >= wk.until) { wk.until = -1; wk.side = 0; }

  let aperture = 1;
  const sp = s.surprise;
  if (t >= sp.next && sp.start < 0) {
    sp.start = t;
    sp.next = t + rng.float(M.surprise[0], M.surprise[1]);
  }
  if (sp.start >= 0) {
    const k = (t - sp.start) / 1.1;
    if (k >= 1) sp.start = -1;
    else aperture = 1 + 0.65 * Math.pow(Math.sin(Math.PI * k), 0.6);
  }

  return { lid, happy, gaze: bg.gaze, faceYaw: bg.faceYaw, winkSide: wk.side, aperture };
}

// 눈썹·입 상태 전환. 원본에서는 update 끝쪽(꼬리·젤리 뒤)에 있었다.
export function stepMood(m, t, rng) {
  if (t >= m.nextMood && m.moodUntil < 0) {
    m.moodUntil = t + rng.float(1.5, 4);
    m.nextMood = t + rng.float(6, 16);
  }
  if (m.moodUntil >= 0 && t >= m.moodUntil) m.moodUntil = -1;

  if (t >= m.nextMouth && m.mouthUntil < 0) {
    m.mouthUntil = t + rng.float(0.8, 2.2);
    m.nextMouth = t + rng.float(4, 12);
  }
  if (m.mouthUntil >= 0 && t >= m.mouthUntil) m.mouthUntil = -1;

  return { browAlt: m.moodUntil >= 0, mouthAlt: m.mouthUntil >= 0 };
}
