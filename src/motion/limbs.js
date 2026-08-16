// 팔다리·꼬리 모션 — 팔 자세·팔 지터·들기·손 흔들기·발 까딱·스텝·꼬리 스위시·플릭.
// 문서: guidelines/motion.md § 팔다리, § 꼬리
//
// 레퍼런스 실측: 팔다리는 관절 지터 + 몸 따라가기가 기본. 큰 이벤트는 드물고 작다.
// 자세(rest/out/behind/up)는 형태(arms 슬롯)와 분리된 동작이다.

// 원본 초기화 순서: arm(포즈 토글, 미사용) → armSwingPhase → poseChange → armLift → armWave
//                  → legTap → legStep → (wink, happy는 face) → tailSwish → flick
export function initArmToggle(rng, M) {
  return { next: M.arm ? rng.float(M.arm[0], M.arm[1]) : Infinity, until: -1 };
}
export function initArms(rng, M, restPose) {
  const a = {};
  a.swingPhase = rng.float(0, Math.PI * 2);
  a.restPose = restPose;
  a.pose = restPose;
  a.nextPoseChange = rng.float(8, 24);
  a.poseUntil = -1;
  a.nextLift = M.armLift ? rng.float(M.armLift[0], M.armLift[1]) : Infinity;
  a.liftUntil = -1;
  a.liftSide = 0;
  a.nextWave = M.armWave ? rng.float(M.armWave[0], M.armWave[1]) : Infinity;
  a.waveStart = -1;
  a.waveSide = 0;
  return a;
}
export function initLegs(rng, M) {
  const l = {};
  l.nextTap = M.legTap ? rng.float(M.legTap[0], M.legTap[1]) : Infinity;
  l.tapStart = -1;
  l.tapIndex = 0;
  l.nextStep = M.legStep ? rng.float(M.legStep[0], M.legStep[1]) : Infinity;
  l.stepStart = -1;
  return l;
}
export function initTail(rng, M) {
  const swish = M.tailSwish
    ? { amp: rng.float(M.tailSwish.amp[0], M.tailSwish.amp[1]), period: rng.float(M.tailSwish.period[0], M.tailSwish.period[1]), phase: rng.float(0, Math.PI * 2) }
    : null;
  return { swish, nextFlick: M.tailFlick ? rng.float(M.tailFlick[0], M.tailFlick[1]) : Infinity, flickStart: -1 };
}

// 팔 포즈 토글 (legacy armAlt — scene에서 더 이상 안 쓰지만 rng 순서 유지를 위해 남긴다)
export function stepArmToggle(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    s.until = t + rng.float(1, 3);
    s.next = t + rng.float(M.arm[0], M.arm[1]);
  }
  if (s.until >= 0 && t >= s.until) s.until = -1;
  return s.until >= 0;
}

