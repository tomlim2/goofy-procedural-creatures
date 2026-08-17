// 상태 → 리그 적용. clock이 준 상태 객체를 three.js 그룹에 매 프레임 입힌다.
// 여기는 행위를 모른다 — 팔은 clock이 준 관절각(state.arms)을 이징해 넣을 뿐이다.
// 문서: guidelines/motion/catalog.md § 상태 객체, guidelines/rig.md

import * as THREE from "three";
import { buildEmoji } from "./emoji.js";
import { disposeGroup } from "./material.js";
import { BOIL_FRAMES } from "./rig.js";
import { damp } from "../motion/ease.js";

const EMOJI_TARGET = new THREE.Vector3();
// 얼굴 돌림 때 머리 부속물 그룹이 이목구비 이동량의 몇 배 움직이나 [그룹, x배, y배]. 1이면 얼굴과 같이, 0이면 윤곽과 같이, 음수면 반대로.
// 뿔·머리카락·모자(crownGroup)는 얼굴을 따라 덜, 귀(earGroup)는 **반대로** — 머리가 돌면 귀는 얼굴 반대편으로 돌아 나간다,
// 앞머리(bangsGroup)는 얼굴 위에 있지만 머리에 붙은 것이라 아주 조금만. 크기는 안 바뀐다 — 자리만 밀린다
const PARALLAX = [["crownGroup", 0.45, 0.3], ["earGroup", -0.4, -0.15], ["bangsGroup", 0.12, 0.08]];

