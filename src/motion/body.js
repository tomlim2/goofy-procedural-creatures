// 몸통 모션 — 호흡·스웨이·락킹·갸웃·롤·끄덕·딥·폴짝·기지개·부르르·젤리.
// 문서: guidelines/motion.md § 몸통
//
// 몸통에는 뼈대 리그가 없다. 전부 group/headGroup의 scale·rotation·position이다.

export function initBreathe(rng) {
  return { period: rng.float(2.6, 5.4), phase: rng.float(0, Math.PI * 2) };
}

// 초기화 순서 (원본 "몸통 idle" 블록 그대로): sway → rock → roll → dip → tilt → nod → hop → stretch → shiver
export function initBody(rng, M) {
  const b = {};
  b.swayAmp = rng.float(M.sway[0], M.sway[1]);
  b.swayPeriod = rng.float(M.swayPeriod[0], M.swayPeriod[1]);
  b.swayPhase = rng.float(0, Math.PI * 2);
  b.rockPeriod = rng.float(2.1, 3.9);
  b.rockPhase = rng.float(0, Math.PI * 2);
  b.roll = M.roll
    ? { amp: rng.float(M.roll.amp[0], M.roll.amp[1]), period: rng.float(M.roll.period[0], M.roll.period[1]), phase: rng.float(0, Math.PI * 2) }
    : null;
  b.nextDip = M.dip ? rng.float(M.dip[0], M.dip[1]) : Infinity;
  b.dipStart = -1;
  b.nextTilt = rng.float(M.tilt[0], M.tilt[1]);
  b.tiltUntil = -1;
  b.tiltTarget = 0;
  b.headAngle = 0;
  b.nextNod = rng.float(9, 24);
  b.nodStart = -1;
  b.nextHop = M.hop ? rng.float(M.hop[0], M.hop[1]) : Infinity;
  b.hopStart = -1;
  b.nextStretch = M.stretch ? rng.float(M.stretch[0], M.stretch[1]) : Infinity;
  b.stretchStart = -1;
  b.nextShiver = rng.float(M.shiver[0], M.shiver[1]);
  b.shiverStart = -1;
  return b;
}

// 젤리는 원본에서 꼬리 뒤에 초기화됐다. 순서 유지를 위해 별도 함수.
export function initJelly(rng, M) {
  return M.jelly
    ? { amp: rng.float(M.jelly.amp[0], M.jelly.amp[1]), freq: rng.float(M.jelly.freq[0], M.jelly.freq[1]), phase: rng.float(0, Math.PI * 2) }
    : null;
}

export function stepBody(b, t, rng, M) {
  const sway = Math.sin((t / b.swayPeriod) * Math.PI * 2 + b.swayPhase) * b.swayAmp;
  const rock = Math.sin((t / b.rockPeriod) * Math.PI * 2 + b.rockPhase) * (M.rock || 0);

  if (t >= b.nextTilt && b.tiltUntil < 0) {
    b.tiltTarget = rng.around(0, M.tiltAmp);
    b.tiltUntil = t + rng.float(1.2, 3.2);
    b.nextTilt = t + rng.float(M.tilt[0], M.tilt[1]);
  }
  if (b.tiltUntil >= 0 && t >= b.tiltUntil) b.tiltUntil = -1;
  const rollAngle = b.roll ? Math.sin((t / b.roll.period) * Math.PI * 2 + b.roll.phase) * b.roll.amp : 0;
  b.headAngle += ((b.tiltUntil >= 0 ? b.tiltTarget : 0) - b.headAngle) * 0.07;

  let headBob = 0;
  if (t >= b.nextNod && b.nodStart < 0) {
    b.nodStart = t;
    b.nextNod = t + rng.float(9, 24);
  }
  if (b.nodStart >= 0) {
    const k = (t - b.nodStart) / 0.7;
    if (k >= 1) b.nodStart = -1;
    else headBob = -Math.abs(Math.sin(k * Math.PI * 2)) * 0.014;
  }

  if (t >= b.nextDip && b.dipStart < 0) {
    b.dipStart = t;
    b.nextDip = t + rng.float(M.dip[0], M.dip[1]);
  }
  if (b.dipStart >= 0) {
    const k = (t - b.dipStart) / 1.2;
    if (k >= 1) b.dipStart = -1;
    else headBob -= Math.sin(Math.min(1, k) * Math.PI) * 0.035;
  }

  let hopY = 0;
  let squashX = 0;
  let squashY = 0;
  if (t >= b.nextHop && b.hopStart < 0) {
    b.hopStart = t;
    b.nextHop = t + rng.float(M.hop[0], M.hop[1]);
  }
  if (b.hopStart >= 0) {
    const k = (t - b.hopStart) / 0.55;
    if (k >= 1) b.hopStart = -1;
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

  let stretchX = 0;
  if (t >= b.nextStretch && b.stretchStart < 0) {
    b.stretchStart = t;
    b.nextStretch = t + rng.float(M.stretch[0], M.stretch[1]);
  }
  if (b.stretchStart >= 0) {
    const k = (t - b.stretchStart) / 1.6;
    if (k >= 1) b.stretchStart = -1;
    else stretchX = Math.sin(Math.min(1, k) * Math.PI) * 0.06;
  }

  let shiverX = 0;
  if (t >= b.nextShiver && b.shiverStart < 0) {
    b.shiverStart = t;
    b.nextShiver = t + rng.float(M.shiver[0], M.shiver[1]);
  }
  if (b.shiverStart >= 0) {
    const k = (t - b.shiverStart) / 0.35;
    if (k >= 1) b.shiverStart = -1;
    else shiverX = Math.sin(k * Math.PI * 9) * 0.008 * (1 - k);
  }

  return { sway, rock, headAngle: b.headAngle + rollAngle, headBob, hopY, squashX, squashY, stretchX, shiverX, swayPeriod: b.swayPeriod, swayPhase: b.swayPhase };
}

export function stepJelly(jelly, t) {
  if (!jelly) return { jellyX: 0, jellyY: 0 };
  const w = Math.sin(t * jelly.freq * Math.PI * 2 + jelly.phase);
  return { jellyX: w * jelly.amp, jellyY: -w * jelly.amp * 0.9 };
}

export function stepBreathe(br, t) {
  return Math.sin((t / br.period) * Math.PI * 2 + br.phase);
}
