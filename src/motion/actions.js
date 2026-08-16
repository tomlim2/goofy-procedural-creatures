// 행위 카탈로그 — 캐릭터가 하는 "짓". 만세, 팔짱, 손 흔들어 인사, 턱 괴기, 경례…
// 문서: guidelines/motion/catalog.md § 팔 행위
//
// 행위는 **항상 두 팔을 다 정한다.** "팔을 흔든다"가 아니라 "팔을 흔들어 인사한다"다 —
// 한 팔은 들어 흔들고 다른 팔은 내린다. 한 팔만 정하고 나머지를 바인드(T)에 남기면
// 마네킹이 한 팔만 까딱이는 그림이 된다.
//
// 팔 자세는 관절각이 아니라 **손 목표**로 적는다. 리그(어깨 위치·위팔·아래팔 길이·몸 앵커,
// character/draw/limbs.js armRig)를 받아 두 마디 IK로 각도를 푼다. 그래서 팔 길이가 달라도
// "허리에 손"은 허리에, "턱에 손"은 턱에 간다. 손이 닿지 않으면 그쪽으로 곧게 뻗는다.

import { BIND_ARM } from "../character/index.js";

// 팔 자세 하나 = 한 팔이 취하는 것.
//   hand    손 목표. [x, y]는 reach(위팔+아래팔) 배수 — 어깨 원점, x 바깥 양수, y 위 양수.
//           문자열은 리그 앵커 이름(몸 좌표, 오른팔 기준. 왼팔은 x 반전).
//   bend    팔꿈치가 튀어나오는 쪽. "out" 바깥 / "down" 아래
//   floor   손이 바닥 아래로 못 간다 (긴 팔이 늘어뜨릴 때)
//   osc     자세 위에 얹는 진동 { shoulder, elbow: 진폭 rad, hz }. 이징을 안 거친다
//   behind  뒷짐 — 팔이 몸 뒤로 사라지고 back 스케치만 보인다. IK 없음
export const ARM_POSES = {
  hang:   { hand: [0.12, -0.99], bend: "out", floor: true },
  raise:  { hand: [0.45, 0.88], bend: "out" },
  hi:     { hand: [0.3, 0.95], bend: "out" },
  wave:   { hand: [0.5, 0.7], bend: "out", osc: { shoulder: 0, elbow: 0.5, hz: 3 } },
  flap:   { hand: [0.75, 0.5], bend: "out", osc: { shoulder: 0.28, elbow: 0.12, hz: 5 } },
  point:  { hand: [0.95, 0.3], bend: "down" },
  hips:   { hand: "hip", bend: "out" },
  cross:  { hand: "chestFar", bend: "down" },
  think:  { hand: "chin", bend: "down" },
  salute: { hand: "brow", bend: "out" },
  behind: { behind: true, shoulder: -0.2 }
};

