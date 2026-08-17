// 간헐 이벤트 — 예약된 시각에 시작해 짧게 진행하고 끝나는 것. 다음 예약을 rng로 잡는다.
//   깜빡임 · 시선 다트 · 놀람 · 끄덕 · 킁킁 딥 · 기지개 · 부르르 (제자리 점프는 이벤트가 아니라 몸 행위 — actions.js)
//   발 까딱 · 제자리 스텝 · 꼬리 플릭 · 이모지 예약 · 재생성
// (한 팔 들기·손 흔들기는 이벤트가 아니라 행위다 — actions.js hi·wave. 나머지 팔도 같이 정해진다)
// 문서: guidelines/motion/catalog.md
//
// 형태: { next: 다음 시작 시각, start: 진행 중이면 시작 시각(아니면 -1) }
// 진행 곡선은 k = (t - start) / duration. k>=1이면 끝.

import { BLINK_TIME } from "./table.js";
import { bump, bumps, envelope } from "./ease.js";

const schedule = (rng, range) => (range ? rng.float(range[0], range[1]) : Infinity);

// ── init (rng 소비) ──
export function initBlink(rng) { return { next: rng.float(0, 4), start: -1, happy: false }; }
// gaze·faceTurn은 임계감쇠 추종({x, v} 둘씩) — 시선이 먼저 가고 얼굴이 뒤따른다 (rhythm.stepGaze·stepFaceTurn)
export function initGlance(rng) {
  return { next: rng.float(0, 3), gaze: [{ x: 0, v: 0 }, { x: 0, v: 0 }], gazeTarget: [0, 0], faceTurn: [{ x: 0, v: 0 }, { x: 0, v: 0 }] };
}
export function initSurprise(rng, M) { return { next: schedule(rng, M.surprise), start: -1 }; }
export function initRegen(rng) { return { at: rng.float(6, 14) }; }
export function initEmojiSchedule(rng) { return { next: rng.float(5, 30) }; }
export function initDip(rng, M) { return { next: schedule(rng, M.dip), start: -1 }; }
export function initNod(rng) { return { next: rng.float(9, 24), start: -1 }; }
export function initStretch(rng, M) { return { next: schedule(rng, M.stretch), start: -1 }; }
export function initShiver(rng, M) { return { next: schedule(rng, M.shiver), start: -1 }; }
export function initLegTap(rng, M) { return { next: schedule(rng, M.legTap), start: -1, index: 0 }; }
export function initLegStep(rng, M) { return { next: schedule(rng, M.legStep), start: -1 }; }
export function initTailFlick(rng, M) { return { next: schedule(rng, M.tailFlick), start: -1 }; }

// ── step ──
export function stepBlink(e, t, rng) {
  if (t >= e.next) {
    e.start = t;
    e.happy = rng.chance(0.22);
    e.next = t + rng.float(1.8, 6.5);
    if (rng.chance(0.22)) e.next = t + BLINK_TIME * 2.4;
  }
  let lid = 0;
  let happy = false;
  if (e.start >= 0) {
    const k = (t - e.start) / BLINK_TIME;
    if (k >= 1) e.start = -1;
    else {
      lid = bump(k);
      if (e.happy && lid > 0.7) happy = true;
    }
  }
  return { lid, happy };
}
// 시선 목표 갱신만. 이징은 rhythm.stepGaze.
export function stepGlanceTarget(g, t, rng) {
  if (t >= g.next) {
    g.gazeTarget = [rng.around(0, 1), rng.around(0, 0.7)];
    g.next = t + rng.float(1.4, 5.0);
  }
}
export function stepSurprise(e, t, rng, M) {
  if (t >= e.next && e.start < 0) {
    e.start = t;
    e.next = t + rng.float(M.surprise[0], M.surprise[1]);
  }
  if (e.start >= 0) {
    const k = (t - e.start) / 1.1;
    if (k >= 1) e.start = -1;
    // 놀람 정도 0~1: 0.25(≈0.28초)에 걸쳐 오르고, 유지, 0.45(≈0.5초)에 걸쳐 풀림 — 양끝 속도 0.
    // scene은 이 값으로 **동공만** 줄인다(1 → 0.5배). 눈 자체는 안 커진다
    else return envelope(k, 0.25, 0.45);
  }
  return 0;
}
export function stepNod(e, t, rng) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(9, 24); }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.7;
    if (k >= 1) e.start = -1;
    else return -bumps(k, 2) * 0.014;
  }
  return 0;
}
export function stepDip(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.dip[0], M.dip[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 1.2;
    if (k >= 1) e.start = -1;
    else return -bump(k) * 0.035;
  }
  return 0;
}
export function stepStretch(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.stretch[0], M.stretch[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 1.6;
    if (k >= 1) e.start = -1;
    else return bump(k) * 0.06;
  }
  return 0;
}
export function stepShiver(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.shiver[0], M.shiver[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.35;
    if (k >= 1) e.start = -1;
    else return Math.sin(k * Math.PI * 9) * 0.008 * envelope(k, 0.15, 0.7);
  }
  return 0;
}
export function stepLegTap(e, t, rng, M, legOffset) {
  if (t >= e.next && e.start < 0) {
    e.start = t;
    e.index = rng.int(0, M.legStep ? 3 : 1);
    e.next = t + rng.float(M.legTap[0], M.legTap[1]);
  }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.9;
    if (k >= 1) e.start = -1;
    else legOffset[e.index] += bumps(k, 3) * 0.09 * (e.index % 2 ? -1 : 1);
  }
}
export function stepLegStep(e, t, rng, M, legOffset) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.legStep[0], M.legStep[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 2.4;
    if (k >= 1) e.start = -1;
    else {
      const env = bump(k);
      const ph = k * Math.PI * 2 * 3;
      legOffset[0] += Math.sin(ph) * 0.07 * env;
      legOffset[3] += Math.sin(ph) * 0.07 * env;
      legOffset[1] += Math.sin(ph + Math.PI) * 0.07 * env;
      legOffset[2] += Math.sin(ph + Math.PI) * 0.07 * env;
    }
  }
}
export function stepTailFlick(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.tailFlick[0], M.tailFlick[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.5;
    if (k >= 1) e.start = -1;
    else return Math.sin(k * Math.PI * 3) * 0.35 * envelope(k, 0.15, 0.6);
  }
  return 0;
}
export function stepRegen(r, t, rng) {
  if (t >= r.at) { r.at = t + rng.float(6, 14); return true; }
  return false;
}
// idle 중 이모지 — 종족별 목록에서 하나를 뽑아 트리거할 종류만 돌려준다 (애니메이션은 emoji.js 채널이 한다)
export function stepEmojiSchedule(e, t, rng, M) {
  if (t >= e.next) {
    e.next = t + rng.float(14, 40);
    return rng.pick(M.emojis);
  }
  return null;
}
