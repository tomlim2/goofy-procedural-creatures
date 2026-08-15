// 개체별 시계. 35마리가 같은 박자로 움직이면 기계처럼 보인다.
// 호흡, 깜빡임, 시선, 눈 개방도(놀람), 반감김, 재생성, 이모트가
// 전부 개체마다 다른 주기·위상으로 돈다.

import { makeRng } from "./rng.js";

const BLINK_TIME = 0.13;

export function makeClock(seed) {
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

  // 이모트 — 머리 위 ♥ ! ?
  let nextEmote = rng.float(5, 30);
  let emoteStart = -1;
  let emoteKind = "heart";

  return {
    update(t) {
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

      return { breathe, lid, gaze, aperture, regen, emote };
    }
  };
}
