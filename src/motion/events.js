// 이벤트 — 재생성·이모트. 문서: guidelines/motion.md § 이모트, § 재생성

export function initRegen(rng) {
  return { at: rng.float(6, 14) };
}
export function initEmote(rng) {
  return { next: rng.float(5, 30), start: -1, kind: "heart" };
}

export function stepRegen(r, t, rng) {
  if (t >= r.at) {
    r.at = t + rng.float(6, 14);
    return true;
  }
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
