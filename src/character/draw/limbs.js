// 팔다리·꼬리 — 관절 피벗 원점 기준으로 굽는다. 자세는 여기 없다(motion/limbs.js).
// 문서: guidelines/parts-catalog.md § legs·tail·arms·armLength, guidelines/rig.md

import { Sketch, blobPath } from "../../stroke.js";
import { makeNoise, makeRng } from "../../rng.js";
import { layout, darken } from "./layout.js";

// 관절 팔다리. 각 지체는 피벗(어깨·엉덩이) 원점 기준으로 그린다.
// scene이 rotation.z로 흔든다.
//
// 레퍼런스(관절부 4배 확대): 지체는 몸 윤곽 안쪽에서 나오고, 팔은 유형이
// 여럿이며(뒷짐·소매+동그란 손·스텁+주먹·늘어짐), 다리 끝에는 항상 동그란
// 발이 있다. 뿌리를 윤곽 안으로 넣어야 관절이 "박혀" 보인다.
//
// 반환: [{ sketch, pivot: [x, y], kind: "arm"|"leg", side, index, behind }]
export function limbSketches(spec) {
  const rng = makeRng((spec.proportions.wobbleSeed + 303) >>> 0);
  const noise = makeNoise(rng);
  const box = layout(spec);
  const p = spec.proportions;
  const ink0 = spec.palette.ink;
  const skin = spec.palette.skin;
  const cloth = spec.palette.cloth;
  const limbs = [];

  const make = () => new Sketch(noise, p.wobble);
  const dot = (s, x, y, r, color) => {
    s.fill(blobPath(x, y, r, r * 0.9, { lumps: 3, amount: 0.18, noise: null }), color);
    s.outline(blobPath(x, y, r, r * 0.9, { lumps: 3, amount: 0.18, noise: null }), { color: ink0, width: 0.009 });
  };

  if (box.quad) {
    // 네 다리 — 몸통 밑에 붙은 짧은 스텁 + 발가락 표시.
    // 뿌리는 몸 윤곽 안쪽(bodyH의 25% 위)에서 시작한다.
    const cx = box.bodyCx + box.bodyW * 0.35;
    const hipY = box.legTop + box.bodyH * 0.25;
    [-0.62, -0.22, 0.28, 0.66].forEach((tt, i) => {
      const x = cx + box.bodyW * tt;
      const s = make();
      const len = hipY;
      const lean = noise(tt * 7.1) * 0.012;
      // 굵은 스텁 다리
      s.stroke([[0, 0], [lean, -len]], { color: ink0, width: 0.016 });
      // 발 — 살짝 앞으로 나온 둥근 발끝 + 발가락 두 줄
      s.stroke([[lean - 0.02, -len], [lean + 0.03, -len + 0.003]], { color: ink0, width: 0.012 });
      s.stroke([[lean + 0.006, -len + 0.002], [lean + 0.01, -len + 0.016]], { color: ink0, width: 0.006 });
      s.stroke([[lean + 0.018, -len + 0.002], [lean + 0.021, -len + 0.014]], { color: ink0, width: 0.006 });
      limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side: i < 2 ? -1 : 1, index: i, behind: false });
    });
    return limbs;
  }

  // ── 두발 다리 ──
  // 뿌리는 몸 밑단보다 살짝 위(윤곽 안). 끝에는 항상 발.
  const hipY = box.legTop + 0.02;
  const legKind = spec.parts.legs;
  for (const side of [-1, 1]) {
    const spread = legKind === "wide" ? 0.72 : 0.5;
    const x = side * box.bodyW * spread;
    const s = make();
    const len = hipY;
    let footX = 0;
    if (legKind === "bent") {
      s.stroke([[0, 0], [side * 0.04, -len * 0.5], [side * 0.01, -len]], { color: ink0, width: 0.011 });
      footX = side * 0.01;
    } else if (legKind === "stub") {
      s.stroke([[0, 0], [0, -len]], { color: ink0, width: 0.019 });
    } else if (legKind === "tiptoe") {
      // 발끝으로 선 가는 다리 — 발이 아래로 뾰족
      s.stroke([[0, 0], [side * 0.008, -len]], { color: ink0, width: 0.009 });
      s.stroke([[side * 0.008 - 0.012, -len + 0.012], [side * 0.008, -len], [side * 0.008 + 0.012, -len + 0.012]], { color: ink0, width: 0.009 });
      limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
      continue;
    } else {
      s.stroke([[0, 0], [noise(side * 3.3) * 0.02, -len]], { color: ink0, width: legKind === "wide" ? 0.014 : 0.011 });
      footX = noise(side * 3.3) * 0.02;
    }
    // 발
    if (legKind === "boots") {
      // 부츠 — 발목까지 채워진 덩어리
      const boot = [[footX - 0.028, -len], [footX - 0.024, -len + 0.045], [footX + 0.012, -len + 0.045], [footX + 0.036, -len + 0.006], [footX + 0.036, -len]];
      s.fill(boot, cloth === skin ? ink0 : darken(cloth, 0.75));
      s.outline(boot, { color: ink0, width: 0.01 });
    } else {
      // 동그란 발 — 레퍼런스 기본
      dot(s, footX + side * 0.008, -len + 0.012, 0.022, skin);
    }
    limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
  }

  // ── 두발 팔 ──
  // 형태(arms 슬롯)만 여기서 정한다. 자세는 scene이 회전과 앞/뒤 전환으로 준다.
  //
  // 팔은 두 마디다: 위팔(어깨 피벗 원점, 아래로) + 아래팔(팔꿈치 피벗 원점, 아래로).
  // scene이 아래팔 피벗을 위팔 끝에 붙이고 어깨각·팔꿈치각을 따로 준다.
  // 그래야 팔이 접힌다 — 한 획으로 그리면 아무리 돌려도 막대기다.
  //
  // 뒷짐은 팔이 몸 뒤로 사라지고 팔꿈치 끝만 옆구리로 삐죽 나오는 형태라
  // 회전만으로는 표현이 안 된다. back 스케치를 따로 굽는다.
  const armKind = spec.parts.arms;
  const shoulderY = box.bodyTop - (box.bodyTop - box.legTop) * 0.22;
  for (const side of [-1, 1]) {
    const x = side * box.bodyW * (spec.parts.body === "dress" ? 0.7 : 0.78);
    // 길이 = 형태와 독립인 슬롯 × 개체 지터. medium이 기본, verylong은 바닥을 쓸 만큼.
    // (short 0.45가 있었는데 손이 몸통에 붙어 의미가 없어 뺐다.)
    const lengthScale = { medium: 1.1, long: 2.2, verylong: 3.6 }[spec.parts.armLength] || 1.1;
    const reach = 0.11 * p.armSpread * lengthScale;
    // 위팔:아래팔 = 0.48:0.52. 아래팔이 살짝 길어야 손이 멀리 간다.
    const upperLen = reach * 0.48;
    const lowerLen = reach * 0.52;

    const upper = make();
    const lower = make();
    const w = armKind === "stubby" ? 0.017 : 0.01;

    if (armKind === "sleeve") {
      // 위팔은 옷색 소매. 아래팔은 맨팔 + 손.
      const sl = [[side * -0.012, 0.012], [side * 0.012, 0.012], [side * 0.014, -upperLen], [side * -0.012, -upperLen]];
      upper.fill(sl, cloth);
      upper.outline(sl, { color: ink0, width: 0.01 });
      lower.stroke([[0, 0], [side * 0.004, -lowerLen]], { color: ink0, width: 0.01 });
      dot(lower, side * 0.006, -lowerLen - 0.006, 0.022, skin);
    } else if (armKind === "stubby") {
      // 짧고 굵은 두 마디 + 주먹
      upper.stroke([[0, 0], [side * 0.004, -upperLen]], { color: ink0, width: w });
      lower.stroke([[0, 0], [side * 0.004, -lowerLen]], { color: ink0, width: w });
      dot(lower, side * 0.006, -lowerLen - 0.004, 0.02, skin);
    } else {
      // stick / mitten — 가는 두 마디. 마디 끝에 관절 표시는 없다(손그림).
      upper.stroke([[0, 0], [side * 0.006, -upperLen]], { color: ink0, width: w });
      lower.stroke([[0, 0], [side * 0.004, -lowerLen]], { color: ink0, width: w });
      if (armKind === "mitten") dot(lower, side * 0.006, -lowerLen - 0.006, 0.024, skin);
      else lower.stroke([[side * 0.006 - 0.016, -lowerLen], [side * 0.006 + 0.016, -lowerLen + 0.004]], { color: ink0, width: w });
    }

    // back — 뒷짐. 팔꿈치만 옆구리에서 삐죽. 형태에 따라 굵기만 다르다
    const back = make();
    const bw = armKind === "stubby" ? 0.017 : armKind === "sleeve" ? 0.014 : 0.011;
    back.stroke([[0, 0], [side * 0.03, -0.045], [side * 0.05, -0.08]], { color: ink0, width: bw });

    limbs.push({
      sketch: upper, lowerSketch: lower, backSketch: back,
      pivot: [x, shoulderY], elbow: [side * 0.006, -upperLen],
      kind: "arm", side, index: 0
    });
  }
  return limbs;
}

