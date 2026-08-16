// 유지 상태 — 들어가면 몇 초 머물다 돌아오는 것. 진행 곡선이 없고 on/off다.
//   반감김 · ^^ 행복 눈 · 윙크 · 눈썹 상태 · 입 상태 · 갸웃(목표각 유지) · 팔 자세
// 문서: guidelines/motion/motion.md
//
// 형태: { next: 다음 진입 시각, until: 유지 종료 시각(아니면 -1) }

const schedule = (rng, range) => (range ? rng.float(range[0], range[1]) : Infinity);

export function initSquint(rng) { return { next: rng.float(6, 18), until: -1 }; }
export function initMood(rng) { return { nextMood: rng.float(3, 10), moodUntil: -1, nextMouth: rng.float(2, 8), mouthUntil: -1 }; }
export function initTilt(rng, M) { return { next: rng.float(M.tilt[0], M.tilt[1]), until: -1, target: 0, angle: 0 }; }
// 팔 행위. 바인드 포즈(T)에서 이따금 행위(만세·팔짱·뒷짐·허리손·늘어뜨림·파닥임)로
// 넘어갔다 돌아온다. 행위 종류와 가중치는 table.js의 armActions.
export function initArmAction(rng) { return { action: "tpose", next: rng.float(8, 24), until: -1 }; }
export function initWink(rng, M) { return { next: schedule(rng, M.wink), until: -1, side: 0 }; }
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
// 팔 행위 — 바인드에서 행위로, 행위가 끝나면 바인드로. 형태(arms 슬롯)와 무관.
export function stepArmAction(s, t, rng, M, noHang) {
  if (t >= s.next && s.until < 0) {
    const pool = (M.armActions || []).filter(([a]) => !(noHang && a === "hang"));
    if (pool.length) {
      s.action = rng.weighted(pool);
      s.until = t + rng.float(2, 6);
    }
    s.next = t + rng.float(M.armActionGap ? M.armActionGap[0] : 12, M.armActionGap ? M.armActionGap[1] : 36);
  }
  if (s.until >= 0 && t >= s.until) { s.until = -1; s.action = "tpose"; }
  return s.action;
}
export function stepMood(m, t, rng) {
  if (t >= m.nextMood && m.moodUntil < 0) { m.moodUntil = t + rng.float(1.5, 4); m.nextMood = t + rng.float(6, 16); }
  if (m.moodUntil >= 0 && t >= m.moodUntil) m.moodUntil = -1;
  if (t >= m.nextMouth && m.mouthUntil < 0) { m.mouthUntil = t + rng.float(0.8, 2.2); m.nextMouth = t + rng.float(4, 12); }
  if (m.mouthUntil >= 0 && t >= m.mouthUntil) m.mouthUntil = -1;
  return { browAlt: m.moodUntil >= 0, mouthAlt: m.mouthUntil >= 0 };
}
