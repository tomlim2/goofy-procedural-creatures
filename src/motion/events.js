// 간헐 이벤트 — 예약된 시각에 시작해 짧게 진행하고 끝나는 것. 다음 예약을 rng로 잡는다.
//   깜빡임 · 시선 다트 · 놀람 · 끄덕 · 킁킁 딥 · 폴짝 · 기지개 · 부르르
//   팔 들기 · 손 흔들기 · 발 까딱 · 제자리 스텝 · 꼬리 플릭 · 이모트 · 재생성
// 문서: guidelines/motion/motion.md
//
// 형태: { next: 다음 시작 시각, start: 진행 중이면 시작 시각(아니면 -1) }
// 진행 곡선은 k = (t - start) / duration. k>=1이면 끝.

import { BLINK_TIME } from "./table.js";

const schedule = (rng, range) => (range ? rng.float(range[0], range[1]) : Infinity);

// ── init (rng 소비) ──
export function initBlink(rng) { return { next: rng.float(0, 4), start: -1, happy: false }; }
export function initGlance(rng) { return { next: rng.float(0, 3), gaze: [0, 0], gazeTarget: [0, 0], faceYaw: 0 }; }
export function initSurprise(rng, M) { return { next: schedule(rng, M.surprise), start: -1 }; }
export function initRegen(rng) { return { at: rng.float(6, 14) }; }
export function initEmote(rng) { return { next: rng.float(5, 30), start: -1, kind: "heart" }; }
export function initDip(rng, M) { return { next: schedule(rng, M.dip), start: -1 }; }
export function initNod(rng) { return { next: rng.float(9, 24), start: -1 }; }
export function initHop(rng, M) { return { next: schedule(rng, M.hop), start: -1 }; }
export function initStretch(rng, M) { return { next: schedule(rng, M.stretch), start: -1 }; }
export function initShiver(rng, M) { return { next: schedule(rng, M.shiver), start: -1 }; }
export function initArmLift(rng, M) { return { next: schedule(rng, M.armLift), until: -1, side: 0 }; }
export function initArmWave(rng, M) { return { next: schedule(rng, M.armWave), start: -1, side: 0 }; }
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
      lid = Math.sin(Math.min(1, k) * Math.PI);
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
    else return 1 + 0.65 * Math.pow(Math.sin(Math.PI * k), 0.6);
  }
  return 1;
}
export function stepNod(e, t, rng) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(9, 24); }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.7;
    if (k >= 1) e.start = -1;
    else return -Math.abs(Math.sin(k * Math.PI * 2)) * 0.014;
  }
  return 0;
}
export function stepDip(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.dip[0], M.dip[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 1.2;
    if (k >= 1) e.start = -1;
    else return -Math.sin(Math.min(1, k) * Math.PI) * 0.035;
  }
  return 0;
}
export function stepHop(e, t, rng, M) {
  let hopY = 0, squashX = 0, squashY = 0;
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.hop[0], M.hop[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.55;
    if (k >= 1) e.start = -1;
    else if (k < 0.2) { squashY = -0.07 * Math.sin((k / 0.2) * Math.PI); squashX = -squashY * 0.8; }
    else if (k < 0.8) { const j = (k - 0.2) / 0.6; hopY = Math.sin(j * Math.PI) * 0.05; squashY = 0.05 * Math.sin(j * Math.PI); squashX = -squashY * 0.7; }
    else { squashY = -0.05 * Math.sin(((k - 0.8) / 0.2) * Math.PI); squashX = -squashY * 0.8; }
  }
  return { hopY, squashX, squashY };
}
export function stepStretch(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.stretch[0], M.stretch[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 1.6;
    if (k >= 1) e.start = -1;
    else return Math.sin(Math.min(1, k) * Math.PI) * 0.06;
  }
  return 0;
}
export function stepShiver(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.shiver[0], M.shiver[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.35;
    if (k >= 1) e.start = -1;
    else return Math.sin(k * Math.PI * 9) * 0.008 * (1 - k);
  }
  return 0;
}
export function stepArmLift(e, t, rng, M) {
  if (t >= e.next && e.until < 0) {
    e.side = rng.chance(0.5) ? -1 : 1;
    e.until = t + rng.float(1.2, 3);
    e.next = t + rng.float(M.armLift[0], M.armLift[1]);
  }
  if (e.until >= 0 && t >= e.until) { e.until = -1; e.side = 0; }
  return e.side;
}
export function stepArmWave(e, t, rng, M) {
  let k = -1;
  if (t >= e.next && e.start < 0) {
    e.start = t;
    e.side = rng.chance(0.5) ? -1 : 1;
    e.next = t + rng.float(M.armWave[0], M.armWave[1]);
  }
  if (e.start >= 0) {
    k = (t - e.start) / 1.6;
    if (k >= 1) { e.start = -1; k = -1; }
  }
  return { k, side: e.side };
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
    else legOffset[e.index] += Math.abs(Math.sin(k * Math.PI * 3)) * 0.09 * (e.index % 2 ? -1 : 1);
  }
}
export function stepLegStep(e, t, rng, M, legOffset) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.legStep[0], M.legStep[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 2.4;
    if (k >= 1) e.start = -1;
    else {
      const env = Math.sin(Math.min(1, k) * Math.PI);
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
    else return Math.sin(k * Math.PI * 3) * 0.35 * (1 - k);
  }
  return 0;
}
export function stepRegen(r, t, rng) {
  if (t >= r.at) { r.at = t + rng.float(6, 14); return true; }
  return false;
}
export function stepEmote(e, t, rng, M) {
  if (t >= e.next && e.start < 0) {
    e.start = t;
    e.kind = rng.pick(M.emotes);
    e.next = t + rng.float(14, 40);
  }
  if (e.start >= 0) {
    const k = (t - e.start) / 2.2;
    if (k >= 1) e.start = -1;
    else return { kind: e.kind, k };
  }
  return null;
}
