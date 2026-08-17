// 개체 리그 조립. 계층·원점·renderOrder는 guidelines/rig.md.

import * as THREE from "three";
import { drawCreature, facePartKinds, facePartSketch, limbSketches, motionRig, tailSketch, layout, eyeGeometry, eyeShape, patched, starPath, heartPath } from "../character/index.js";
import { blobPath, arcPath, Sketch } from "../stroke.js";
import { makeClock, bindArm } from "../motion/index.js";
import { sketchMesh } from "./material.js";

export const BOIL_FRAMES = 3;

export function buildCreature(spec, noise, birth = 0) {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const headGroup = new THREE.Group();
  const earGroup = new THREE.Group();     // 귀(옆귀·개/고양이 귀) — 얼굴 돌림 때 얼굴과 **반대로** 밀린다
  const crownGroup = new THREE.Group();   // 뿔·머리카락·모자 — 얼굴 돌림 때 얼굴과 같은 방향으로 덜 밀린다
  const bangsGroup = new THREE.Group();   // 앞머리 — 얼굴 위에 그리지만 얼굴 돌림엔 **아주 조금만** 따라간다 (머리에 붙은 것)
  const faceGroup = new THREE.Group();
  group.add(bodyGroup);
  group.add(headGroup);
  headGroup.add(earGroup);
  headGroup.add(crownGroup);
  headGroup.add(bangsGroup);
  headGroup.add(faceGroup);

  // 보일 — 지터 위상만 다른 3벌. 몸·머리·모자·얼굴을 같은 인덱스로 토글한다 (animate가 frames를 돈다).
  // 렌더 순서(guidelines/rig.md가 단일 소스): 몸 채색 1 → 몸 잉크 1.5 → 머리 채색 1.8(불투명 — 몸통 윤곽선이 머리에
  // 안 비치게) → 머리 잉크 2 → 머리 앞 2.1/2.2(개·고양이 귀·모자 — 윤곽·머리카락·뿔 밑동을 덮되 눈은 못 덮는다) → 얼굴 2.3/2.4(통째로 밀린다).
  const firstDrawn = drawCreature(spec, 0);
  const neckY = firstDrawn.neckY;
  const faceCy = firstDrawn.faceCy;
  const LAYERS = [
    // 채색은 전부 **불투명** — 이웃과 겹칠 때 앞 개체가 뒤 개체를 윤곽·색·형태까지 완전히 가려야 한다 (반투명이면 뒤 윤곽이 비친다)
    { key: "body", group: bodyGroup, dy: 0, fillOrder: 1, inkOrder: 1.5, fillOpacity: 1 },
    { key: "hairBack", group: earGroup, dy: -neckY, fillOrder: 1.53, inkOrder: 1.55, fillOpacity: 1 },   // 뒷머리 — 머리·귀 뒤, 몸 위
    { key: "crownBack", group: earGroup, dy: -neckY, fillOrder: 1.6, inkOrder: 1.7, fillOpacity: 1 },   // 옆귀 — 머리 채색 뒤
    { key: "head", group: headGroup, dy: -neckY, fillOrder: 1.8, inkOrder: 2, fillOpacity: 1 },
    { key: "crown", group: crownGroup, dy: -neckY, fillOrder: 2.05, inkOrder: 2.06, fillOpacity: 1 },   // 뿔·머리카락 — 머리 잉크 위
    { key: "front", group: earGroup, dy: -neckY, fillOrder: 2.1, inkOrder: 2.12, fillOpacity: 1 },   // 머리 앞: 개·고양이 귀
    { key: "hat", group: crownGroup, dy: -neckY, fillOrder: 2.14, inkOrder: 2.16, fillOpacity: 1 },   // 모자 — 귀 위, 얼굴 아래
    { key: "face", group: faceGroup, dy: -faceCy, fillOrder: 2.3, inkOrder: 2.4, fillOpacity: 1 },
    { key: "staticEyes", group: faceGroup, dy: -faceCy, fillOrder: 2.3, inkOrder: 2.4, fillOpacity: 1 },   // 정지 눈 — 놀람 변형 때 끈다
    // 얼굴 맨 앞: 코·안경 — 눈 리그(3~6)보다 위. 놀라 커진 흰자·눈꺼풀이 못 덮는다
    { key: "faceFront", group: faceGroup, dy: -faceCy, fillOrder: 6.4, inkOrder: 6.5, fillOpacity: 1 },
    // 앞머리 — 얼굴 위(코·안경 위), 눈썹·입(6.6) 아래. 머리 그룹(bangsGroup)이라 얼굴 돌림엔 아주 조금만 밀린다
    { key: "hairFront", group: bangsGroup, dy: -neckY, fillOrder: 6.53, inkOrder: 6.55, fillOpacity: 1 }
  ];
  const frames = { body: [], hairBack: [], crownBack: [], head: [], crown: [], front: [], hat: [], face: [], staticEyes: [], faceFront: [], hairFront: [] };
  for (let k = 0; k < BOIL_FRAMES; k += 1) {
    const drawn = k === 0 ? firstDrawn : drawCreature(spec, k);
    for (const layer of LAYERS) {
      const pair = drawn[layer.key];
      const frame = new THREE.Group();
      if (!pair.fills.empty) frame.add(sketchMesh(pair.fills, layer.fillOpacity, layer.fillOrder, layer.dy));
      if (!pair.ink.empty) frame.add(sketchMesh(pair.ink, 1, layer.inkOrder, layer.dy));
      frame.visible = k === 0;
      layer.group.add(frame);
      frames[layer.key].push(frame);
    }
  }
  headGroup.position.y = neckY;
  // 얼굴 그룹 원점 = 머리 중심. 돌림이 여기를 축으로 밀고 누른다. 자식은 -faceCy로 미리 내려 굽는다.
  faceGroup.position.y = faceCy - neckY;

  // 꼬리 — 피벗에 걸어 살랑거린다 (네발)
  let tailGroup = null;
  // 꼬리 — 뿌리 마디(tailGroup, 꼬리 뿌리 피벗) + 끝 마디(tailTipGroup, 척추 55% 지점 피벗). 둘 다 몸통·머리 **뒤**(0.8) —
  // 몸에 걸치는 부분(고리·말림)은 가려진다. state.tailAngle이 뿌리, state.tailTip이 끝(뿌리 기준 상대각)
  let tailTipGroup = null;
  const tail = tailSketch(spec);
  if (!tail.sketch.empty || !tail.tipSketch.empty) {
    tailGroup = new THREE.Group();
    tailGroup.position.set(tail.pivot[0], tail.pivot[1], 0);
    if (!tail.sketch.empty) tailGroup.add(sketchMesh(tail.sketch, 1, 0.8));
    tailTipGroup = new THREE.Group();
    tailTipGroup.position.set(tail.tipPivot[0], tail.tipPivot[1], 0);
    if (!tail.tipSketch.empty) tailTipGroup.add(sketchMesh(tail.tipSketch, 1, 0.8));
    tailGroup.add(tailTipGroup);
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

  // 눈썹·입 상태 — faceGroup 안에서 얼굴 돌림을 따라간다
  const kinds = facePartKinds(spec);
  const faceStates = {};
  for (const part of ["brow", "mouth"]) {
    faceStates[part] = kinds[part].map((kind, index) => {
      // 눈썹·입은 눈 리그(3~6)보다 위(6.6) — 감긴 눈꺼풀이 눈썹을, 놀라 커진 외눈 흰자가 입을 지우지 않는다
      const mesh = sketchMesh(facePartSketch(spec, part, kind), 1, 6.6, -faceCy);
      mesh.visible = index === 0;
      faceGroup.add(mesh);
      return mesh;
    });
  }

  // 눈 리그 — 흰자·윤곽·동공·스마일·감은 선을 그룹으로 묶는다. 종류: ring/wide/cyclops(둥근 흰자) · oval(세로 타원 흰자)
  const eyeRigs = [];
  const eyeKind = spec.parts.eyes;
  const shape = eyeShape(spec);
  // 눈마다 순서 블록 — 큰 눈이 앞. 두 눈이 겹치면 앞눈의 흰자가 뒷눈의 테·동공을 가린다 (교차선이 안 생긴다).
  // 뒷눈 3.0~3.35, 앞눈 3.5~3.85 (흰자·테·동공/눈꺼풀·^^/감은 선). 정지 눈 덮개(3.5/3.6)는 정지 눈에만 있어 안 부딪힌다
  const eyeOrder = [...firstDrawn.eyes].sort((a, b) => a.r - b.r);
  for (const eye of firstDrawn.eyes) {
    const rig = new THREE.Group();
    rig.position.set(eye.x, eye.y - faceCy, 0);
    const rx = eye.r * shape.sx, ry = eye.r * shape.sy;
    const o = 3 + eyeOrder.indexOf(eye) * 0.5;   // 이 눈의 블록 시작

    {
      const white = new Sketch(noise, 0.4);
      // 완전한 원이 아니라 살짝 찌그러진 손그림 원 — 노이즈를 준다 (눈마다 위상 다르게)
      const wob = { lumps: 3, amount: 0.06, noise, phase: eye.side * 3.7 + spec.seed * 0.001 };
      white.fill(blobPath(0, 0, rx, ry, wob), "#f6f2e9");
      rig.add(sketchMesh(white, 1, o));

      const rim = new Sketch(noise, 0.6);
      rim.outline(blobPath(0, 0, rx, ry, { ...wob, lumps: 4, amount: 0.07 }), {
        color: spec.palette.ink, width: 0.011, passes: 2
      });
      rig.add(sketchMesh(rim, 1, o + 0.1));
    }

    const pupilSketch = new Sketch(noise, 0.4);
    pupilSketch.fill(blobPath(0, 0, eye.r * 0.44, eye.r * 0.44, { lumps: 3, amount: 0.12, noise: null }), spec.palette.ink);
    const pupil = sketchMesh(pupilSketch, 0.95, o + 0.2);
    rig.add(pupil);
    // 뜬 눈(흰자·테·동공)은 open 그룹 — 감을 때 **덮지 않고 끈다**. 그 자리에 반감김·감은 선·^^ 글리프 중 하나가 대신 선다
    const open = new THREE.Group();
    for (const child of [...rig.children]) { rig.remove(child); open.add(child); }
    rig.add(open);

    // ^^ — 행복하게 감은 눈. 뜬 눈을 끄고 이 아치가 대신 선다.
    // 얼굴 잉크(faceInk)로 — 도깨비처럼 머리가 먹빛이면 검정 아치는 머리에 묻혀 안 보인다
    const smileSketch = new Sketch(noise, 0.5);
    smileSketch.stroke(arcPath(0, -eye.r * 0.12, eye.r * 0.92, eye.r * 0.72, Math.PI * 0.12, Math.PI * 0.88, 10), {
      color: spec.faceInk || spec.palette.ink, width: 0.013
    });
    const smile = sketchMesh(smileSketch, 1, o + 0.35);
    smile.visible = false;
    rig.add(smile);

    // 감은 눈 선 — 눈꺼풀이 다 내려왔을 때(깜빡임 꼭대기·잠). 뜬 눈을 끄고 이 아치가 대신 선다 — 감은 눈이 빈 얼굴이 되지 않게
    const shutSketch = new Sketch(noise, 0.5);
    shutSketch.stroke(arcPath(0, eye.r * 0.1, eye.r * 0.85, eye.r * 0.55, Math.PI * 1.1, Math.PI * 1.9, 10), {
      color: spec.faceInk || spec.palette.ink, width: 0.012
    });
    const shut = sketchMesh(shutSketch, 1, o + 0.35);
    shut.visible = false;
    rig.add(shut);

    faceGroup.add(rig);
    // gazeScale: 시선에 동공이 움직이는 폭(눈 반지름 배). 구슬눈은 동공이 곧 눈이라 조금만
    eyeRigs.push({ rig, open, pupil, smile, shut, eye, gazeScale: 0.34 });
  }

  // 정지 눈(dot·sleepy·cross·spiral·slit·half…)의 감은 눈 — 잠(감은 눈 선)·^^·윙크(미소 아치). 덮개는 없다: 그때는 정지 눈 프레임을
  // **끄고**(animate) 아치가 대신 선다. 살아 있는 눈의 open/shut/smile과 짝이다
  const staticLids = [];
  for (const eye of eyeGeometry(spec, layout(spec))) {
    if (patched(spec, eye)) continue;
    if (firstDrawn.eyes.some((e) => e.side === eye.side)) continue;
    const ink0 = spec.faceInk || spec.palette.ink;
    const shutSketch = new Sketch(noise, 0.4);
    shutSketch.stroke(arcPath(0, eye.r * 0.15, eye.r * 0.85, eye.r * 0.55, Math.PI * 1.1, Math.PI * 1.9, 10), { color: ink0, width: 0.011 });
    const smileSketch = new Sketch(noise, 0.5);
    smileSketch.stroke(arcPath(0, -eye.r * 0.12, eye.r * 0.92, eye.r * 0.72, Math.PI * 0.12, Math.PI * 0.88, 10), { color: ink0, width: 0.013 });
    const shut = sketchMesh(shutSketch, 1, 3.6);
    const smile = sketchMesh(smileSketch, 1, 3.6);
    for (const m of [shut, smile]) {
      m.position.set(eye.x, eye.y - faceCy, 0);
      m.visible = false;
      faceGroup.add(m);
    }
    staticLids.push({ shut, smile, eye });
  }

  // 놀람의 눈 변형 — ☆_☆ / ♥_♥. 덮지 않는다: 그동안 눈(정지 눈 프레임·눈 리그)을 **끄고** 그 자리에 글리프만 그린다 (6.32 — 코·안경 아래).
  // 놀람이 star/heart 변형일 때만 보인다 (animate: state.eyeFx). 눈마다 둘 다 굽어 두고 종류에 맞는 것만 켠다
  const eyeFx = [];
  {
    for (const eye of eyeGeometry(spec, layout(spec))) {
      if (patched(spec, eye)) continue;
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
  }

  return {
    group,
    eyeFx,
    bodyGroup,
    headGroup,
    earGroup,
    crownGroup,
    bangsGroup,
    faceGroup,
    tailGroup,
    tailTipGroup,
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
