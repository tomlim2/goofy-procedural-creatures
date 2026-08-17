// 개체 리그 조립. 계층·원점·renderOrder는 guidelines/rig.md.

import * as THREE from "three";
import { drawCreature, facePartKinds, facePartSketch, limbSketches, motionRig, tailSketch, layout, eyeGeometry, eyePop } from "../character/index.js";
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
  const faceGroup = new THREE.Group();
  group.add(bodyGroup);
  group.add(headGroup);
  headGroup.add(earGroup);
  headGroup.add(crownGroup);
  headGroup.add(faceGroup);

  // 보일 — 지터 위상만 다른 3벌. 몸·머리·모자·얼굴을 같은 인덱스로 토글한다 (animate가 frames를 돈다).
  // 렌더 순서(guidelines/rig.md가 단일 소스): 몸 채색 1 → 몸 잉크 1.5 → 머리 채색 1.8(불투명 — 몸통 윤곽선이 머리에
  // 안 비치게) → 머리 잉크 2 → 머리 앞 2.1/2.2(개·고양이 귀·모자 — 윤곽·머리카락·뿔 밑동을 덮되 눈은 못 덮는다) → 얼굴 2.3/2.4(통째로 밀린다).
  const firstDrawn = drawCreature(spec, 0);
  const neckY = firstDrawn.neckY;
  const faceCy = firstDrawn.faceCy;
  const LAYERS = [
    { key: "body", group: bodyGroup, dy: 0, fillOrder: 1, inkOrder: 1.5, fillOpacity: 0.92 },
    { key: "crownBack", group: earGroup, dy: -neckY, fillOrder: 1.6, inkOrder: 1.7, fillOpacity: 1 },   // 옆귀 — 머리 채색 뒤
    { key: "head", group: headGroup, dy: -neckY, fillOrder: 1.8, inkOrder: 2, fillOpacity: 1 },
    { key: "crown", group: crownGroup, dy: -neckY, fillOrder: 2.05, inkOrder: 2.06, fillOpacity: 1 },   // 뿔·머리카락 — 머리 잉크 위
    { key: "front", group: earGroup, dy: -neckY, fillOrder: 2.1, inkOrder: 2.12, fillOpacity: 1 },   // 머리 앞: 개·고양이 귀
    { key: "hat", group: crownGroup, dy: -neckY, fillOrder: 2.14, inkOrder: 2.16, fillOpacity: 1 },   // 모자 — 귀 위, 얼굴 아래
    { key: "face", group: faceGroup, dy: -faceCy, fillOrder: 2.3, inkOrder: 2.4, fillOpacity: 0.92 },
    // 얼굴 맨 앞: 코·안경 — 눈 리그(3~6)보다 위. 놀라 커진 흰자·눈꺼풀이 못 덮는다
    { key: "faceFront", group: faceGroup, dy: -faceCy, fillOrder: 6.4, inkOrder: 6.5, fillOpacity: 0.92 }
  ];
  const frames = { body: [], crownBack: [], head: [], crown: [], front: [], hat: [], face: [], faceFront: [] };
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
  const tail = tailSketch(spec);
  if (!tail.sketch.empty) {
    tailGroup = new THREE.Group();
    tailGroup.position.set(tail.pivot[0], tail.pivot[1], 0);
    tailGroup.add(sketchMesh(tail.sketch, 1, 2));
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

  // 눈 리그 — 흰자·윤곽·동공·눈꺼풀·스마일을 그룹으로 묶는다
  const eyeRigs = [];
  for (const eye of firstDrawn.eyes) {
    const rig = new THREE.Group();
    rig.position.set(eye.x, eye.y - faceCy, 0);

    const white = new Sketch(noise, 0.4);
    white.fill(blobPath(0, 0, eye.r, eye.r, { lumps: 3, amount: 0.08, noise: null }), "#f6f2e9");
    rig.add(sketchMesh(white, 1, 3));

    const rim = new Sketch(noise, 0.6);
    rim.outline(blobPath(0, 0, eye.r, eye.r, { lumps: 4, amount: 0.1, noise: null }), {
      color: spec.palette.ink, width: 0.011, passes: 2
    });
    rig.add(sketchMesh(rim, 1, 4));

    const pupilSketch = new Sketch(noise, 0.4);
    pupilSketch.fill(blobPath(0, 0, eye.r * 0.44, eye.r * 0.44, { lumps: 3, amount: 0.12, noise: null }), spec.palette.ink);
    const pupil = sketchMesh(pupilSketch, 0.95, 5);
    rig.add(pupil);

    const lidSketch = new Sketch(noise, 0.4);
    lidSketch.fill(blobPath(0, -eye.r * 1.15, eye.r * 1.25, eye.r * 1.15, { lumps: 3, amount: 0.1, noise: null }), spec.palette.skin);
    const lid = sketchMesh(lidSketch, 1, 5);
    lid.position.set(0, eye.r * 1.15, 0);
    lid.scale.y = 0;
    rig.add(lid);

    // ^^ — 행복하게 감은 눈. 눈꺼풀을 다 닫고 이 아치를 위에 얹는다.
    // 얼굴 잉크(faceInk)로 — 도깨비처럼 머리가 먹빛이면 검정 아치는 머리에 묻혀 안 보인다
    const smileSketch = new Sketch(noise, 0.5);
    smileSketch.stroke(arcPath(0, -eye.r * 0.12, eye.r * 0.92, eye.r * 0.72, Math.PI * 0.12, Math.PI * 0.88, 10), {
      color: spec.faceInk || spec.palette.ink, width: 0.013
    });
    const smile = sketchMesh(smileSketch, 1, 6);
    smile.visible = false;
    rig.add(smile);

    // 감은 눈 선 — 눈꺼풀이 다 내려왔을 때(깜빡임 꼭대기·잠) 살색 덮개 위에 얹는 아치. 이게 없으면 살아 있는 눈(ring·wide·cyclops)은
    // 감는 순간 얼굴에서 아예 사라진다 — 잠든 개·고양이가 눈 없는 얼굴이 된다 (정지 눈의 잠 눈꺼풀 아치와 같은 역할)
    const shutSketch = new Sketch(noise, 0.5);
    shutSketch.stroke(arcPath(0, eye.r * 0.1, eye.r * 0.85, eye.r * 0.55, Math.PI * 1.1, Math.PI * 1.9, 10), {
      color: spec.faceInk || spec.palette.ink, width: 0.012
    });
    const shut = sketchMesh(shutSketch, 1, 6);
    shut.visible = false;
    rig.add(shut);

    faceGroup.add(rig);
    eyeRigs.push({ rig, pupil, lid, smile, shut, eye });
  }

  // 잠 눈꺼풀 — 정지 눈(dot·cross·slit…)은 얼굴 잉크에 구워져 있어 감을 수 없다. 잘 때 그 위에 덮는 살색 덮개 + 감은 선.
  // 살아 있는 눈은 자기 눈꺼풀(lid)이 있어 필요 없다
  // 정지 눈(dot·sleepy·cross·spiral·slit·half)의 덮개 — 잠(감은 눈 선)과 ^^·윙크(미소 아치)를 위해 살색 덮개 + 아치 둘.
  // 살아 있는 눈의 lid·shut·smile과 짝이다: 정지 눈도 자면 감고, 행복하면 ^^로 웃는다
  const staticLids = [];
  for (const eye of eyeGeometry(spec, layout(spec))) {
    if (eye.side === spec.parts.patchSide) continue;
    if (firstDrawn.eyes.some((e) => e.side === eye.side)) continue;
    const ink0 = spec.faceInk || spec.palette.ink;
    const coverSketch = new Sketch(noise, 0.4);
    coverSketch.fill(blobPath(0, 0, eye.r * 1.2, eye.r * 1.1, { lumps: 3, amount: 0.1, noise: null }), spec.palette.skin);
    const shutSketch = new Sketch(noise, 0.4);
    shutSketch.stroke(arcPath(0, eye.r * 0.15, eye.r * 0.85, eye.r * 0.55, Math.PI * 1.1, Math.PI * 1.9, 10), { color: ink0, width: 0.011 });
    const smileSketch = new Sketch(noise, 0.5);
    smileSketch.stroke(arcPath(0, -eye.r * 0.12, eye.r * 0.92, eye.r * 0.72, Math.PI * 0.12, Math.PI * 0.88, 10), { color: ink0, width: 0.013 });
    const cover = sketchMesh(coverSketch, 1, 3.5);
    const shut = sketchMesh(shutSketch, 1, 3.6);
    const smile = sketchMesh(smileSketch, 1, 3.6);
    for (const m of [cover, shut, smile]) {
      m.position.set(eye.x, eye.y - faceCy, 0);
      m.visible = false;
      faceGroup.add(m);
    }
    staticLids.push({ cover, shut, smile, eye });
  }

  return {
    group,
    bodyGroup,
    headGroup,
    earGroup,
    crownGroup,
    faceGroup,
    tailGroup,
    limbs,
    frames,
    eyeRigs,
    // 놀람 때 눈 리그가 커지는 배율의 감쇠. 왕눈(wide·cyclops)은 이미 커서 1.65배로 뻥 튀기면 코·볼·입까지 덮는다 — 절반만
    eyePop: eyePop(spec),
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
