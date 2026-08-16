// 이모지 애니메이션 — 머리 위에 뜨는 ♥ ! ? … 글리프. 모션(행위·이벤트·리듬)이 아니라 **따로 트리거되는 층**이다.
// 문서: guidelines/motion/catalog.md § 이모지 애니메이션
//
// 트리거는 두 곳에서 온다:
//   1. idle 중 가끔 (events.stepEmojiSchedule — 종족별 emojis 목록, 14~40초)
//   2. 모션의 이모지 트리거 — 행위·이벤트에 `emoji: "heart"` 처럼 적어 두면 그 모션이 **시작할 때** 한 번 쏜다
//      (파닥임 → ♥, 생각 → ?, 놀람 → !, 개 꼬리 흔들기 → ♥). 모션이 이모지를 "쥐고" 있지 않는다 —
//      쏘고 나면 이모지는 자기 애니메이션 길이만큼 혼자 논다.
// 채널은 하나. 새 트리거가 오면 이전 것을 끊고 새로 시작한다.

import { ramp, bump } from "./ease.js";

// 이모지 종류. dur는 애니메이션 길이(초), anim은 곡선.
export const EMOJI = {
  heart: { dur: 2.2, anim: "float",  label: "♥ 좋아함" },
  bang:  { dur: 1.3, anim: "pop",    label: "! 놀람" },
  quest: { dur: 2.2, anim: "wobble", label: "? 갸웃" },
  dots:  { dur: 2.6, anim: "mumble", label: "… 중얼" },
  zzz:   { dur: 2.8, anim: "float",  label: "z 잠" }
};

// 이모지 채널 상태
export function initEmoji() { return { kind: null, start: -1 }; }

// 트리거. 같은 종류가 이미 뜨는 중이어도 다시 시작한다(강조).
export function triggerEmoji(ch, kind, t) {
  if (!EMOJI[kind]) return;
  ch.kind = kind;
  ch.start = t;
}

// 프레임. 진행 k(0~1)와 종류별 곡선으로 위치·크기·투명도·기울기를 준다. 끝나면 null.
export function stepEmoji(ch, t) {
  if (!ch.kind) return null;
  const def = EMOJI[ch.kind];
  const k = (t - ch.start) / def.dur;
  if (k >= 1 || k < 0) { ch.kind = null; ch.start = -1; return null; }
  const fadeIn = ramp(Math.min(1, k / 0.15));
  const fadeOut = ramp(Math.min(1, (1 - k) / 0.2));
  const fade = Math.min(fadeIn, fadeOut);
  let dy = 0, scale = 1, rot = 0, opacity = fade * 0.95;
  if (def.anim === "float") {
    // 떠오르며 두근두근 — 위로 천천히, 크기가 심장박동처럼
    dy = k * 0.06 + Math.sin(k * Math.PI * 3) * 0.012;
    scale = 0.85 + 0.15 * fade + Math.max(0, Math.sin(k * Math.PI * 6)) * 0.12;
  } else if (def.anim === "pop") {
    // 튀어나옴 — 처음 크게 튀었다가 제자리, 살짝 떨림
    const pop = k < 0.2 ? 1 + 0.5 * bump(k / 0.2) : 1;
    scale = pop * (0.9 + 0.1 * fade);
    dy = 0.02 * (1 - Math.min(1, k / 0.2));
    rot = Math.sin(k * Math.PI * 14) * 0.06 * (1 - k);
  } else if (def.anim === "wobble") {
    // 갸웃갸웃 — 좌우로 기울며 살짝 까딱
    rot = Math.sin(k * Math.PI * 4) * 0.22;
    dy = Math.sin(k * Math.PI * 2) * 0.01;
    scale = 0.9 + 0.1 * fade;
  } else {
    // 중얼 — 낮게 떠서 잔잔히 흔들림
    dy = Math.sin(k * Math.PI * 5) * 0.006;
    scale = 0.85 + 0.15 * fade;
    opacity = fade * 0.85;
  }
  return { kind: ch.kind, k, dy, scale, rot, opacity };
}
