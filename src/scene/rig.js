// 개체 리그 조립. 계층·원점·renderOrder는 guidelines/rig.md.

import * as THREE from "three";
import { drawCreature, facePartKinds, facePartSketch, limbSketches, armPoseAngle, tailSketch } from "../draw/index.js";
import { blobPath, arcPath, Sketch } from "../stroke.js";
import { makeClock } from "../motion/index.js";
import { sketchMesh } from "./material.js";

export const BOIL_FRAMES = 3;

export function buildCreature(spec, noise, birth = 0) {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const headGroup = new THREE.Group();
  const faceGroup = new THREE.Group();
  group.add(bodyGroup);
  group.add(headGroup);
  headGroup.add(faceGroup);

  // 보일 — 지터 위상만 다른 3벌. 몸·머리를 같은 인덱스로 토글한다.
  const bodyFrames = [];
  const headFrames = [];
  let firstDrawn = null;
  for (let k = 0; k < BOIL_FRAMES; k += 1) {
    const drawn = drawCreature(spec, k);
    if (!firstDrawn) firstDrawn = drawn;

    const bodyFrame = new THREE.Group();
    if (!drawn.body.fills.empty) bodyFrame.add(sketchMesh(drawn.body.fills, 0.92, 1));
    bodyFrame.add(sketchMesh(drawn.body.ink, 1, 2));
    bodyFrame.visible = k === 0;
    bodyGroup.add(bodyFrame);
    bodyFrames.push(bodyFrame);

    const headFrame = new THREE.Group();
    if (!drawn.head.fills.empty) headFrame.add(sketchMesh(drawn.head.fills, 0.92, 1, -drawn.neckY));
    headFrame.add(sketchMesh(drawn.head.ink, 1, 2, -drawn.neckY));
    headFrame.visible = k === 0;
    headGroup.add(headFrame);
    headFrames.push(headFrame);
  }
  const neckY = firstDrawn.neckY;
  headGroup.position.y = neckY;

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
  const limbs = limbSketches(spec).map((limb) => {
    const pivot = new THREE.Group();
    pivot.position.set(limb.pivot[0], limb.pivot[1], 0);
    const front = sketchMesh(limb.sketch, 1, 2.5);
    pivot.add(front);
    let back = null;
    if (limb.backSketch) {
      back = sketchMesh(limb.backSketch, 1, 0.5);
      back.visible = false;
      pivot.add(back);
    }
    bodyGroup.add(pivot);
    const rest = limb.kind === "arm" ? armPoseAngle(spec.proportions.armRest, limb.side) : 0;
    pivot.rotation.z = rest;
    return { pivot, front, back, kind: limb.kind, side: limb.side, index: limb.index ?? 0, angle: rest };
  });

  // 눈썹·입 상태 — faceGroup 안에서 요(yaw)를 따라간다
  const kinds = facePartKinds(spec);
  const faceStates = {};
  for (const part of ["brow", "mouth"]) {
    faceStates[part] = kinds[part].map((kind, index) => {
      const mesh = sketchMesh(facePartSketch(spec, part, kind), 1, 3, -neckY);
      mesh.visible = index === 0;
      faceGroup.add(mesh);
      return mesh;
    });
  }

  // 눈 리그 — 흰자·윤곽·동공·눈꺼풀·스마일을 그룹으로 묶는다
  const eyeRigs = [];
  for (const eye of firstDrawn.eyes) {
    const rig = new THREE.Group();
    rig.position.set(eye.x, eye.y - neckY, 0);

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
    const smileSketch = new Sketch(noise, 0.5);
    smileSketch.stroke(arcPath(0, -eye.r * 0.12, eye.r * 0.92, eye.r * 0.72, Math.PI * 0.12, Math.PI * 0.88, 10), {
      color: spec.palette.ink, width: 0.013
    });
    const smile = sketchMesh(smileSketch, 1, 6);
    smile.visible = false;
    rig.add(smile);

    faceGroup.add(rig);
    eyeRigs.push({ rig, pupil, lid, smile, eye });
  }

  return {
    group,
    bodyGroup,
    headGroup,
    faceGroup,
    tailGroup,
    limbs,
    bodyFrames,
    headFrames,
    eyeRigs,
    faceStates,
    clock: makeClock(spec.seed, birth, spec.species, spec.proportions.armRest, spec.parts.armLength === "verylong"),
    spec,
    neckY,
    headRx: firstDrawn.box.headRx,
    headTop: firstDrawn.headTop,
    boilFps: 8 + (spec.seed % 5) * 0.5,
    boilOffset: spec.seed % BOIL_FRAMES,
    baseX: 0,
    baseY: 0,
    generation: 0,
    emoteMesh: null,
    emoteKind: null
  };
}
