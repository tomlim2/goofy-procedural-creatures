// 유지 상태 — 들어가면 몇 초 머물다 돌아오는 것. 진행 곡선이 없고 on/off다.
//   ^^ 행복 눈 · 윙크 · 눈썹 상태 · 입 상태 · 갸웃(목표각 유지) · 행위 층(팔·몸·네발) · 둘러보기(얼굴 돌림 유지) · 기본 상태(idle/sleep/walk)
// 문서: guidelines/motion/catalog.md
//
// 형태: { next: 다음 진입 시각, until: 유지 종료 시각(아니면 -1) }

import { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS } from "./actions.js";
import { ramp } from "./ease.js";

const schedule = (rng, range) => (range ? rng.float(range[0], range[1]) : Infinity);

// (반감김 유지는 없앴다 — 눈은 뜨거나 감거나 둘 중 하나. init만 남겨 rng 순서를 유지한다)
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
// 화남 — 사나운 눈·이 드러낸 입(·눈썹 있으면 화난 눈썹), 고양이는 꼬리 털이 곤두선다. 표의 angry [간격] · angryHold [유지] (3초 이상)
export function initAngry(rng, M) { return { next: schedule(rng, M.angry), start: -1, until: -1 }; }

// ^^ 유지 — 눈을 다 감고 happy
export function stepHappy(s, t, rng, M) {
  if (t >= s.next && s.until < 0) { s.until = t + rng.float(3, 6); s.next = t + rng.float(M.happyHold[0], M.happyHold[1]); }   // ^^ 유지는 3초 이상
  if (s.until >= 0) {
    if (t >= s.until) s.until = -1;
    else return true;
  }
  return false;
}
// 화남 0~1 — 표정은 사람 눈이 깜짝 놀랄 때의 법칙대로 0.1초에 확 오르고 유지 뒤 0.1초에 풀린다 (양끝 속도 0). rng는 시작할 때만
export function stepAngry(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    s.start = t;
    s.until = t + rng.float(M.angryHold[0], M.angryHold[1]);
    s.next = t + rng.float(M.angry[0], M.angry[1]);
  }
  if (s.until >= 0) {
    if (t >= s.until + 0.1) { s.until = -1; return 0; }
    return ramp(Math.min(1, (t - s.start) / 0.1)) * (t < s.until ? 1 : 1 - ramp((t - s.until) / 0.1));
  }
  return 0;
}
export function stepWink(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    s.side = rng.chance(0.5) ? -1 : 1;
    s.until = t + rng.float(3, 5);   // 윙크는 3초 이상 — 잠깐 하다 마는 표정은 없다
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
// ── 행위 층 예약 (팔·몸·네발 공통) ──
// idle에서 행위로 넘어갔다가 hold가 끝나면 idle로. 층마다 예약이 따로 돌아 서로 겹친다(점프하며 인사).
// rng 순서: weighted(행위) → [chance(좌우)] → [float(hold)] → float(gap). 층 옵션이 이 순서를 바꾸지 않는다.
//   pool  [행위, 가중치] (table.js). 없으면 예약만 흘린다
//   gap   다음 시작까지 [min, max]. defaultGap은 표에 없을 때
//   defs  행위 표 (actions.js). side: 활동 쪽을 뽑나. hold(def, rng): 유지 시간
function stepActionLayer(s, t, rng, pool, gap, defaultGap, defs, { side = false, hold }) {
  if (t >= s.next && s.until < 0) {
    if (pool.length) {
      s.action = rng.weighted(pool);
      s.side = side ? (rng.chance(0.5) ? -1 : 1) : 0;
      s.start = t;
      s.until = t + hold(defs[s.action], rng);
    }
    s.next = t + rng.float(gap ? gap[0] : defaultGap[0], gap ? gap[1] : defaultGap[1]);
  }
  if (s.until >= 0 && t >= s.until) { s.until = -1; s.action = null; s.start = -1; }
  return s.action ? { action: s.action, side: s.side, start: s.start, until: s.until } : null;
}
const holdFromDef = (def, rng) => rng.float(def.hold[0], def.hold[1]);

// 팔 행위 (두발). 형태(arms 슬롯)와 무관. 한 팔 행위(인사·경례…)는 활동 팔의 좌우를 뽑는다.
// 돌려주는 것: { action, side, start, until } 또는 null(idle).
export function stepArmAction(s, t, rng, M) {
  return stepActionLayer(s, t, rng, M.armActions || [], M.armActionGap, [12, 36], ACTIONS, { side: true, hold: holdFromDef });
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
// 몸 행위 — idle하다가 가끔 온몸으로(제자리 점프). 유지는 점프 수 × 한 번 길이(rng 없음). table.js bodyActions.
// 돌려주는 것: { action, start, until } 또는 null.
export function initBodyAction(rng, M) { return { action: null, side: 0, start: -1, next: schedule(rng, M.bodyActions ? M.bodyActionGap : null), until: -1 }; }
export function stepBodyAction(s, t, rng, M) {
  return stepActionLayer(s, t, rng, M.bodyActions || [], M.bodyActionGap, [10, 25], BODY_ACTIONS, { hold: (def) => def.hops * def.dur });
}
// 네발 행위 — 뒷발 긁기·꼬리 흔들기. 어느 다리인지는 쌍 안에서 뽑는다(index 0~3, 꼬리면 -1). table.js quadActions.
// 돌려주는 것: { action, index, start, until } 또는 null(idle).
export function initQuadAction(rng, M) { return { action: null, side: 0, start: -1, next: schedule(rng, M.quadActions ? [6, 18] : null), until: -1 }; }
export function stepQuadAction(s, t, rng, M) {
  const r = stepActionLayer(s, t, rng, M.quadActions || [], M.quadActionGap, [10, 30], QUAD_ACTIONS, { side: true, hold: holdFromDef });
  if (!r) return null;
  const def = QUAD_ACTIONS[r.action];
  const pick = r.side < 0 ? 0 : 1;
  return { action: r.action, index: def.leg === "front" ? pick : def.leg === "hind" ? 2 + pick : -1, start: r.start, until: r.until };
}
// 기본 상태(mode) — 개체가 지금 어떤 상태로 있나: idle(서 있음) · sleep(엎드려 잠). 앞으로 walk·run이 여기 붙는다.
// 행위 층(팔·몸·네발)은 이 위에 겹치고, sleep 중엔 행위·둘러보기·놀람이 쉰다. table.js modes/modeHold.
// 상태를 하나만 가진 종족은 rng를 안 쓴다 (사람·도깨비 시드 보존).
export function initMode(rng, M) {
  const pool = M.modes || [["idle", 1]];
  if (pool.length < 2) return { mode: pool[0][0], next: Infinity };
  const mode = rng.weighted(pool);
  return { mode, next: rng.float(M.modeHold[mode][0], M.modeHold[mode][1]) };
}
// 전환은 idle을 거친다 — idle에서는 다른 상태 중 하나(가중치)로, 다른 상태에서는 idle로. 잠에서 바로 걷기로 넘어가지 않는다
export function stepMode(s, t, rng, M) {
  if (t >= s.next) {
    const pool = s.mode === "idle" ? (M.modes || []).filter(([m]) => m !== "idle") : [["idle", 1]];
    s.mode = pool.length ? rng.weighted(pool) : "idle";
    s.next = t + rng.float(M.modeHold[s.mode][0], M.modeHold[s.mode][1]);
  }
  return s.mode;
}
export function stepMood(m, t, rng) {
  if (t >= m.nextMood && m.moodUntil < 0) { m.moodUntil = t + rng.float(1.5, 4); m.nextMood = t + rng.float(6, 16); }
  if (m.moodUntil >= 0 && t >= m.moodUntil) m.moodUntil = -1;
  if (t >= m.nextMouth && m.mouthUntil < 0) { m.mouthUntil = t + rng.float(0.8, 2.2); m.nextMouth = t + rng.float(4, 12); }
  if (m.mouthUntil >= 0 && t >= m.mouthUntil) m.mouthUntil = -1;
  return { browAlt: m.moodUntil >= 0, mouthAlt: m.mouthUntil >= 0 };
}
