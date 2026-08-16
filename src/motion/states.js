// 유지 상태 — 들어가면 몇 초 머물다 돌아오는 것. 진행 곡선이 없고 on/off다.
//   반감김 · ^^ 행복 눈 · 윙크 · 눈썹 상태 · 입 상태 · 갸웃(목표각 유지) · 팔 행위 · 둘러보기(얼굴 돌림 유지)
// 문서: guidelines/motion/catalog.md
//
// 형태: { next: 다음 진입 시각, until: 유지 종료 시각(아니면 -1) }

import { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS } from "./actions.js";

const schedule = (rng, range) => (range ? rng.float(range[0], range[1]) : Infinity);

export function initSquint(rng) { return { next: rng.float(6, 18), until: -1 }; }
export function initMood(rng) { return { nextMood: rng.float(3, 10), moodUntil: -1, nextMouth: rng.float(2, 8), mouthUntil: -1 }; }
export function initTilt(rng, M) { return { next: rng.float(M.tilt[0], M.tilt[1]), until: -1, target: 0, angle: 0 }; }
// 팔 행위. idle에서 이따금 행위(만세·인사·팔짱·뒷짐·허리손·턱에 손…)로 넘어갔다 돌아온다.
// 행위 종류와 가중치는 table.js의 armActions, 행위의 내용은 actions.js.
export function initArmAction(rng) { return { action: null, side: 1, start: -1, next: rng.float(8, 24), until: -1 }; }
export function initWink(rng, M) { return { next: schedule(rng, M.wink), until: -1, side: 0 }; }
// 둘러보기 — 한 방향(좌·우·위·아래·대각)으로 얼굴을 돌리고 몇 초 머문다. 시선도 그쪽으로 간다.
export function initLook(rng, M) { return { next: schedule(rng, M.look), until: -1, dir: [0, 0] }; }
export function initHappy(rng, M) { return { next: schedule(rng, M.happyHold), until: -1 }; }

