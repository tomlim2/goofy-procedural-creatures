// 팔다리·꼬리 — 관절 피벗 원점 기준으로 굽는다. 자세·행위는 여기 없다(motion/actions.js).
// 문서: guidelines/character/parts.md § legs·tail·arms·armLength, guidelines/rig.md

import { Sketch, blobPath, arcPath } from "../../stroke.js";
import { makeNoise, makeRng } from "../../rng.js";
import { layout, darken, BUILD } from "./layout.js";

// 팔 치수. 길이 = 형태와 독립인 슬롯 × 개체 지터. medium이 기준 1, long은 그 1.64배(바닥을 쓸 만큼).
// 기준 팔 길이 0.242 — 이보다 짧으면 손이 몸통 근처라 팔로 안 보인다.
// 위팔:아래팔 = 0.48:0.52. 아래팔이 살짝 길어야 손이 멀리 간다.
const ARM_BASE = 0.242;
const ARM_LENGTH_SCALE = { medium: 1, long: 1.64 };

// 어깨 x — 몸통 좌우 윤곽 위. 몸 형태마다 어깨 높이(위에서 22%)에서의 반폭이 다르다:
// box 1 · bean(타원) ≈0.85 · dress(사다리꼴, 위 0.6→아래 1.35) ≈0.76 · tube 0.62.
// 팔은 몸통 옆구리에서 나와야 한다 — 안쪽에서 나오면 가슴 한가운데서 돋는 것처럼 보인다.
const SHOULDER_X = { bean: 0.85, box: 0.98, dress: 0.76, tube: 0.63 };

function armDims(spec, box) {
  const reach = ARM_BASE * spec.proportions.armSpread * (ARM_LENGTH_SCALE[spec.parts.armLength] || 1);
  return {
    x: box.bodyW * (SHOULDER_X[spec.parts.body] || 0.85),   // 어깨 x (오른팔. 왼팔은 -x)
    y: box.bodyTop - (box.bodyTop - box.legTop) * 0.22,     // 어깨 y
    upper: reach * 0.48,
    lower: reach * 0.52
  };
}

