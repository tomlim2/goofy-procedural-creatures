// 팔다리·꼬리 — 관절 피벗 원점 기준으로 굽는다. 자세·행위는 여기 없다(motion/actions.js).
// 문서: guidelines/character/parts.md § legs·tail·arms·armLength, guidelines/rig.md

import { Sketch, blobPath } from "../../stroke.js";
import { makeNoise, makeRng } from "../../rng.js";
import { layout, darken } from "./layout.js";

// 팔 치수. 길이 = 형태와 독립인 슬롯 × 개체 지터. medium이 기준 1, long은 그 1.64배(바닥을 쓸 만큼).
// 기준 팔 길이 0.242 — 이보다 짧으면 손이 몸통 근처라 팔로 안 보인다.
// 위팔:아래팔 = 0.48:0.52. 아래팔이 살짝 길어야 손이 멀리 간다.
const ARM_BASE = 0.242;
const ARM_LENGTH_SCALE = { medium: 1, long: 1.64 };

function armDims(spec, box) {
  const reach = ARM_BASE * spec.proportions.armSpread * (ARM_LENGTH_SCALE[spec.parts.armLength] || 1);
  return {
    x: box.bodyW * (spec.parts.body === "dress" ? 0.7 : 0.78),   // 어깨 x (오른팔. 왼팔은 -x)
    y: box.bodyTop - (box.bodyTop - box.legTop) * 0.22,          // 어깨 y
    upper: reach * 0.48,
    lower: reach * 0.52
  };
}

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
  const dims = armDims(spec, box);
  const shoulderY = dims.y;
  const upperLen = dims.upper;
  const lowerLen = dims.lower;
  for (const side of [-1, 1]) {
    const x = side * dims.x;

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

// 바인드 포즈 — 캐릭터가 아무 모션도 받지 않았을 때의 팔. T포즈: 어깨 수평(1.57 outward),
// 팔꿈치 0. 캐릭터에 "자세"란 없다 — idle과 행위(만세·인사·팔짱…)는 전부 motion/actions.js다.
// 화면에서 T포즈는 BIND 뷰에서만 보인다.
//
// [어깨각, 팔꿈치각]. outward(몸 바깥) 양수. 세계 rotation.z로 바꾸려면 side를 곱한다:
// 위팔은 (0, -len)으로 늘어진 채 굽고 rotation.z(반시계 양수)로 든다. 왼팔(side -1, x<0)을
// 바깥(더 왼쪽)으로 들려면 시계방향 = 음수, 오른팔은 반시계 = 양수. 그래서 outward = side다.
export const BIND_ARM = [1.57, 0];

// 팔 리그 서술 — 모션이 손 목표를 관절각으로 풀 때(IK) 쓰는 정적 치수. 전부 스펙에서 나온다.
// 네발은 팔이 없어 null. 앵커는 몸 좌표(발바닥 원점, y 위), 오른팔 기준 — 왼팔은 x를 반전한다.
export function armRig(spec) {
  const box = layout(spec);
  if (box.quad) return null;
  const dims = armDims(spec, box);
  return {
    x: dims.x, y: dims.y, upper: dims.upper, lower: dims.lower,
    anchors: {
      ground: 0,                                                        // 바닥. 손이 이 아래로 못 간다
      hip: [box.bodyW * 0.6, box.legTop + 0.04],                        // 허리(골반 옆)
      chestFar: [-box.bodyW * 0.15, box.bodyTop - box.bodyH * 0.32],    // 반대쪽 가슴 (팔짱)
      chin: [box.headRx * 0.18, box.bodyTop],                           // 턱
      brow: [box.headRx * 0.5, box.headCy + box.headRy * 0.25]          // 눈썹 옆 (경례)
    }
  };
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