// 팔 자세 + 팔 오프셋. body 결과(hopY, swayPeriod, swayPhase)를 받는다.
export function stepArms(a, t, rng, M, body, noRest) {
  if (t >= a.nextPoseChange && a.poseUntil < 0) {
    const others = ["rest", "out", "behind", "up"].filter((p) => p !== a.restPose && !(noRest && p === "rest"));
    a.pose = rng.weighted(others.map((p) => [p, p === "up" ? 0.5 : p === "behind" ? 1.5 : 2]));
    a.poseUntil = t + rng.float(2, 6);
    a.nextPoseChange = t + rng.float(12, 36);
  }
  if (a.poseUntil >= 0 && t >= a.poseUntil) { a.poseUntil = -1; a.pose = a.restPose; }

  const armSwing = Math.sin((t / body.swayPeriod) * Math.PI * 2 + body.swayPhase + Math.PI + a.swingPhase * 0.3) * (M.armSwing || 0);
  if (t >= a.nextLift && a.liftUntil < 0) {
    a.liftSide = rng.chance(0.5) ? -1 : 1;
    a.liftUntil = t + rng.float(1.2, 3);
    a.nextLift = t + rng.float(M.armLift[0], M.armLift[1]);
  }
  if (a.liftUntil >= 0 && t >= a.liftUntil) { a.liftUntil = -1; a.liftSide = 0; }
  let waveK = -1;
  if (t >= a.nextWave && a.waveStart < 0) {
    a.waveStart = t;
    a.waveSide = rng.chance(0.5) ? -1 : 1;
    a.nextWave = t + rng.float(M.armWave[0], M.armWave[1]);
  }
  if (a.waveStart >= 0) {
    waveK = (t - a.waveStart) / 1.6;
    if (waveK >= 1) { a.waveStart = -1; waveK = -1; }
  }
  const armOffset = { "-1": armSwing, "1": -armSwing };
  for (const side of [-1, 1]) {
    const key = String(side);
    const outward = -side;
    if (a.liftSide === side) armOffset[key] += outward * 0.55;
    if (waveK >= 0 && a.waveSide === side) {
      const env = Math.sin(Math.min(1, waveK) * Math.PI);
      armOffset[key] += outward * 0.7 * env + Math.sin(waveK * Math.PI * 6) * 0.18 * env;
    }
    if (body.hopY > 0) armOffset[key] += outward * body.hopY * 4;
    armOffset[key] += Math.sin(t * 7.3 + side * 2.1 + a.swingPhase) * 0.012
      + Math.sin(t * 11.7 + side * 0.7) * 0.008;
  }
  return { armPose: a.pose, armOffset };
}

export function stepLegs(l, t, rng, M, body) {
  const legOffset = [0, 0, 0, 0];
  if (t >= l.nextTap && l.tapStart < 0) {
    l.tapStart = t;
    l.tapIndex = rng.int(0, M.legStep ? 3 : 1);
    l.nextTap = t + rng.float(M.legTap[0], M.legTap[1]);
  }
  if (l.tapStart >= 0) {
    const k = (t - l.tapStart) / 0.9;
    if (k >= 1) l.tapStart = -1;
    else legOffset[l.tapIndex] += Math.abs(Math.sin(k * Math.PI * 3)) * 0.09 * (l.tapIndex % 2 ? -1 : 1);
  }
  if (t >= l.nextStep && l.stepStart < 0) {
    l.stepStart = t;
    l.nextStep = t + rng.float(M.legStep[0], M.legStep[1]);
  }
  if (l.stepStart >= 0) {
    const k = (t - l.stepStart) / 2.4;
    if (k >= 1) l.stepStart = -1;
    else {
      const env = Math.sin(Math.min(1, k) * Math.PI);
      const ph = k * Math.PI * 2 * 3;
      legOffset[0] += Math.sin(ph) * 0.07 * env;
      legOffset[3] += Math.sin(ph) * 0.07 * env;
      legOffset[1] += Math.sin(ph + Math.PI) * 0.07 * env;
      legOffset[2] += Math.sin(ph + Math.PI) * 0.07 * env;
    }
  }
  if (body.squashY < 0) { legOffset[0] += body.squashY * 1.5; legOffset[1] -= body.squashY * 1.5; }
  for (let i = 0; i < 4; i += 1) legOffset[i] += Math.sin(t * 6.1 + i * 1.9) * 0.006;
  return legOffset;
}

export function stepTail(tl, t, rng, M) {
  let tailAngle = tl.swish
    ? Math.sin((t / tl.swish.period) * Math.PI * 2 + tl.swish.phase) * tl.swish.amp
    : 0;
  if (t >= tl.nextFlick && tl.flickStart < 0) {
    tl.flickStart = t;
    tl.nextFlick = t + rng.float(M.tailFlick[0], M.tailFlick[1]);
  }
  if (tl.flickStart >= 0) {
    const k = (t - tl.flickStart) / 0.5;
    if (k >= 1) tl.flickStart = -1;
    else tailAngle += Math.sin(k * Math.PI * 3) * 0.35 * (1 - k);
  }
  return tailAngle;
}
