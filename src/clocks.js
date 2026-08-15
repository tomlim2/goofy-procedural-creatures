// 개체별 시계. 35마리가 같은 박자로 숨쉬고 깜빡이면 기계처럼 보인다.
// 주기도 위상도 전부 개체마다 다르게 둔다.

import { makeRng } from "./rng.js";

export function makeClock(seed) {
  const rng = makeRng(seed ^ 0x5bf03635);

  const breathePeriod = rng.float(2.6, 5.4);
  const breathePhase = rng.float(0, Math.PI * 2);
  const blinkGap = () => rng.float(1.8, 6.5);
  const glanceGap = () => rng.float(1.4, 5.0);

  let nextBlink = rng.float(0, 4);
  let nextGlance = rng.float(0, 3);
  let blinkStart = -1;
  let gaze = [0, 0];
  let gazeTarget = [0, 0];

  const BLINK_TIME = 0.13;

  return {
    // t는 초. 매 프레임 호출한다.
    update(t) {
      if (t >= nextBlink) {
        blinkStart = t;
        nextBlink = t + blinkGap();
        // 가끔 두 번 연속으로 깜빡인다. 이게 있으면 살아 있는 느낌이 확 는다.
        if (rng.chance(0.22)) nextBlink = t + BLINK_TIME * 2.4;
      }

      if (t >= nextGlance) {
        gazeTarget = [rng.around(0, 1), rng.around(0, 0.7)];
        nextGlance = t + glanceGap();
      }

      // 시선은 튀지 않고 따라간다.
      gaze = [gaze[0] + (gazeTarget[0] - gaze[0]) * 0.12, gaze[1] + (gazeTarget[1] - gaze[1]) * 0.12];

      let lid = 0;
      if (blinkStart >= 0) {
        const k = (t - blinkStart) / BLINK_TIME;
        if (k >= 1) blinkStart = -1;
        else lid = Math.sin(Math.min(1, k) * Math.PI);
      }

      const breathe = Math.sin((t / breathePeriod) * Math.PI * 2 + breathePhase);

      return { breathe, lid, gaze };
    }
  };
}
