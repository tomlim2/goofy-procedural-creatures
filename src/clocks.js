// 개체별 시계. 35마리가 같은 박자로 움직이면 기계처럼 보인다.
// 호흡, 깜빡임, 시선, 눈 개방도(놀람), 반감김, 재생성, 이모트가
// 전부 개체마다 다른 주기·위상으로 돈다.

import { makeRng } from "./rng.js";

const BLINK_TIME = 0.13;

// birth는 이 시계가 태어난 전역 시각이다. 모든 예약은 출생 기준 상대
// 시간으로 잡는다. 절대 시간으로 잡으면 재생성으로 태어난 개체의 예약이
// 전부 과거가 되어, 태어나자마자 매 프레임 다시 재생성되는 폭주가 생긴다.
export function makeClock(seed, birth = 0) {
  const rng = makeRng(seed ^ 0x5bf03635);

  const breathePeriod = rng.float(2.6, 5.4);
  const breathePhase = rng.float(0, Math.PI * 2);

  let nextBlink = rng.float(0, 4);
  let blinkStart = -1;

  let nextGlance = rng.float(0, 3);
  let gaze = [0, 0];
  let gazeTarget = [0, 0];

  // 놀람 — 눈 흰자가 커졌다 돌아온다
  let nextSurprise = rng.float(4, 16);
  let surpriseStart = -1;

  // 반감김 — 몇 초씩 유지되는 졸린 눈
  let nextSquint = rng.float(6, 18);
  let squintUntil = -1;

  // 재생성 — 슬롯의 개체가 교체된다 (레퍼런스 실측 5~13초)
  let regenAt = rng.float(6, 14);

  // ── 몸통 idle ──
  // 체중 이동. 발을 축으로 아주 천천히 좌우로 기운다. 개체마다 폭이 다르다.
  const swayAmp = rng.float(0.006, 0.03);
  const swayPeriod = rng.float(3.2, 7.5);
  const swayPhase = rng.float(0, Math.PI * 2);

  // 머리 갸웃 — 한쪽으로 기울여 몇 초 유지
  let nextTilt = rng.float(4, 12);
  let tiltUntil = -1;
  let tiltTarget = 0;
  let headAngle = 0;

  // 끄덕임 — 짧게 두 번
  let nextNod = rng.float(6, 18);
  let nodStart = -1;

  // 폴짝 — 드물게 제자리 점프. 앉았다 늘어났다 착지까지.
  let nextHop = rng.float(10, 30);
  let hopStart = -1;

  // 부르르 — 아주 드물게 몸을 턴다
  let nextShiver = rng.float(18, 45);
  let shiverStart = -1;

  // 눈썹·입 상태 — 이따금 대체 상태로 넘어갔다 돌아온다
  let nextMood = rng.float(3, 10);
  let moodUntil = -1;
  let nextMouth = rng.float(2, 8);
  let mouthUntil = -1;

  // 이모트 — 머리 위 ♥ ! ?
  let nextEmote = rng.float(5, 30);
  let emoteStart = -1;
  let emoteKind = "heart";

  return {
    update(globalT) {
      const t = globalT - birth;
      if (t >= nextBlink) {
        blinkStart = t;
        nextBlink = t + rng.float(1.8, 6.5);
        if (rng.chance(0.22)) nextBlink = t + BLINK_TIME * 2.4;
      }

      if (t >= nextGlance) {
        gazeTarget = [rng.around(0, 1), rng.around(0, 0.7)];
        nextGlance = t + rng.float(1.4, 5.0);
      }
      gaze = [gaze[0] + (gazeTarget[0] - gaze[0]) * 0.12, gaze[1] + (gazeTarget[1] - gaze[1]) * 0.12];

      let lid = 0;
      if (blinkStart >= 0) {
        const k = (t - blinkStart) / BLINK_TIME;
        if (k >= 1) blinkStart = -1;
        else lid = Math.sin(Math.min(1, k) * Math.PI);
      }

      if (t >= nextSquint && squintUntil < 0) {
        squintUntil = t + rng.float(1.2, 2.8);
        nextSquint = t + rng.float(8, 20);
      }
      if (squintUntil >= 0) {
        if (t >= squintUntil) squintUntil = -1;
        else lid = Math.max(lid, 0.5);
      }

      let aperture = 1;
      if (t >= nextSurprise && surpriseStart < 0) {
        surpriseStart = t;
        nextSurprise = t + rng.float(8, 22);
      }
      if (surpriseStart >= 0) {
        const k = (t - surpriseStart) / 1.1;
        if (k >= 1) surpriseStart = -1;
        else aperture = 1 + 0.65 * Math.pow(Math.sin(Math.PI * k), 0.6);
      }

      if (t >= nextMood && moodUntil < 0) {
        moodUntil = t + rng.float(1.5, 4);
        nextMood = t + rng.float(6, 16);
      }
      if (moodUntil >= 0 && t >= moodUntil) moodUntil = -1;

      if (t >= nextMouth && mouthUntil < 0) {
        mouthUntil = t + rng.float(0.8, 2.2);
        nextMouth = t + rng.float(4, 12);
      }
      if (mouthUntil >= 0 && t >= mouthUntil) mouthUntil = -1;

      // ── 몸통 idle 계산 ──
      const sway = Math.sin((t / swayPeriod) * Math.PI * 2 + swayPhase) * swayAmp;

      if (t >= nextTilt && tiltUntil < 0) {
        tiltTarget = rng.around(0, 0.11);
        tiltUntil = t + rng.float(1.2, 3.2);
        nextTilt = t + rng.float(7, 18);
      }
      if (tiltUntil >= 0 && t >= tiltUntil) tiltUntil = -1;
      headAngle += ((tiltUntil >= 0 ? tiltTarget : 0) - headAngle) * 0.07;

      let headBob = 0;
      if (t >= nextNod && nodStart < 0) {
        nodStart = t;
        nextNod = t + rng.float(9, 24);
      }
      if (nodStart >= 0) {
        const k = (t - nodStart) / 0.7;
        if (k >= 1) nodStart = -1;
        else headBob = -Math.abs(Math.sin(k * Math.PI * 2)) * 0.014;
      }

      let hopY = 0;
      let squashX = 0;
      let squashY = 0;
      if (t >= nextHop && hopStart < 0) {
        hopStart = t;
        nextHop = t + rng.float(16, 40);
      }
      if (hopStart >= 0) {
        const k = (t - hopStart) / 0.55;
        if (k >= 1) hopStart = -1;
        else if (k < 0.2) {
          // 준비 — 웅크린다
          squashY = -0.07 * Math.sin((k / 0.2) * Math.PI);
          squashX = -squashY * 0.8;
        } else if (k < 0.8) {
          // 공중 — 늘어난다
          const j = (k - 0.2) / 0.6;
          hopY = Math.sin(j * Math.PI) * 0.05;
          squashY = 0.05 * Math.sin(j * Math.PI);
          squashX = -squashY * 0.7;
        } else {
          // 착지 — 다시 눌린다
          squashY = -0.05 * Math.sin(((k - 0.8) / 0.2) * Math.PI);
          squashX = -squashY * 0.8;
        }
      }

      let shiverX = 0;
      if (t >= nextShiver && shiverStart < 0) {
        shiverStart = t;
        nextShiver = t + rng.float(26, 60);
      }
      if (shiverStart >= 0) {
        const k = (t - shiverStart) / 0.35;
        if (k >= 1) shiverStart = -1;
        else shiverX = Math.sin(k * Math.PI * 9) * 0.008 * (1 - k);
      }

      let regen = false;
      if (t >= regenAt) {
        regen = true;
        regenAt = t + rng.float(6, 14);
      }

      let emote = null;
      if (t >= nextEmote && emoteStart < 0) {
        emoteStart = t;
        emoteKind = rng.pick(["heart", "bang", "quest"]);
        nextEmote = t + rng.float(14, 40);
      }
      if (emoteStart >= 0) {
        const k = (t - emoteStart) / 2.2;
        if (k >= 1) emoteStart = -1;
        else emote = { kind: emoteKind, k };
      }

      const breathe = Math.sin((t / breathePeriod) * Math.PI * 2 + breathePhase);

      return {
        breathe, lid, gaze, aperture, regen, emote,
        browAlt: moodUntil >= 0, mouthAlt: mouthUntil >= 0,
        sway, headAngle, headBob, hopY, squashX, squashY, shiverX
      };
    }
  };
}