// 행위 = [활동 팔 자세, 나머지 팔 자세] + 유지 시간. 두 자세가 같으면 대칭 행위.
// 비대칭 행위는 시작할 때 활동 팔의 좌우를 뽑는다. emote는 행위 중 머리 위 글리프.
export const ACTIONS = {
  raise:  { arms: ["raise", "raise"],   hold: [2, 4],   label: "만세" },
  cross:  { arms: ["cross", "cross"],   hold: [3, 7],   label: "팔짱" },
  hips:   { arms: ["hips", "hips"],     hold: [3, 7],   label: "허리에 손" },
  hang:   { arms: ["hang", "hang"],     hold: [3, 7],   label: "쉬어 (늘어뜨림)" },
  behind: { arms: ["behind", "behind"], hold: [3, 7],   label: "뒷짐" },
  flap:   { arms: ["flap", "flap"],     hold: [1.5, 3], label: "파닥임 (좋아함)", emote: "heart" },
  wave:   { arms: ["wave", "hang"],     hold: [1.5, 3], label: "손 흔들어 인사" },
  hi:     { arms: ["hi", "hang"],       hold: [2, 4],   label: "한 손 들기 (저요)" },
  point:  { arms: ["point", "hang"],    hold: [2, 4],   label: "가리키기" },
  think:  { arms: ["think", "hang"],    hold: [3, 6],   label: "턱에 손 (생각)" },
  salute: { arms: ["salute", "hang"],   hold: [2, 4],   label: "경례" }
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const FLOOR_MARGIN = 0.035;   // 손 점 반지름(0.022)보다 조금 크게

// 어깨각을 (−135°, 225°]로 감는다 — 바인드(90°)를 가운데 두고. 각이 −180°/180° 경계를
// 넘나들면 리그의 이징이 먼 길로 돌아 팔이 한 바퀴 휘돈다 (경례가 −226°로 나온 적 있다).
const wrapShoulder = (angle) => {
  const lo = -Math.PI * 0.75;
  let a = angle;
  while (a <= lo) a += Math.PI * 2;
  while (a > lo + Math.PI * 2) a -= Math.PI * 2;
  return a;
};

// 바인드(T포즈) 팔. side를 곱해 세계 rotation.z로.
export function bindArm(side) {
  return { shoulder: side * BIND_ARM[0], elbow: side * BIND_ARM[1], behind: false, oscShoulder: 0, oscElbow: 0 };
}

// 팔꿈치를 어느 쪽으로 꺾나. 어깨→손 선(L)에 대해 want 방향이 반시계쪽이면 +1, 시계쪽이면 −1.
// (어깨각 = 목표방향 + sign·α 로 두면 팔꿈치가 L의 반시계쪽에 놓인다.)
function bendSign(lx, ly, want) {
  const [wx, wy] = want === "down" ? [0, -1] : [1, 0];
  const cross = lx * wy - ly * wx;
  return cross >= 0 ? 1 : -1;
}

// 한 팔의 목표 관절각. 세계 rotation.z (아래로 늘어진 팔이 0, 반시계 양수). 왼팔은 side=−1.
// tau: 행위 시작 이후 경과 시간(진동 위상), env: 진동 봉투 0~1 (행위 들어가고 나갈 때 페이드).
export function solveArm(rig, side, poseName, tau = 0, env = 0) {
  const pose = ARM_POSES[poseName];
  if (!pose || !rig) return bindArm(side);
  if (pose.behind) return { shoulder: side * pose.shoulder, elbow: 0, behind: true, oscShoulder: 0, oscElbow: 0 };

  const a = rig.upper;
  const b = rig.lower;
  const reach = a + b;

  // 손 목표 — 어깨 원점, outward 좌표 (오른팔 기준. 앵커도 오른팔 기준이라 side와 무관)
  let tx;
  let ty;
  if (typeof pose.hand === "string") {
    const anchor = rig.anchors[pose.hand];
    tx = anchor[0] - rig.x;
    ty = anchor[1] - rig.y;
  } else {
    tx = pose.hand[0] * reach;
    ty = pose.hand[1] * reach;
  }
  if (pose.floor) ty = Math.max(ty, rig.anchors.ground - rig.y + FLOOR_MARGIN);

  // 두 마디 IK. d는 닿는 범위로 자른다 — 못 닿으면 곧게 뻗고, 너무 가까우면 최대로 접는다.
  const d = clamp(Math.hypot(tx, ty), Math.abs(a - b) + 1e-3, reach * 0.995);
  const dir = Math.atan2(tx, -ty);                                       // 아래(0,−1)에서 반시계로 잰 목표 방향
  const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));   // 위팔이 목표선에서 벌어지는 각
  const gamma = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));   // 팔꿈치 안쪽각
  const sign = bendSign(tx, ty, pose.bend);
  const shoulder = wrapShoulder(dir + sign * alpha);
  const elbow = -sign * (Math.PI - gamma);

  let oscShoulder = 0;
  let oscElbow = 0;
  if (pose.osc && env > 0) {
    const w = Math.sin(tau * Math.PI * 2 * pose.osc.hz) * env;
    oscShoulder = pose.osc.shoulder * w;
    oscElbow = pose.osc.elbow * w;
  }
  return {
    shoulder: side * shoulder,
    elbow: side * elbow,
    behind: false,
    oscShoulder: side * oscShoulder,
    oscElbow: side * oscElbow
  };
}

// 행위 하나를 두 팔에 푼다. act = { action, side(활동 팔), start, until } 또는 null(바인드).
export function solveArms(rig, act, t) {
  const arms = {};
  const def = act && ACTIONS[act.action];
  // 진동 봉투 — 들어가고 나갈 때 0.35초 페이드. 없으면 행위가 끝나는 순간 팔이 튄다
  const env = def ? clamp(Math.min((t - act.start) / 0.35, (act.until - t) / 0.35), 0, 1) : 0;
  for (const side of [-1, 1]) {
    if (!def || !rig) { arms[String(side)] = bindArm(side); continue; }
    const poseName = side === act.side ? def.arms[0] : def.arms[1];
    arms[String(side)] = solveArm(rig, side, poseName, t - act.start, env);
  }
  return arms;
}