// 관절 팔다리. 각 지체는 피벗(어깨·엉덩이) 원점 기준으로 그린다.
// scene이 rotation.z로 흔든다.
//
// 레퍼런스(관절부 4배 확대): 팔은 유형이 여럿이며(뒷짐·소매+동그란 손·스텁+주먹·늘어짐),
// 다리 끝에는 항상 동그란 발이 있다. 다리 뿌리는 몸 윤곽 안쪽(밑단 위)에서 시작해 관절이
// "박혀" 보이고, 팔 뿌리는 몸통 좌우 윤곽 위(옆구리)다 — 안쪽이면 가슴에서 돋는 것처럼 보인다.
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

  const legKind = spec.parts.legs;

  if (box.quad) {
    // 네 다리 — 앞다리 둘·뒷다리 둘이 각각 붙어 있다(옆에서 본 짐승). 뿌리는 몸 윤곽 안쪽(bodyH 25% 위).
    // 형태: stub(기본 — 굵은 스텁 + 발끝 + 발가락) · stick(가는 다리 + 둥근 발) · boots(양말) ·
    // float(레이맨식 — 다리 없이 발만 떠 있다). bent·tiptoe는 네발에서 stick으로 그린다.
    // 기장은 layout이 legLength로 정한다(short = 닥스훈트). 몸 길이는 build(box.bodyW).
    const cx = box.bodyCx;
    const hipY = box.legTop + box.bodyH * 0.25;
    const kind = ["stub", "stick", "boots", "float"].includes(legKind) ? legKind : "stick";
    const gap = Math.max(0.03, box.bodyW * 0.16);          // 한 쌍 안의 두 다리 간격
    const front = cx - box.bodyW * 0.6;
    const back = cx + box.bodyW * 0.6;
    [front - gap / 2, front + gap / 2, back - gap / 2, back + gap / 2].forEach((x, i) => {
      const s = make();
      const len = hipY;
      const lean = noise(i * 7.1) * 0.012;
      if (kind === "float") {
        // 떠 있는 발 — 다리 선 없이 발만. 관절 지터로 발이 둥둥 흔들린다
        dot(s, lean + 0.006, -len + 0.014, 0.024, skin);
      } else if (kind === "stick") {
        s.stroke([[0, 0], [lean, -len]], { color: ink0, width: 0.01 });
        dot(s, lean + 0.006, -len + 0.012, 0.02, skin);
      } else if (kind === "boots") {
        // 양말 — 발목까지 채운 작은 부츠
        s.stroke([[0, 0], [lean, -len]], { color: ink0, width: 0.012 });
        const boot = [[lean - 0.022, -len], [lean - 0.018, -len + 0.036], [lean + 0.012, -len + 0.036], [lean + 0.03, -len + 0.005], [lean + 0.03, -len]];
        s.fill(boot, cloth === skin ? ink0 : darken(cloth, 0.75));
        s.outline(boot, { color: ink0, width: 0.009 });
      } else {
        // 굵은 스텁 다리 + 살짝 앞으로 나온 둥근 발끝 + 발가락 두 줄 (레퍼런스)
        s.stroke([[0, 0], [lean, -len]], { color: ink0, width: 0.016 });
        s.stroke([[lean - 0.02, -len], [lean + 0.03, -len + 0.003]], { color: ink0, width: 0.012 });
        s.stroke([[lean + 0.006, -len + 0.002], [lean + 0.01, -len + 0.016]], { color: ink0, width: 0.006 });
        s.stroke([[lean + 0.018, -len + 0.002], [lean + 0.021, -len + 0.014]], { color: ink0, width: 0.006 });
      }
      limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side: i < 2 ? -1 : 1, index: i, behind: false });
    });
    return limbs;
  }

  // ── 두발 다리 ──
  // 뿌리는 몸 밑단보다 살짝 위(윤곽 안). 끝에는 항상 발.
  const hipY = box.legTop + 0.02;
  // 스탠스(벌림)는 다리 형태가 아니라 몸통 체격이 정한다 — 넓은 몸이 넓은 스탠스를 받친다.
  const spread = (BUILD[spec.parts.build] || BUILD.medium).stance;
  for (const side of [-1, 1]) {
    const x = side * box.bodyW * spread;
    const s = make();
    const len = hipY;
    let footX = 0;
    if (legKind === "float") {
      // 레이맨식 — 다리 없이 큼직한 발만 떠 있다. 관절 지터·발 까딱이 발을 둥둥 흔든다
      dot(s, side * 0.008, -len + 0.016, 0.03, skin);
      limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
      continue;
    }
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
      s.stroke([[0, 0], [noise(side * 3.3) * 0.02, -len]], { color: ink0, width: 0.011 });
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
  if (armKind === "none") return limbs;   // 팔 없음 — 지체도 리그도 없다 (도깨비 일부)
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

// 리그 서술 — 모션이 이 개체 위에서 돌 때 필요한 정적 치수. 전부 스펙에서 나온다.
//   arm    두발의 팔(IK): 어깨 위치·위팔·아래팔 길이·몸 앵커. 앵커는 몸 좌표(발바닥 원점, y 위), 오른팔 기준 — 왼팔은 x 반전. 네발은 null
//   legTop 몸통 밑단 높이 — 네발이 엎드려 잘 때 몸이 내려앉는 거리
export function motionRig(spec) {
  const box = layout(spec);
  // arm은 팔이 있는 두발만. 팔 없는 두발(도깨비 arms none)은 arm null이지만 quad도 false — 팔 행위 층만 쉰다
  return { arm: box.quad || spec.parts.arms === "none" ? null : armRigOf(spec, box), legTop: box.legTop, quad: box.quad };
}

function armRigOf(spec, box) {
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

// ── 꼬리 — 골격(tail) × 스킨(tailSkin) ──
// 꼬리는 두 슬롯이다. **골격**(curl·flag·longtail·stubtail·hook·kink·ring)은 척추의 모양(점 목록, 피벗 원점)이고,
// **스킨**(line·thick·plume·tuft·ringed)은 그 척추 위에 무엇을 입히나다 — 가는 선, 채운 굵은 꼬리, 북슬한 깃털, 끝 뭉치, 고리 무늬.
// 어느 골격에든 어느 스킨이든 입힌다 (스텁 골격에 깃털 스킨 = 폼폼). scene이 뿌리를 회전시켜 살랑거린다.

// 골격 — 척추 점 목록. tailLift(비율)로 끝이 조금 오르내린다
function tailSpine(kind, lift) {
  const up = lift * 0.02;
  if (kind === "curl") return [[0, 0], [0.05, 0.08], [0.03 + up, 0.16], [-0.015, 0.2]];
  if (kind === "flag") return [[0, 0], [0.025, 0.1], [0.01 + up, 0.2]];
  if (kind === "longtail") return [[0, 0], [0.07, 0.015], [0.14, 0.05], [0.18, 0.12 + up]];
  if (kind === "hook") return [[0, 0], [0.02, 0.08], [0.02, 0.16 + up], [-0.01, 0.215], [-0.045, 0.205], [-0.055, 0.165]];   // 위로 섰다 갈고리
  if (kind === "kink") return [[0, 0], [0.035, 0.06], [0.005, 0.11], [0.045, 0.16], [0.02, 0.21 + up]];                     // 마디마다 꺾임
  if (kind === "ring") return arcPath(-0.03, 0.075, 0.078, 0.078, -1.2, 4.3, 22);                                            // 등 위로 한 바퀴(스피츠)
  return [[0, 0], [0.02, 0.03], [0.035, 0.05]];   // stubtail — 뭉툭
}

// 척추의 누적 길이 비율 t(0~1) 목록
function spineT(spine) {
  const acc = [0];
  for (let i = 1; i < spine.length; i += 1) acc.push(acc[i - 1] + Math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1]));
  const total = acc[acc.length - 1] || 1;
  return acc.map((a) => a / total);
}
// 척추를 따라 좌우로 두께 widthAt(t)만큼 부풀린 폐곡선 — 채운 꼬리 몸통. 끝은 뾰족하게 닫는다
function tubePath(spine, widthAt) {
  const ts = spineT(spine);
  const left = [], right = [];
  for (let i = 0; i < spine.length; i += 1) {
    const [x, y] = spine[i];
    const [nx0, ny0] = spine[Math.max(0, i - 1)], [nx1, ny1] = spine[Math.min(spine.length - 1, i + 1)];
    let dx = nx1 - nx0, dy = ny1 - ny0;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = widthAt(ts[i]);
    left.push([x - dy * w, y + dx * w]);
    right.push([x + dy * w, y - dx * w]);
  }
  return [...left, ...right.reverse()];
}
// 꺾은선 위 길이 비율 t(0~1) 지점과 그 자리의 진행 방향
function alongSpine(spine, t) {
  const ts = spineT(spine);
  let i = 0;
  while (i < ts.length - 2 && ts[i + 1] < t) i += 1;
  const k = (t - ts[i]) / Math.max(1e-6, ts[i + 1] - ts[i]);
  const [ax, ay] = spine[i], [bx, by] = spine[i + 1];
  let dx = bx - ax, dy = by - ay;
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, dx, dy };
}

