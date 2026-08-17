// 개체 리그 조립. 계층·원점·renderOrder는 guidelines/rig.md, 메시·재질 수는 guidelines/performance.md.

import * as THREE from "three";
import { drawCreature, facePartKinds, facePartSketch, limbSketches, motionRig, tailSketch, layout, eyeGeometry, eyeShape, patched, starPath, heartPath, angryEyeSketch, STATIC_EYE_KEYS } from "../character/index.js";
import { blobPath, arcPath, Sketch } from "../stroke.js";
import { makeClock, bindArm } from "../motion/index.js";
import { sketchMesh } from "./material.js";

export const BOIL_FRAMES = 3;

// fake 3D 깊이(z) — 얼굴 돌림 때 층이 이목구비 이동량의 몇 배 밀리나. 1 = 이목구비(얼굴 앞면), 0 = 머리 윤곽(두개골 축, 안 밀림), 음수 = 뒤(반대로).
// 층마다 **숫자 하나**로 정한다 — 앞에 있는지 뒤에 있는지가 이동량이다. 같은 뜻의 층이 같은 값을 갖는 건 태그일 뿐이고(귀 둘, 머리카락 앞·두피),
// 뜻으로 묶어 같은 그룹에 넣지 않는다: 앞머리(얼굴 앞)와 뒷머리(머리 뒤)는 같은 머리카락이라도 깊이가 달라 다르게 밀린다.
// scene/animate.js가 층마다 position = 깊이 × 이목구비 이동량 (x·y 같은 배율). 크기는 안 바뀐다. 문서: guidelines/rig.md § fake 3D 깊이
export const DEPTH = {
  face: 1,          // 이목구비 (faceGroup)
  hat: 0.45,        // 모자 — 머리 위 앞쪽
  horns: 0.45,      // 뿔
  hairFront: 0.12,  // 앞머리 — 이마 위(얼굴 앞)지만 머리에 붙은 것이라 조금만
  hairCrown: 0.12,  // 두피 위 머리카락 — 앞머리와 이어지는 캡·가시
  hairBack: -0.12,  // 뒷머리 — 머리 **뒤**라 반대로, 앞머리와 같은 크기만큼
  ears: -0.4,       // 귀(옆귀·개/고양이 귀) — 머리 옆·뒤, 머리가 돌면 얼굴 반대편으로 돌아 나간다
  head: 0           // 윤곽 (headGroup 직접)
};

// 감은 눈 두 벌 — 감은 눈 선(shut: 아래로 볼록한 호)과 ^^ 미소 아치(smile: 위로 볼록). 살아 있는 눈(리그)과 정지 눈(staticLids)이 같은 모양을 쓴다 —
// 감은 선만 살짝 다르다(정지 눈은 조금 위·얌전하게). 얼굴 잉크(faceInk)로 — 도깨비처럼 머리가 먹빛이면 검정 아치는 머리에 묻혀 안 보인다
const LID_STYLE = {
  rig: { shutY: 0.1, shutWobble: 0.5, shutWidth: 0.012 },
  static: { shutY: 0.15, shutWobble: 0.4, shutWidth: 0.011 }
};
function lidSketches(eye, ink, noise, style) {
  const s = LID_STYLE[style];
  const shut = new Sketch(noise, s.shutWobble);
  shut.stroke(arcPath(0, eye.r * s.shutY, eye.r * 0.85, eye.r * 0.55, Math.PI * 1.1, Math.PI * 1.9, 10), { color: ink, width: s.shutWidth });
  const smile = new Sketch(noise, 0.5);
  smile.stroke(arcPath(0, -eye.r * 0.12, eye.r * 0.92, eye.r * 0.72, Math.PI * 0.12, Math.PI * 0.88, 10), { color: ink, width: 0.013 });
  // 화남 — 사나운 눈(안쪽이 내려간 빗금 눈꺼풀 + 노려보는 점). 화내는 동안 뜬 눈을 끄고 이게 대신 선다 (character/draw/face.js angryEyeSketch)
  const angry = new Sketch(noise, 0.5);
  angryEyeSketch(angry, eye, ink);
  return { shut, smile, angry };
}

