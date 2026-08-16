// 이징 — 모든 모션 곡선은 부드럽게 들어가고 부드럽게 나온다(ease in / ease out). 시작·끝에서 속도가 0이다.
// 문서: guidelines/motion/rules.md § 이징
//
// 봉투(0→1→0)는 sin(πk)가 아니라 raised cosine — sin은 시작 기울기가 π라 "툭" 튀고, |sin|은 꺾인다.
// 목표 추종(시선·얼굴 돌림·관절)은 지수 lerp가 아니라 임계감쇠 2차 필터 — lerp는 첫 프레임이 가장 빨라 시작이 딱딱하다.

// 0~1 S자. 양끝 기울기 0.
export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// 0→1 램프 (0~1 입력). 선형 페이드 대신 쓴다.
export function ramp(x) { return smoothstep(0, 1, x); }

// 0→1→0 한 번 (k 0~1). 양끝·꼭대기 모두 부드럽다.
export function bump(k) { return 0.5 - 0.5 * Math.cos(2 * Math.PI * Math.min(1, Math.max(0, k))); }

// 0→1→0 n번 (k 0~1). |sin(nπk)| 대신 — 바닥에서 꺾이지 않는다.
export function bumps(k, n) { const s = Math.sin(n * Math.PI * Math.min(1, Math.max(0, k))); return s * s; }

// 들어감(attack)·유지·나감(release) 봉투 (k 0~1). attack·release는 전체 길이의 비율.
export function envelope(k, attack, release) {
  return smoothstep(0, attack, k) * (1 - smoothstep(1 - release, 1, k));
}

// 임계감쇠 2차 추종 — s = { x, v } 를 target으로. w는 프레임당 각진동수 (0.1 ≈ 0.8초에 95%, 0.2 ≈ 0.4초).
// 넘침 없이 S자로 붙는다. 프레임 기반(호출당 한 걸음)이라 결정적이다.
export function damp(s, target, w) {
  s.v += w * w * (target - s.x) - 2 * w * s.v;
  s.x += s.v;
  return s.x;
}
