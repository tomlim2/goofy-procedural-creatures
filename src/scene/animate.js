// 상태 → 리그 적용. clock이 준 상태 객체를 three.js 그룹에 매 프레임 입힌다.
// 문서: guidelines/motion.md § 상태 객체, guidelines/rig.md

import { armPoseAngle } from "../character/index.js";
import { buildEmote } from "./emote.js";
import { disposeGroup } from "./material.js";
import { BOIL_FRAMES } from "./rig.js";

export function applyState(item, state, t, noise) {
  // 보일 — 낮은 주기로 잉크 변형을 순환
  const frame = Math.floor(t * item.boilFps + item.boilOffset) % BOIL_FRAMES;
  for (let k = 0; k < BOIL_FRAMES; k += 1) {
    item.bodyFrames[k].visible = k === frame;
    item.headFrames[k].visible = k === frame;
  }

  // 몸 전체 — 스웨이(발 축 회전), 부르르, 폴짝, 호흡+락킹+젤리+기지개
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

  // 얼굴 요 — 이목구비가 통째로 밀려 머리를 돌린 착시
  item.faceGroup.position.x = state.faceYaw * item.headRx * 0.22;

  // 꼬리
  if (item.tailGroup) item.tailGroup.rotation.z = state.tailAngle;

  // 팔다리 — 목표 각도로 이징. 관절은 튀지 않고 따라간다.
  // 팔은 자세(clock 상태)가 기준각과 앞/뒤를 정하고, 그 위에 지터·이벤트가 얹힌다.
  for (const limb of item.limbs) {
    let target;
    if (limb.kind === "arm") {
      const behind = state.armPose === "behind";
      target = armPoseAngle(state.armPose, limb.side) + state.armOffset[String(limb.side)];
      if (limb.back) {
        // 뒷짐 전환은 팔이 기준각 근처로 돌아온 뒤에 한다. 회전 중에 바꾸면 튄다.
        const settled = Math.abs(target - limb.angle) < 0.35;
        if (settled) {
          limb.front.visible = !behind;
          limb.back.visible = behind;
        }
      }
    } else {
      target = state.legOffset[limb.index] || 0;
    }
    limb.angle += (target - limb.angle) * 0.12;
    limb.pivot.rotation.z = limb.angle;
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

  // 이모트
  if (state.emote) {
    if (!item.emoteMesh || item.emoteKind !== state.emote.kind) {
      if (item.emoteMesh) {
        disposeGroup(item.emoteMesh);
        item.headGroup.remove(item.emoteMesh);
      }
      item.emoteMesh = buildEmote(state.emote.kind, noise);
      item.emoteKind = state.emote.kind;
      item.headGroup.add(item.emoteMesh);
    }
    const k = state.emote.k;
    const fade = Math.min(1, Math.min(k / 0.15, (1 - k) / 0.2));
    item.emoteMesh.position.set(0.02, item.headTop - item.neckY + 0.15 + Math.sin(k * Math.PI * 3) * 0.015, 0);
    item.emoteMesh.scale.setScalar(0.8 + 0.2 * fade);
    item.emoteMesh.material.opacity = fade * 0.95;
  } else if (item.emoteMesh) {
    disposeGroup(item.emoteMesh);
    item.headGroup.remove(item.emoteMesh);
    item.emoteMesh = null;
    item.emoteKind = null;
  }
}