export function tailSketch(spec) {
  const rng = makeRng((spec.proportions.wobbleSeed + 404) >>> 0);
  const noise = makeNoise(rng);
  const sketch = new Sketch(noise, spec.proportions.wobble);
  const box = layout(spec);
  if (!box.quad) return { sketch, pivot: [0, 0] };

  const p = spec.proportions;
  const ink0 = spec.palette.ink;
  const cx = box.bodyCx;
  const pivot = [cx + box.bodyW * 0.98, (box.bodyTop + box.legTop) / 2 + box.bodyH * 0.1];
  const spine = tailSpine(spec.parts.tail, p.tailLift);
  const skin = spec.parts.tailSkin || "line";
  const stub = spec.parts.tail === "stubtail";
  const fur = spec.palette.skin;   // 털색 = 머리색 (개·고양이는 몸도 같은 계열)

  if (skin === "line") {
    // 가는 선 — 손그림 꼬리 한 획 (스텁은 굵게)
    sketch.stroke(spine, { color: ink0, width: stub ? 0.02 : 0.011, jitter: 0.003 });
  } else if (skin === "thick") {
    // 굵은 꼬리 — 뿌리 굵고 끝으로 가늘어지는 채운 몸통 + 윤곽
    const body = tubePath(spine, (t) => (stub ? 0.024 : 0.02) * (1 - t * 0.7) + 0.004);
    sketch.fill(body, fur);
    sketch.outline(body, { color: ink0, width: 0.011, passes: 2 });
  } else if (skin === "plume") {
    // 북슬한 깃털 꼬리 — 가운데가 부푼 채운 몸통 + 윤곽 + 털 획 (스텁이면 폼폼)
    const body = tubePath(spine, (t) => stub ? 0.03 : 0.016 + 0.024 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
    sketch.fill(body, fur);
    sketch.outline(body, { color: ink0, width: 0.011, passes: 2 });
    const n = stub ? 3 : 6;
    for (let i = 0; i < n; i += 1) {
      const t = stub ? 0.3 + i * 0.25 : 0.25 + i * 0.13;
      const a = alongSpine(spine, Math.min(1, t));
      const side = i % 2 ? 1 : -1;
      const nx = -a.dy * side, ny = a.dx * side;
      const w = stub ? 0.03 : 0.028;
      sketch.stroke([[a.x + nx * w * 0.7, a.y + ny * w * 0.7], [a.x + nx * (w + 0.02) + a.dx * 0.01, a.y + ny * (w + 0.02) + a.dy * 0.01]], { color: ink0, width: 0.007, jitter: 0.004 });
    }
  } else if (skin === "tuft") {
    // 끝 뭉치 — 가는 선 + 끝에 채운 뭉치(사자 꼬리)
    sketch.stroke(spine, { color: ink0, width: 0.011, jitter: 0.003 });
    const tip = spine[spine.length - 1];
    const ball = blobPath(tip[0], tip[1], stub ? 0.02 : 0.024, stub ? 0.018 : 0.02, { lumps: 4, amount: 0.25, noise: null });
    sketch.fill(ball, darken(fur, 0.82));
    sketch.outline(ball, { color: ink0, width: 0.01 });
  } else {
    // ringed — 굵은 꼬리에 고리 무늬 (너구리·얼룩 고양이). 몸통 + 어두운 띠 셋
    const wAt = (t) => (stub ? 0.024 : 0.019) * (1 - t * 0.55) + 0.004;
    const body = tubePath(spine, wAt);
    sketch.fill(body, fur);
    for (const t of stub ? [0.5] : [0.3, 0.55, 0.8]) {
      const a = alongSpine(spine, t);
      const w = wAt(t) * 1.15;
      sketch.stroke([[a.x - a.dy * -w, a.y + a.dx * -w], [a.x - a.dy * w, a.y + a.dx * w]], { color: darken(fur, 0.55), width: 0.014 });
    }
    sketch.outline(body, { color: ink0, width: 0.011, passes: 2 });
  }
  return { sketch, pivot };
}
