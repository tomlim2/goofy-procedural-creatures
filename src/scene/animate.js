// 상태 → 리그 적용. clock이 준 상태 객체를 three.js 그룹에 매 프레임 입힌다.
// 여기는 행위를 모른다 — 팔은 clock이 준 관절각(state.arms)을 이징해 넣을 뿐이다.
// 문서: guidelines/motion/catalog.md § 상태 객체, guidelines/rig.md

import * as THREE from "three";
import { buildEmoji } from "./emoji.js";
import { disposeGroup } from "./material.js";
import { BOIL_FRAMES } from "./rig.js";

const EMOJI_TARGET = new THREE.Vector3();

// snap: 관절을 이징 없이 목표각으로 즉시 (바인드 뷰). boil: 보일 3벌 순환 여부 (선 질감).
// 둘은 다른 축이다 — 바인드 포즈에서도 선은 끓을 수 있고, 모션 중에도 선을 고정할 수 있다.
export function applyState(item, state, t, noise, { snap = false, boil = true } = {}) {
  // 보일 — 낮은 주기로 잉크 변형을 순환. 꺼져 있으면 0번 프레임에 고정.
  const frame = boil ? Math.floor(t * item.boilFps + item.boilOffset) % BOIL_FRAMES : 0;
  for (const list of Object.values(item.frames)) {
    for (let k = 0; k < BOIL_FRAMES; k += 1) list[k].visible = k === frame;
  }

  // 몸 전체 — 스웨이(발 축 회전), 부르르, 점프, 호흡+락킹+젤리+기지개
  item.group.rotation.z = state.sway;
  item.group.position.x = item.baseX + state.shiverX;
  item.group.position.y = item.baseY + state.hopY;
  item.group.scale.set(
    1 + state.breathe * 0.006 + state.squashX + state.stretchX + state.jellyX,
    1 + state.breathe * 0.011 + state.rock + state.squashY + state.jellyY,
    1
  );

  // 머리 — 갸웃·롤·딥·끄덕
  item.headGroup.rotation.z = state.headAngle;
  item.headGroup.position.y = item.neckY + state.headBob;

  // 얼굴 돌림 — 이목구비 그룹(눈·코·입·눈썹·안경·볼·수염·주둥이)을 통째로 밀고 살짝 눌러
  // 머리를 돌린 착시. 좌우는 x로, 위아래는 y로. 원점은 머리 중심이라 눌림도 거기를 축으로 한다.
  const [turnX, turnY] = state.faceTurn;
  item.faceGroup.position.x = turnX * item.headRx * 0.26;
  item.faceGroup.position.y = item.faceCy - item.neckY + turnY * item.headRy * 0.16;
  item.faceGroup.scale.set(1 - Math.abs(turnX) * 0.12, 1 - Math.abs(turnY) * 0.08, 1);

  // 꼬리
  if (item.tailGroup) item.tailGroup.rotation.z = state.tailAngle;

  // 팔다리 — 목표 각도로 이징. 관절은 튀지 않고 따라간다.
  // 팔은 clock이 행위를 IK로 풀어 준 [어깨, 팔꿈치] 세계각. 진동(osc)은 이징을 안 거치고 그대로 얹는다
  // (인사의 손 흔들기·파닥임은 이징을 거치면 뭉개진다).
  for (const limb of item.limbs) {
    let target;
    let elbowTarget = 0;
    let osc = 0;
    let oscElbow = 0;
    if (limb.kind === "arm") {
      const arm = state.arms[String(limb.side)];
      target = arm.shoulder;
      elbowTarget = arm.elbow;
      osc = arm.oscShoulder;
      oscElbow = arm.oscElbow;
      if (limb.back) {
        // 뒷짐 전환은 팔이 목표각 근처로 돌아온 뒤에 한다. 회전 중에 바꾸면 튄다.
        const settled = Math.abs(target - limb.angle) < 0.35;
        if (settled) {
          limb.front.visible = !arm.behind;
          limb.back.visible = arm.behind;
        }
      }
    } else {
      target = state.legOffset[limb.index] || 0;
      osc = state.legOsc ? state.legOsc[limb.index] || 0 : 0;
    }
    const ease = snap ? 1 : 0.12;
    limb.angle += (target - limb.angle) * ease;
    limb.pivot.rotation.z = limb.angle + osc;
    if (limb.elbow) {
      limb.elbowAngle += (elbowTarget - limb.elbowAngle) * ease;
      limb.elbow.rotation.z = limb.elbowAngle + oscElbow;
    }
  }

  // 눈썹·입 상태
  item.faceStates.brow[0].visible = !state.browAlt;
  item.faceStates.brow[1].visible = state.browAlt;
  item.faceStates.mouth[0].visible = !state.mouthAlt;
  item.faceStates.mouth[1].visible = state.mouthAlt;

  // 눈 — 개방도·시선·깜빡임·^^·윙크
  for (const rig of item.eyeRigs) {
    rig.rig.scale.setScalar(state.aperture);
    rig.pupil.position.x = state.gaze[0] * rig.eye.r * 0.34;
    rig.pupil.position.y = state.gaze[1] * rig.eye.r * 0.28;
    const winked = state.winkSide !== 0 && rig.eye.side === state.winkSide;
    const closed = winked || state.happy;
    rig.lid.scale.y = closed ? 1 : state.lid;
    rig.smile.visible = closed;
  }

  // 이모지 애니메이션 — 모션과 별개 층. clock의 이모지 채널이 종류·진행·곡선(dy·scale·rot·opacity)을 준다.
  // 머리에 붙이지 않는다: 씬 루트(emojiRoot)에 두고 머리 위 지점(세계 좌표)을 이징으로 따라간다 —
  // 머리가 갸웃하고 몸이 뛰면 한 박자 늦게 끌려오는 느낌. 끌리는 방향으로 살짝 눕는다.
  const emoji = state.emoji;
  if (emoji) {
    if (!item.emojiMesh || item.emojiKind !== emoji.kind) {
      if (item.emojiMesh) {
        disposeGroup(item.emojiMesh);
        item.emojiRoot.remove(item.emojiMesh);
      }
      item.emojiMesh = buildEmoji(emoji.kind, noise);
      item.emojiKind = emoji.kind;
      item.emojiRoot.add(item.emojiMesh);
    }
    item.headGroup.updateWorldMatrix(true, false);
    EMOJI_TARGET.set(0.02, item.headTop - item.neckY + 0.15, 0);
    item.headGroup.localToWorld(EMOJI_TARGET);
    if (!item.emojiPos) item.emojiPos = EMOJI_TARGET.clone();
    else item.emojiPos.lerp(EMOJI_TARGET, snap ? 1 : 0.1);
    const lagX = EMOJI_TARGET.x - item.emojiPos.x;
    item.emojiMesh.position.set(item.emojiPos.x, item.emojiPos.y + emoji.dy, 0);
    item.emojiMesh.scale.setScalar(emoji.scale);
    item.emojiMesh.rotation.z = emoji.rot - lagX * 6;
    item.emojiMesh.material.opacity = emoji.opacity;
  } else if (item.emojiMesh) {
    disposeGroup(item.emojiMesh);
    item.emojiRoot.remove(item.emojiMesh);
    item.emojiMesh = null;
    item.emojiKind = null;
    item.emojiPos = null;
  }
}