export function buildCreature(spec, noise, birth = 0) {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const headGroup = new THREE.Group();
  const faceGroup = new THREE.Group();    // 이목구비 — 얼굴 돌림의 이동·눌림 (깊이 1)
  group.add(bodyGroup);
  group.add(headGroup);
  headGroup.add(faceGroup);
  // 머리에 붙는 층(귀·뿔·머리카락·모자)은 층마다 제 그룹 — 깊이(DEPTH)만큼 밀린다. 그룹은 뜻이 아니라 깊이로 움직인다 (animate: item.parallax)
  const parallax = [];
  const depthGroup = (depth) => {
    const g = new THREE.Group();
    headGroup.add(g);
    parallax.push({ group: g, depth });
    return g;
  };

  // 보일 — 지터 위상만 다른 3벌. 층마다 프레임(그룹) 3개를 같은 인덱스로 토글한다 (animate가 frames를 돈다).
  // 층 하나 = 메시 하나: 채색 스케치와 잉크 스케치를 한 지오메트리로 잇는다(채색이 밑, 잉크가 위 — draw call 절반). 채색은 전부 **불투명** —
  // 이웃과 겹칠 때 앞 개체가 뒤 개체를 윤곽·색·형태까지 완전히 가려야 한다.
  // 예외는 얼굴(face)·정지 눈(staticEyeBack/Front — 눈마다 한 층): 채색(2.3)과 잉크(2.4)를 따로 둔다 — 정지 눈의 채움(동공·흰자)이
  // 얼굴 잉크(수염) **밑**에, 정지 눈의 잉크가 그 위에 와야 해서 두 층의 채색·잉크가 서로 엇갈린다.
  // 정지 눈이 눈마다 한 층인 건 윙크 때문이다 — 한쪽 눈만 아치로 바꾸려면 그 눈의 층만 꺼야 한다 (animate).
  // 렌더 순서(guidelines/rig.md가 단일 소스): 몸 1.5 → 뒷머리 1.55 → 옆귀 1.7 → 머리 2(채색이 몸 잉크를 덮는다) → 뿔 2.06 → 두피 위 머리카락 2.06 →
  // 개/고양이 귀 2.12 → 모자 2.16 → 얼굴·정지 눈 2.3/2.4 → 얼굴 맨 앞(코·안경) 6.5 → 앞머리 6.55
  const firstDrawn = drawCreature(spec, 0);
  const neckY = firstDrawn.neckY;
  const faceCy = firstDrawn.faceCy;
  // 머리 층은 group 대신 depth — 아래에서 층마다 깊이 그룹을 만든다 (몸은 bodyGroup, 윤곽은 headGroup, 이목구비는 faceGroup)
  const LAYERS = [
    { key: "body", group: bodyGroup, dy: 0, order: 1.5 },
    { key: "hairBack", depth: DEPTH.hairBack, dy: -neckY, order: 1.55 },     // 뒷머리 — 머리·귀 뒤, 몸 위
    { key: "crownBack", depth: DEPTH.ears, dy: -neckY, order: 1.7 },         // 옆귀 — 머리 채색 뒤
    { key: "head", group: headGroup, dy: -neckY, order: 2 },
    { key: "horns", depth: DEPTH.horns, dy: -neckY, order: 2.06 },           // 뿔 — 머리 잉크 위
    { key: "hairCrown", depth: DEPTH.hairCrown, dy: -neckY, order: 2.06 },   // 두피 위 머리카락 — 뿔과 같은 자리·뿔 위
    { key: "front", depth: DEPTH.ears, dy: -neckY, order: 2.12 },            // 머리 앞: 개·고양이 귀
    { key: "hat", depth: DEPTH.hat, dy: -neckY, order: 2.16 },               // 모자 — 귀 위, 얼굴 아래
    { key: "face", group: faceGroup, dy: -faceCy, fillOrder: 2.3, order: 2.4 },        // 채색·잉크 따로 (위 설명)
    // 정지 눈 — 눈마다 한 층(작은 눈 Back → 큰 눈 Front, 겹치면 큰 눈이 앞). 잠·^^·윙크(그쪽)·놀람 변형 때 그 눈의 층을 끈다
    ...STATIC_EYE_KEYS.map((key) => ({ key, group: faceGroup, dy: -faceCy, fillOrder: 2.3, order: 2.4 })),
    { key: "faceFront", group: faceGroup, dy: -faceCy, order: 6.5 },   // 코·안경 — 눈 리그(3~)보다 위. 놀란 흰자·눈꺼풀이 못 덮는다
    { key: "hairFront", depth: DEPTH.hairFront, dy: -neckY, order: 6.55 }    // 앞머리 — 코·안경 위, 눈썹·입(6.6) 아래
  ];
  for (const layer of LAYERS) if (layer.group === undefined) layer.group = depthGroup(layer.depth);
  const frames = {};
  for (const layer of LAYERS) frames[layer.key] = [];
  for (let k = 0; k < BOIL_FRAMES; k += 1) {
    const drawn = k === 0 ? firstDrawn : drawCreature(spec, k);
    for (const layer of LAYERS) {
      const pair = drawn[layer.key];
      const frame = new THREE.Group();
      if (layer.fillOrder !== undefined) {
        if (!pair.fills.empty) frame.add(sketchMesh(pair.fills, 1, layer.fillOrder, layer.dy));
        if (!pair.ink.empty) frame.add(sketchMesh(pair.ink, 1, layer.order, layer.dy));
      } else if (!pair.fills.empty || !pair.ink.empty) {
        frame.add(sketchMesh([pair.fills, pair.ink], 1, layer.order, layer.dy));
      }
      frame.visible = k === 0;
      layer.group.add(frame);
      frames[layer.key].push(frame);
    }
  }
  headGroup.position.y = neckY;
  // 얼굴 그룹 원점 = 머리 중심. 돌림이 여기를 축으로 밀고 누른다. 자식은 -faceCy로 미리 내려 굽는다.
  faceGroup.position.y = faceCy - neckY;

  // 꼬리 — 네 마디 체인 (limbs.js TAIL_BONES). tailGroup(뿌리 피벗) 안에 마디 그룹이 관절마다 겹겹이 들어간다: bone[i]는 bone[i-1]의 자식,
  // 원점은 관절(쉼 자세 척추 위). 몸통·머리 **뒤**(0.8) — 몸에 걸치는 부분(고리·말림)은 가려진다.
  // animate: bone[0]에 tailAngle(스위시·wag·걷기·잠), 끝 마디에 tailTip(톡톡·떨림·팔로스루), 세움(tailRaise)은 관절마다 쉼→곧게 목표각을 섞는다.
  // 곤두섬(tailPuff)은 **굵기만** — 마디 메시를 R(θ)·S(1,p)·R(−θ) 세 그룹(along·thick·back)으로 감싸 쉼 자세 척추 방향(θ)에 수직으로만 스케일한다.
  // 관절(g)의 회전·자식 마디는 그 밖에 있어 길이·자리는 그대로다
  let tailGroup = null;
  const tailBones = [];
  const tail = tailSketch(spec);
  if (tail.sketches.some((s) => !s.empty)) {
    tailGroup = new THREE.Group();
    tailGroup.position.set(tail.pivot[0], tail.pivot[1], 0);
    let parent = tailGroup;
    let prev = [0, 0];
    tail.bones.forEach((bone, i) => {
      const g = new THREE.Group();
      g.position.set(bone.origin[0] - prev[0], bone.origin[1] - prev[1], 0);
      let thick = null;
      if (!tail.sketches[i].empty) {
        const along = new THREE.Group();
        along.rotation.z = bone.angle;
        thick = new THREE.Group();
        const back = new THREE.Group();
        back.rotation.z = -bone.angle;
        back.add(sketchMesh(tail.sketches[i], 1, 0.8));
        thick.add(back);
        along.add(thick);
        g.add(along);
      }
      parent.add(g);
      tailBones.push({ group: g, restAngle: bone.angle, thick });
      parent = g;
      prev = bone.origin;
    });
    bodyGroup.add(tailGroup);
  }

  // 팔다리 — 관절 피벗 그룹. rotation.z로 흔든다.
  // 팔은 front(몸 잉크 위, 2.5)와 back(몸 뒤, 0.5) 두 메시를 갖고 자세에 따라
  // 전환한다. 소매·손이 몸 윤곽을 덮어야 관절이 몸에 박혀 보인다.
  // 팔은 두 관절이다: pivot(어깨) ─ front(위팔) ─ elbow(팔꿈치 피벗) ─ lower(아래팔).
  // 어깨각과 팔꿈치각을 따로 줘야 팔이 접힌다.
  const limbs = limbSketches(spec).map((limb) => {
    const pivot = new THREE.Group();
    pivot.position.set(limb.pivot[0], limb.pivot[1], 0);
    const front = new THREE.Group();
    front.add(sketchMesh(limb.sketch, 1, 2.5));
    pivot.add(front);

    let elbow = null;
    if (limb.lowerSketch) {
      elbow = new THREE.Group();
      elbow.position.set(limb.elbow[0], limb.elbow[1], 0);
      elbow.add(sketchMesh(limb.lowerSketch, 1, 2.5));
      front.add(elbow);
    }

    let back = null;
    if (limb.backSketch) {
      back = sketchMesh(limb.backSketch, 1, 0.5);
      back.visible = false;
      pivot.add(back);
    }
    bodyGroup.add(pivot);

    // 바인드 포즈(T)로 세운다. 행위는 clock이 준다.
    const bind = limb.kind === "arm" ? bindArm(limb.side) : { shoulder: 0, elbow: 0 };
    pivot.rotation.z = bind.shoulder;
    if (elbow) elbow.rotation.z = bind.elbow;
    return {
      pivot, front, elbow, back,
      kind: limb.kind, side: limb.side, index: limb.index ?? 0,
      angle: bind.shoulder, elbowAngle: bind.elbow
    };
  });

  // 눈썹·입 상태 벌(눈썹 쉼·대체·화남 / 입 쉼·대체·화남·^^ — faceStates.js) — faceGroup 안에서 얼굴 돌림을 따라간다.
  // 벌마다 메시 하나, 같은 종류가 두 벌에 있으면 메시를 나눠 쓴다(animate가 켤 메시를 하나 고르고 나머지를 끈다)
  const kinds = facePartKinds(spec);
  const faceStates = {};
  for (const part of ["brow", "mouth"]) {
    const byKind = new Map();
    faceStates[part] = kinds[part].map((kind, index) => {
      if (!byKind.has(kind)) {
        // 눈썹·입은 눈 리그(3~6)보다 위(6.6) — 감긴 눈꺼풀이 눈썹을, 놀라 커진 외눈 흰자가 입을 지우지 않는다
        const mesh = sketchMesh(facePartSketch(spec, part, kind), 1, 6.6, -faceCy);
        mesh.visible = index === 0;
        faceGroup.add(mesh);
        byKind.set(kind, mesh);
      }
      return byKind.get(kind);
    });
  }

  const faceInk = spec.faceInk || spec.palette.ink;
  // 눈 리그 — 흰자+테(한 메시)·동공·스마일·감은 선을 그룹으로 묶는다. 종류: ring/wide/cyclops(둥근 흰자) · oval(세로 타원 흰자)
  const eyeRigs = [];
  const shape = eyeShape(spec);
  // 눈마다 순서 블록 — 큰 눈이 앞. 두 눈이 겹치면 앞눈의 흰자가 뒷눈의 테·동공을 가린다 (교차선이 안 생긴다).
  // 뒷눈 3.0~3.35, 앞눈 3.5~3.85 (흰자·테 / 동공 / ^^·감은 선). 정지 눈의 감은 선(3.6)은 정지 눈에만 있어 안 부딪힌다
  const eyeOrder = [...firstDrawn.eyes].sort((a, b) => a.r - b.r);
  for (const eye of firstDrawn.eyes) {
    const rig = new THREE.Group();
    rig.position.set(eye.x, eye.y - faceCy, 0);
    const rx = eye.r * shape.sx, ry = eye.r * shape.sy;
    const o = 3 + eyeOrder.indexOf(eye) * 0.5;   // 이 눈의 블록 시작

    // 뜬 눈(흰자·테·동공)은 open 그룹 — 감을 때 **덮지 않고 끈다**. 그 자리에 감은 선·^^ 글리프 중 하나가 대신 선다
    const open = new THREE.Group();
    // 완전한 원이 아니라 살짝 찌그러진 손그림 원 — 노이즈를 준다 (눈마다 위상 다르게). 흰자와 테는 한 메시(채움 밑, 테 위)
    const wob = { lumps: 3, amount: 0.06, noise, phase: eye.side * 3.7 + spec.seed * 0.001 };
    const white = new Sketch(noise, 0.4);
    white.fill(blobPath(0, 0, rx, ry, wob), "#f6f2e9");
    const rim = new Sketch(noise, 0.6);
    rim.outline(blobPath(0, 0, rx, ry, { ...wob, lumps: 4, amount: 0.07 }), { color: spec.palette.ink, width: 0.011, passes: 2 });
    open.add(sketchMesh([white, rim], 1, o));

    const pupilSketch = new Sketch(noise, 0.4);
    pupilSketch.fill(blobPath(0, 0, eye.r * 0.44, eye.r * 0.44, { lumps: 3, amount: 0.12, noise: null }), spec.palette.ink);
    const pupil = sketchMesh(pupilSketch, 0.95, o + 0.2);
    open.add(pupil);
    rig.add(open);

    // ^^(smile) — 행복하게 감은 눈 · 감은 눈 선(shut) — 눈꺼풀이 다 내려왔을 때(깜빡임 꼭대기·잠). 뜬 눈을 끄고 이 아치가 대신 선다 — 감은 눈이 빈 얼굴이 되지 않게
    const lids = lidSketches(eye, faceInk, noise, "rig");
    const smile = sketchMesh(lids.smile, 1, o + 0.35);
    smile.visible = false;
    rig.add(smile);
    const shut = sketchMesh(lids.shut, 1, o + 0.35);
    shut.visible = false;
    rig.add(shut);
    const angry = sketchMesh(lids.angry, 1, o + 0.35);
    angry.visible = false;
    rig.add(angry);

    faceGroup.add(rig);
    // gazeScale: 시선에 동공이 움직이는 폭(눈 반지름 배). 구슬눈은 동공이 곧 눈이라 조금만
    eyeRigs.push({ rig, open, pupil, smile, shut, angry, eye, gazeScale: 0.34 });
  }

  // 안대에 가리지 않은 눈 전부 (정지 눈 포함) — 정지 눈의 감은 눈·놀람 변형 글리프를 눈 자리에 굽는다
  const allEyes = eyeGeometry(spec, layout(spec)).filter((eye) => !patched(spec, eye));

  // 정지 눈(dot·sleepy·cross·spiral·slit·half…)의 감은 눈 — 잠(감은 눈 선)·^^·윙크(미소 아치). 덮개는 없다: 그때는 **그 눈의** 정지 눈
  // 층(frames)을 끄고(animate) 아치가 대신 선다 — 눈마다 층이 따로라 윙크한 쪽만 바뀌고 반대쪽 눈은 남는다. 살아 있는 눈의 open/shut/smile과 짝이다
  const staticLids = [];
  for (const { key, eye } of firstDrawn.staticEyes) {
    const lids = lidSketches(eye, faceInk, noise, "static");
    const shut = sketchMesh(lids.shut, 1, 3.6);
    const smile = sketchMesh(lids.smile, 1, 3.6);
    const angry = sketchMesh(lids.angry, 1, 3.6);
    for (const m of [shut, smile, angry]) {
      m.position.set(eye.x, eye.y - faceCy, 0);
      m.visible = false;
      faceGroup.add(m);
    }
    staticLids.push({ shut, smile, angry, eye, frames: frames[key] });
  }

  // 놀람의 눈 변형 — ☆_☆ / ♥_♥. 덮지 않는다: 그동안 눈(정지 눈 프레임·눈 리그)을 **끄고** 그 자리에 글리프만 그린다 (6.32 — 코·안경 아래).
  // 놀람이 star/heart 변형일 때만 보인다 (animate: state.eyeFx). 눈마다 둘 다 굽어 두고 종류에 맞는 것만 켠다
  const eyeFx = [];
  for (const eye of allEyes) {
    const starSketch = new Sketch(noise, 0.5);
    const star = starPath(0, 0, eye.r * 1.1);
    starSketch.fill(star, "#f6f2e9");
    starSketch.outline(star, { color: spec.palette.ink, width: 0.01, step: 0.006 });
    const heartSketch = new Sketch(noise, 0.5);
    const heart = heartPath(0, 0, eye.r * 1.0, eye.r * 0.85);
    heartSketch.fill(heart, "#c9666a");
    heartSketch.outline(heart, { color: spec.palette.ink, width: 0.01, step: 0.006 });
    const starMesh = sketchMesh(starSketch, 1, 6.32);
    const heartMesh = sketchMesh(heartSketch, 1, 6.32);
    for (const m of [starMesh, heartMesh]) {
      m.position.set(eye.x, eye.y - faceCy, 0);
      m.visible = false;
      faceGroup.add(m);
    }
    eyeFx.push({ star: starMesh, heart: heartMesh, eye });
  }

  return {
    group,
    eyeFx,
    bodyGroup,
    headGroup,
    faceGroup,
    parallax,   // [{ group, depth }] — 머리에 붙는 층들. animate가 깊이 × 이목구비 이동량으로 민다
    tailGroup,
    tailBones,
    limbs,
    frames,
    eyeRigs,
    staticLids,
    faceStates,
    // 시계는 팔 리그 서술을 받는다 — 행위(손 목표)를 이 개체의 어깨·팔 길이·몸 앵커에 IK로 푼다
    clock: makeClock(spec.seed, birth, spec.species, motionRig(spec)),
    spec,
    neckY,
    faceCy,
    headRx: firstDrawn.box.headRx,
    headRy: firstDrawn.box.headRy,
    headTop: firstDrawn.headTop,
    // 보일 주기. 개체별로 살짝 다르게 (약 0.53~0.67fps — 1.5~1.9초에 한 번). 빠르면 그림이 떨려 보인다
    boilFps: (8 + (spec.seed % 5) * 0.5) / 15,
    boilOffset: spec.seed % BOIL_FRAMES,
    baseX: 0,
    baseY: 0,
    generation: 0,
    // 이모지는 머리에 붙이지 않는다 — 씬 루트의 emojiRoot에 두고 머리 위 지점을 이징으로 따라간다(끌려오는 느낌)
    emojiRoot: new THREE.Group(),
    emojiMesh: null,
    emojiKind: null,
    emojiPos: null
  };
}