// snap: 관절을 이징 없이 목표각으로 즉시 (바인드 뷰). boil: 보일 3벌 순환 여부 (선 질감).
// 둘은 다른 축이다 — 바인드 포즈에서도 선은 끓을 수 있고, 모션 중에도 선을 고정할 수 있다.
export function applyState(item, state, t, noise, { snap = false, boil = true } = {}) {
  // 보일 — 낮은 주기로 잉크 변형을 순환. 꺼져 있으면 0번 프레임에 고정.
  const frame = boil ? Math.floor(t * item.boilFps + item.boilOffset) % BOIL_FRAMES : 0;
  for (const key in item.frames) {
    const list = item.frames[key];
    for (let k = 0; k < BOIL_FRAMES; k += 1) list[k].visible = k === frame;
  }

  // 몸 전체 — 스웨이(발 축 회전), 부르르, 점프, 호흡+락킹+젤리+기지개
  item.group.rotation.z = state.sway;
  // 걷기로 옮긴 자리(walkX) · 네발이 걷는 방향으로 뒤집힘(facing ±1, 0을 지나며 얇아졌다 뒤집힌다)
  item.group.position.x = item.baseX + state.shiverX + (state.walkX || 0);
  item.group.position.y = item.baseY + state.hopY;
  item.group.scale.set(
    (state.facing === undefined ? 1 : state.facing) * (1 + state.breathe * 0.006 + state.squashX + state.stretchX + state.jellyX),
    1 + state.breathe * 0.011 + state.rock + state.squashY + state.jellyY,
    1
  );

  // 머리 — 갸웃·롤·딥·끄덕
  item.headGroup.rotation.z = state.headAngle;
  item.headGroup.position.y = item.neckY + state.headBob;

  // 얼굴 돌림 — 이목구비 그룹(눈·코·입·눈썹·안경·볼·수염·주둥이)을 통째로 밀고 살짝 눌러
  // 머리를 돌린 착시. 좌우는 x로, 위아래는 y로. 원점은 머리 중심이라 눌림도 거기를 축으로 한다.
  const [turnX, turnY] = state.faceTurn;
  const shiftX = turnX * item.headRx * 0.26;
  const shiftY = turnY * item.headRy * 0.16;
  item.faceGroup.position.x = shiftX;
  item.faceGroup.position.y = item.faceCy - item.neckY + shiftY;
  item.faceGroup.scale.set(1 - Math.abs(turnX) * 0.12, 1 - Math.abs(turnY) * 0.08, 1);
  // 머리에 붙는 것은 위치만 밀린다(크기 그대로) — 시차 (PARALLAX)
  for (const [key, kx, ky] of PARALLAX) {
    item[key].position.x = shiftX * kx;
    item[key].position.y = shiftY * ky;
  }

  // 꼬리 — 네 마디 체인. 뿌리 각(tailAngle) + 끝 마디 상대각(tailTip) + 세움(tailRaise: 관절마다 쉼 자세 → 목표 자세로 섞음) + 부풀림
  if (item.tailGroup) {
    const puff = 1 + 0.3 * (state.tailPuff || 0);
    item.tailGroup.scale.set(puff, puff, 1);
    const bones = item.tailBones;
    const n = bones.length;
    const raise = state.tailRaise || 0;
    // 세움 목표 — 마디 방향(세계각). straight: 전부 곧게 위(π/2, 끝은 살짝 뒤로 젖힘). hook: 아래 마디는 위, 끝 두 마디가 앞(머리 쪽)으로 굽는다
    // 뿌리 마디는 살짝 뒤로 젖혀 시작해 꼬리가 몸에서 곧장 위로 서 보이게(엉덩이에서 나온다)
    const targetAngle = (i) => {
      if (state.tailRaiseStyle === "hook") return i >= n - 2 ? Math.PI * 0.5 + (i === n - 1 ? 1.15 : 0.55) : Math.PI * 0.5 - 0.1;
      return Math.PI * 0.5 - 0.12 + (i === n - 1 ? -0.1 : 0);
    };
    let cum = 0;   // 지금까지의 누적 목표 회전(쉼 기준)
    for (let i = 0; i < n; i += 1) {
      const b = bones[i];
      const want = targetAngle(i) - b.restAngle;   // 이 마디가 세계각 목표에 닿으려면 필요한 누적 회전
      const own = want - cum;                        // 부모까지의 회전을 뺀 이 관절의 몫
      cum = want;
      let rot = own * raise;
      if (i === 0) rot += state.tailAngle;
      if (i === n - 1) rot += state.tailTip || 0;
      b.group.rotation.z = rot;
    }
  }

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
    // 임계감쇠 추종(ease in/out) — 지수 lerp는 첫 프레임이 가장 빨라 팔이 "툭" 올라간다
    if (snap) { limb.angle = target; limb.angleV = 0; limb.elbowAngle = elbowTarget; limb.elbowV = 0; }
    else {
      const s = { x: limb.angle, v: limb.angleV || 0 };
      damp(s, target, 0.18);
      limb.angle = s.x; limb.angleV = s.v;
      const e = { x: limb.elbowAngle, v: limb.elbowV || 0 };
      damp(e, elbowTarget, 0.18);
      limb.elbowAngle = e.x; limb.elbowV = e.v;
    }
    limb.pivot.rotation.z = limb.angle + osc;
    if (limb.elbow) limb.elbow.rotation.z = limb.elbowAngle + oscElbow;
  }

  // 눈썹·입 상태
  item.faceStates.brow[0].visible = !state.browAlt;
  item.faceStates.brow[1].visible = state.browAlt;
  item.faceStates.mouth[0].visible = !state.mouthAlt;
  item.faceStates.mouth[1].visible = state.mouthAlt;

  // 정지 눈 — 반쯤 넘게 잠들면 감은 눈 선, ^^·윙크(그쪽)면 미소 아치가 **대신** 선다(덮지 않고 정지 눈 프레임을 끈다).
  const asleep = (state.sleep || 0) > 0.5;
  let staticReplaced = false;
  for (const lid of item.staticLids) {
    const happyEye = state.happy || (state.winkSide !== 0 && lid.eye.side === state.winkSide);
    lid.smile.visible = happyEye;
    lid.shut.visible = asleep && !happyEye;
    if (happyEye || asleep) staticReplaced = true;
  }
  if (staticReplaced) for (const g of item.frames.staticEyes) g.visible = false;

  // 눈 — 놀람·시선·깜빡임·^^·윙크. 놀람은 눈을 키우지 않고 **동공만** 줄인다 (1 → 0.5배).
  // 감는 건 덮는 게 아니라 **바꿔 그리기**: 뜬 눈(open) ↔ 감은 선(눈꺼풀 > 0.5) — 중간(반감김)은 없다. ^^·윙크는 미소 아치가 대신.
  // 깜빡임(0.13초)은 뜬 눈 → 감은 선 → 뜬 눈 두 컷으로 지나간다
  for (const rig of item.eyeRigs) {
    rig.pupil.scale.setScalar(1 - 0.5 * (state.startle || 0));
    rig.pupil.position.x = state.gaze[0] * rig.eye.r * rig.gazeScale;
    rig.pupil.position.y = state.gaze[1] * rig.eye.r * rig.gazeScale * 0.82;
    const winked = state.winkSide !== 0 && rig.eye.side === state.winkSide;
    const smiling = winked || state.happy;
    const lid = state.lid || 0;
    rig.smile.visible = smiling;
    rig.shut.visible = !smiling && lid > 0.5;
    rig.open.visible = !smiling && lid <= 0.5;
  }

  // 놀람의 눈 변형 — ☆_☆ / ♥_♥. 그동안 눈(정지 눈 프레임·눈 리그)은 **끄고** 글리프로 대체한다 (덮지 않는다). 봉투(k)로 팝인/아웃 (0.7 → 1)
  const fx = state.eyeFx;
  const fxOn = !!fx && fx.k > 0.02;
  if (fxOn) for (const g of item.frames.staticEyes) g.visible = false;
  for (const rig of item.eyeRigs) rig.rig.visible = !fxOn;
  for (const e of item.eyeFx) {
    e.star.visible = fxOn && fx.kind === "star";
    e.heart.visible = fxOn && fx.kind === "heart";
    if (fxOn) {
      const s = 0.7 + 0.3 * fx.k;
      e.star.scale.setScalar(s);
      e.heart.scale.setScalar(s);
    }
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
    // 종류별 자리: 대개 정수리 위, 땀은 관자놀이 옆
    if (emoji.kind === "sweat") EMOJI_TARGET.set(item.headRx * 0.95, item.headTop - item.neckY - item.headRy * 0.35, 0);
    else EMOJI_TARGET.set(0.02, item.headTop - item.neckY + 0.15, 0);
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
