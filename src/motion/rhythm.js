// 상시 리듬 — 멈추지 않고 계속 도는 진동. 사인파와 이징뿐, 이벤트 예약이 없다.
//   호흡 · 스웨이(좌우) · 락킹(앞뒤) · 머리 롤(개) · 젤리 워블(도깨비) · 꼬리 스위시(고양이)
//   시선 이징 · 얼굴 요 · 팔 진자 · 관절 지터
// 문서: guidelines/motion/catalog.md
//
// init은 rng를 소비한다(위상·주기). step은 rng를 안 쓴다 — 리듬은 결정적이다.

export function initBreathe(rng) {
  return { period: rng.float(2.6, 5.4), phase: rng.float(0, Math.PI * 2) };
}
export function initSway(rng, M) {
  return {
    swayAmp: rng.float(M.sway[0], M.sway[1]),
    swayPeriod: rng.float(M.swayPeriod[0], M.swayPeriod[1]),
    swayPhase: rng.float(0, Math.PI * 2),
    rockPeriod: rng.float(2.1, 3.9),
    rockPhase: rng.float(0, Math.PI * 2)
  };
}
export function initRoll(rng, M) {
  return M.roll
    ? { amp: rng.float(M.roll.amp[0], M.roll.amp[1]), period: rng.float(M.roll.period[0], M.roll.period[1]), phase: rng.float(0, Math.PI * 2) }
    : null;
}
export function initArmSwing(rng) {
  return { phase: rng.float(0, Math.PI * 2) };
}
export function initTailSwish(rng, M) {
  return M.tailSwish
    ? { amp: rng.float(M.tailSwish.amp[0], M.tailSwish.amp[1]), period: rng.float(M.tailSwish.period[0], M.tailSwish.period[1]), phase: rng.float(0, Math.PI * 2) }
    : null;
}
export function initJelly(rng, M) {
  return M.jelly
    ? { amp: rng.float(M.jelly.amp[0], M.jelly.amp[1]), freq: rng.float(M.jelly.freq[0], M.jelly.freq[1]), phase: rng.float(0, Math.PI * 2) }
    : null;
}

export function stepBreathe(br, t) {
  return Math.sin((t / br.period) * Math.PI * 2 + br.phase);
}
export function stepSway(s, t, M) {
  return {
    sway: Math.sin((t / s.swayPeriod) * Math.PI * 2 + s.swayPhase) * s.swayAmp,
    rock: Math.sin((t / s.rockPeriod) * Math.PI * 2 + s.rockPhase) * (M.rock || 0)
  };
}
export function stepRoll(roll, t) {
  return roll ? Math.sin((t / roll.period) * Math.PI * 2 + roll.phase) * roll.amp : 0;
}
// 시선은 목표를 향해 이징. 목표 갱신(rng)은 events가 한다.
export function stepGaze(g) {
  g.gaze = [g.gaze[0] + (g.gazeTarget[0] - g.gaze[0]) * 0.12, g.gaze[1] + (g.gazeTarget[1] - g.gaze[1]) * 0.12];
  return g.gaze;
}
export function stepYaw(g, M) {
  g.faceYaw += (g.gaze[0] * M.yaw - g.faceYaw) * 0.06;
  return g.faceYaw;
}
// 팔 진자 — 스웨이 반대 위상
export function stepArmSwing(a, sway, t, M) {
  return Math.sin((t / sway.swayPeriod) * Math.PI * 2 + sway.swayPhase + Math.PI + a.phase * 0.3) * (M.armSwing || 0);
}
// 관절 지터 — 팔도 선처럼 미세하게 끓는다. 레퍼런스 팔의 실체.
export function armJitter(a, t, side) {
  return Math.sin(t * 7.3 + side * 2.1 + a.phase) * 0.012 + Math.sin(t * 11.7 + side * 0.7) * 0.008;
}
export function legJitter(t, i) {
  return Math.sin(t * 6.1 + i * 1.9) * 0.006;
}
export function stepTailSwish(sw, t) {
  return sw ? Math.sin((t / sw.period) * Math.PI * 2 + sw.phase) * sw.amp : 0;
}
export function stepJelly(jelly, t) {
  if (!jelly) return { jellyX: 0, jellyY: 0 };
  const w = Math.sin(t * jelly.freq * Math.PI * 2 + jelly.phase);
  return { jellyX: w * jelly.amp, jellyY: -w * jelly.amp * 0.9 };
}