// 반감김 — lid를 최소 0.5로 올린다
export function stepSquint(s, t, rng, lid) {
  if (t >= s.next && s.until < 0) { s.until = t + rng.float(1.2, 2.8); s.next = t + rng.float(8, 20); }
  if (s.until >= 0) {
    if (t >= s.until) s.until = -1;
    else return Math.max(lid, 0.5);
  }
  return lid;
}
// ^^ 유지 — 눈을 다 감고 happy
export function stepHappy(s, t, rng, M) {
  if (t >= s.next && s.until < 0) { s.until = t + rng.float(2, 5); s.next = t + rng.float(M.happyHold[0], M.happyHold[1]); }
  if (s.until >= 0) {
    if (t >= s.until) s.until = -1;
    else return true;
  }
  return false;
}
export function stepWink(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    s.side = rng.chance(0.5) ? -1 : 1;
    s.until = t + rng.float(0.5, 1.3);
    s.next = t + rng.float(M.wink[0], M.wink[1]);
  }
  if (s.until >= 0 && t >= s.until) { s.until = -1; s.side = 0; }
  return s.side;
}
// 갸웃 — 목표각을 몇 초 유지, 각도는 이징
export function stepTilt(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    s.target = rng.around(0, M.tiltAmp);
    s.until = t + rng.float(1.2, 3.2);
    s.next = t + rng.float(M.tilt[0], M.tilt[1]);
  }
  if (s.until >= 0 && t >= s.until) s.until = -1;
  s.angle += ((s.until >= 0 ? s.target : 0) - s.angle) * 0.07;
  return s.angle;
}
// 팔 행위 — idle에서 행위로, 행위가 끝나면 idle로. 형태(arms 슬롯)와 무관.
// 행위마다 유지 시간(hold)이 다르고, 한 팔 행위(인사·경례…)는 활동 팔의 좌우를 뽑는다.
// 돌려주는 것: { action, side, start, until } 또는 null(idle).
export function stepArmAction(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    const pool = M.armActions || [];
    if (pool.length) {
      s.action = rng.weighted(pool);
      s.side = rng.chance(0.5) ? -1 : 1;
      const hold = ACTIONS[s.action].hold;
      s.start = t;
      s.until = t + rng.float(hold[0], hold[1]);
    }
    s.next = t + rng.float(M.armActionGap ? M.armActionGap[0] : 12, M.armActionGap ? M.armActionGap[1] : 36);
  }
  if (s.until >= 0 && t >= s.until) { s.until = -1; s.action = null; s.start = -1; }
  return s.action ? { action: s.action, side: s.side, start: s.start, until: s.until } : null;
}
// 둘러보기 — 유지 중이면 방향 [x, y] (−1~1), 아니면 null. 방향은 8방 중 하나 × 종족 진폭.
const LOOK_DIRS = [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, 0.6], [1, 0.6], [-1, -0.5], [1, -0.5]];
export function stepLook(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    const d = rng.pick(LOOK_DIRS);
    s.dir = [d[0] * M.lookAmp[0], d[1] * M.lookAmp[1]];
    s.until = t + rng.float(M.lookHold[0], M.lookHold[1]);
    s.next = t + rng.float(M.look[0], M.look[1]);
  }
  if (s.until >= 0 && t >= s.until) s.until = -1;
  return s.until >= 0 ? s.dir : null;
}
// 몸 행위 — idle하다가 가끔 온몸으로(제자리 점프). 팔·네발 행위와 다른 층이라 같이 일어난다. table.js bodyActions.
// 돌려주는 것: { action, start, until } 또는 null.
export function initBodyAction(rng, M) { return { action: null, start: -1, next: schedule(rng, M.bodyActions ? M.bodyActionGap : null), until: -1 }; }
export function stepBodyAction(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    const pool = M.bodyActions || [];
    if (pool.length) {
      s.action = rng.weighted(pool);
      const def = BODY_ACTIONS[s.action];
      s.start = t;
      s.until = t + def.hops * def.dur;
    }
    s.next = t + rng.float(M.bodyActionGap[0], M.bodyActionGap[1]);
  }
  if (s.until >= 0 && t >= s.until) { s.until = -1; s.action = null; s.start = -1; }
  return s.action ? { action: s.action, start: s.start, until: s.until } : null;
}
// 네발 행위 — idle에서 행위(앞발 들기·뒷발 긁기·꼬리 흔들기)로 넘어갔다 돌아온다. table.js quadActions.
// 돌려주는 것: { action, index(다리 0~3, 꼬리면 -1), start, until } 또는 null(idle).
export function initQuadAction(rng, M) { return { action: null, index: -1, start: -1, next: schedule(rng, M.quadActions ? [6, 18] : null), until: -1 }; }
export function stepQuadAction(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    const pool = M.quadActions || [];
    if (pool.length) {
      s.action = rng.weighted(pool);
      const def = QUAD_ACTIONS[s.action];
      const pick = rng.chance(0.5) ? 0 : 1;
      s.index = def.leg === "front" ? pick : def.leg === "hind" ? 2 + pick : -1;
      s.start = t;
      s.until = t + rng.float(def.hold[0], def.hold[1]);
    }
    s.next = t + rng.float(M.quadActionGap ? M.quadActionGap[0] : 10, M.quadActionGap ? M.quadActionGap[1] : 30);
  }
  if (s.until >= 0 && t >= s.until) { s.until = -1; s.action = null; s.start = -1; }
  return s.action ? { action: s.action, index: s.index, start: s.start, until: s.until } : null;
}
export function stepMood(m, t, rng) {
  if (t >= m.nextMood && m.moodUntil < 0) { m.moodUntil = t + rng.float(1.5, 4); m.nextMood = t + rng.float(6, 16); }
  if (m.moodUntil >= 0 && t >= m.moodUntil) m.moodUntil = -1;
  if (t >= m.nextMouth && m.mouthUntil < 0) { m.mouthUntil = t + rng.float(0.8, 2.2); m.nextMouth = t + rng.float(4, 12); }
  if (m.mouthUntil >= 0 && t >= m.mouthUntil) m.mouthUntil = -1;
  return { browAlt: m.moodUntil >= 0, mouthAlt: m.mouthUntil >= 0 };
}