// 팔 각도 [어깨, 팔꿈치] — 바인드 포즈와 행위별 목표.
//
// 바인드 포즈는 T포즈다: 어깨 수평(1.57 outward), 팔꿈치 0. 캐릭터에 "자세"란 없다 —
// 모션(행위)이 없으면 T포즈다. 행위는 여기서 각도만 정의하고, 언제 어떤 행위를 하는지는
// motion/이 정한다. 행위가 끝나면 T포즈로 돌아온다.
//
// 어깨각은 outward(몸 바깥) 양수. 팔꿈치각은 위팔 기준 아래팔이 얼마나 꺾이나 —
// 양수면 안쪽(몸 쪽)으로 접힌다.
//
// 부호: 위팔은 (0, -len)으로 늘어진 채 굽고 rotation.z(반시계 양수)로 든다.
// 왼팔(side -1, x<0)을 바깥(더 왼쪽)으로 들려면 시계방향 = 음수, 오른팔은 반시계 = 양수.
// 그래서 outward = side다. (-side로 두면 팔이 몸 안쪽으로 접힌다.)
export const BIND_POSE = "tpose";

export function armPoseAngles(action, side) {
  const outward = side;
  switch (action) {
    case "tpose":  return [outward * 1.57, 0];              // 바인드. 어깨 수평, 곧게
    case "raise":  return [outward * 2.4, outward * -0.5];   // 만세
    case "cross":  return [outward * 0.35, outward * 2.0];  // 팔짱
    case "behind": return [outward * -0.2, 0];              // 뒷짐 (back 스케치)
    case "hips":   return [outward * 0.55, outward * 1.7];  // 허리에 손
    case "hang":   return [outward * 0.35, outward * 0.35]; // 늘어뜨림
    case "flap":   return [outward * 1.9, outward * -0.6];  // 파닥임 기준 (위에서 진동)
    default:       return [outward * 1.57, 0];
  }
}
export function armPoseAngle(action, side) {
  return armPoseAngles(action, side)[0];
}

// 꼬리. 피벗(꼬리 뿌리) 원점 기준으로 그린다. scene이 회전시켜 살랑거린다.
export function tailSketch(spec) {
  const rng = makeRng((spec.proportions.wobbleSeed + 404) >>> 0);
  const noise = makeNoise(rng);
  const sketch = new Sketch(noise, spec.proportions.wobble);
  const box = layout(spec);
  if (!box.quad) return { sketch, pivot: [0, 0] };

  const p = spec.proportions;
  const ink0 = spec.palette.ink;
  const cx = box.bodyCx + box.bodyW * 0.35;
  const pivot = [cx + box.bodyW * 0.98, (box.bodyTop + box.legTop) / 2 + box.bodyH * 0.1];
  const kind = spec.parts.tail;

  if (kind === "curl") {
    sketch.stroke([
      [0, 0], [0.05, 0.08], [0.03 + p.tailLift * 0.02, 0.16], [-0.015, 0.2]
    ], { color: ink0, width: 0.011 });
  } else if (kind === "flag") {
    sketch.stroke([[0, 0], [0.025, 0.1], [0.01 + p.tailLift * 0.02, 0.2]], { color: ink0, width: 0.012 });
  } else if (kind === "longtail") {
    sketch.stroke([
      [0, 0], [0.07, 0.015], [0.14, 0.05], [0.18, 0.12 + p.tailLift * 0.02]
    ], { color: ink0, width: 0.011 });
  } else {
    // stubtail — 뭉툭한 꼬리
    sketch.stroke([[0, 0], [0.035, 0.05]], { color: ink0, width: 0.02 });
  }
  return { sketch, pivot };
}

