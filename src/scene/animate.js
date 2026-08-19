// 상태 → 리그 적용. clock이 준 상태 객체를 three.js 그룹에 매 프레임 입힌다.
// 여기는 행위를 모른다 — 팔은 clock이 준 관절각(state.arms)을 이징해 넣을 뿐이다.
// 문서: guidelines/motion/catalog.md § 상태 객체, guidelines/rig.md

import * as THREE from "three";
import { buildEmoji } from "./emoji.js";
import { disposeGroup } from "./material.js";
import { BOIL_FRAMES } from "./rig.js";
import { damp } from "../motion/ease.js";

const EMOJI_TARGET = new THREE.Vector3();

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

  // 몸통 기울기 — 네발 앉기(bodyTilt, 음수 = 뒤가 내려감). 앞다리 뿌리(item.bodyPivot)를 축으로 돈다: 회전만 주면 원점(발바닥 가운데)이 축이 되어
  // 앞발이 뜨므로, 축이 제자리에 남도록 위치를 같이 옮긴다. 머리 그룹은 몸 그룹의 자식이 아니라 그대로다 — 축이 머리 바로 밑이라 머리는 안 움직인다
  const tilt = state.bodyTilt || 0;
  if (item.bodyPivot && tilt !== 0) {
    const [px, py] = item.bodyPivot;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    item.bodyGroup.rotation.z = tilt;
    item.bodyGroup.position.set(px - (px * c - py * s), py - (px * s + py * c), 0);
  } else {
    item.bodyGroup.rotation.z = 0;
    item.bodyGroup.position.set(0, 0, 0);
  }

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
  // 머리에 붙는 층(귀·뿔·머리카락·모자)은 위치만 밀린다(크기 그대로) — fake 3D: 이동량 = 층의 깊이(rig.js DEPTH) × 이목구비 이동량.
  // 앞(양수)은 얼굴 쪽으로, 뒤(음수)는 반대로. 뜻이 아니라 깊이가 정한다
  for (const p of item.parallax) {
    p.group.position.x = shiftX * p.depth;
    p.group.position.y = shiftY * p.depth;
  }

  // 꼬리 — 네 마디 체인. 뿌리 각(tailAngle) + 끝 마디 상대각(tailTip) + 세움(tailRaise: 관절마다 쉼 자세 → 목표 자세로 섞음) + 곤두섬(tailPuff)
  if (item.tailGroup) {
    // 곤두섬 — **굵기만** 1 → 1.6배 (길이는 그대로): 마디마다 쉼 자세 척추 방향에 수직으로 스케일 (rig의 thick 그룹 — R(θ)·S(1,p)·R(−θ)). 눈(동공)과 같은 봉투
    const puff = 1 + 0.6 * (state.tailPuff || 0);
    const bones = item.tailBones;
    const n = bones.length;
    const raise = state.tailRaise || 0;
    // 선 꼬리는 몸·머리 **위**(2.08 — 윤곽·두피 위 머리카락 위, 귀·얼굴 아래)에 그린다. 쉴 때(등 위 고리·말림)는 뒤(0.8, guidelines/rig.md).
    // 고양이 넷 중 하나는 꼬리 뿌리가 큰 머리 실루엣 안에 있어서, 뒤에 둔 채로 세우면 머리에 가려 선 게 안 보인다 (item.orderBase = 개체 블록)
    const front = raise > 0.5;
    if (item.tailFront !== front) {
      item.tailFront = front;
      const order = (item.orderBase || 0) + (front ? 2.08 : 0.8);
      item.tailGroup.traverse((node) => { if (node.isMesh) node.renderOrder = order; });
    }
    // 관절 목표각 두 벌 — 마디 방향(세계각). 세움(tailRaise): **전부 정확히 위(π/2)** — 어떤 골격이든 딱 수직, 굽는 변형 없음.
    // idle 자세(tailArch, 고양이 아치): state.tailPose[i]. 둘 다 골격의 쉼 자세(restAngle)에서 그 세계각까지의 누적 회전을 관절 몫으로 나눠 무게만큼 섞는다
    // (합이 1을 안 넘으니 나머지는 골격 그대로). 그 위에 뿌리 tailAngle·끝 tailTip
    const UP = Math.PI * 0.5;
    const arch = state.tailArch || 0;
    const pose = state.tailPose;
    let cumUp = 0, cumArch = 0;   // 지금까지의 누적 목표 회전(쉼 기준)
    for (let i = 0; i < n; i += 1) {
      const b = bones[i];
      const wantUp = UP - b.restAngle;   // 이 마디가 수직에 닿으려면 필요한 누적 회전
      let rot = (wantUp - cumUp) * raise;   // 부모까지의 회전을 뺀 이 관절의 몫
      cumUp = wantUp;
      if (arch > 0 && pose) {
        const wantArch = pose[Math.min(i, pose.length - 1)] - b.restAngle;
        rot += (wantArch - cumArch) * arch;
        cumArch = wantArch;
      }
      if (i === 0) rot += state.tailAngle;
      if (i === n - 1) rot += state.tailTip || 0;
      b.group.rotation.z = rot;
      if (b.thick) b.thick.scale.y = puff;
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

  // 눈썹·입 상태 벌 — 눈썹: 화남(2) > 대체(1) > 쉼(0). 입: 화남(2) > ^^(3, 개는 혀) > 대체(1) > 쉼(0). 같은 종류는 메시를 나눠 쓰므로 고른 메시만 켠다
  const angryOn = (state.angry || 0) > 0.5;
  const browOn = item.faceStates.brow[angryOn ? 2 : state.browAlt ? 1 : 0];
  const mouthOn = item.faceStates.mouth[angryOn ? 2 : state.happy ? 3 : state.mouthAlt ? 1 : 0];
  for (const m of item.faceStates.brow) m.visible = m === browOn;
  for (const m of item.faceStates.mouth) m.visible = m === mouthOn;

  // 정지 눈 — 눈마다 따로: 반쯤 넘게 잠들면 감은 눈 선, ^^·윙크(그쪽)면 미소 아치, 화나면 사나운 눈이 **대신** 선다(덮지 않고 **그 눈의** 정지 눈 층을 끈다).
  // 윙크는 한쪽만 바뀐다 — 반대쪽 눈의 층은 그대로 켜 둔다 (두 눈을 한 층으로 끄면 반대쪽 눈이 사라진다). 우선순위: 잠 > 화남 > ^^/윙크
  const asleep = (state.sleep || 0) > 0.5;
  for (const lid of item.staticLids) {
    const angryEye = angryOn && !asleep;
    const happyEye = !angryEye && (state.happy || (state.winkSide !== 0 && lid.eye.side === state.winkSide));
    lid.angry.visible = angryEye;
    lid.smile.visible = happyEye;
    lid.shut.visible = asleep && !happyEye;
    if (happyEye || asleep || angryEye) for (const g of lid.frames) g.visible = false;
  }

  // 눈 — 놀람·시선·깜빡임·^^·윙크. 놀람은 눈을 키우지 않고 **동공만** 줄인다 (1 → 0.5배).
  // 감는 건 덮는 게 아니라 **바꿔 그리기**: 뜬 눈(open) ↔ 감은 선(눈꺼풀 > 0.5) — 중간(반감김)은 없다. ^^·윙크는 미소 아치가 대신.
  // 깜빡임(0.13초)은 뜬 눈 → 감은 선 → 뜬 눈 두 컷으로 지나간다
  for (const rig of item.eyeRigs) {
    rig.pupil.scale.setScalar(1 - 0.5 * (state.startle || 0));
    rig.pupil.position.x = state.gaze[0] * rig.eye.r * rig.gazeScale;
    rig.pupil.position.y = state.gaze[1] * rig.eye.r * rig.gazeScale * 0.82;
    const winked = state.winkSide !== 0 && rig.eye.side === state.winkSide;
    const angryEye = angryOn && !asleep;   // 화남 — 사나운 눈으로 바꿔 그린다 (잠보다 아래, ^^/윙크보다 위)
    const smiling = !angryEye && (winked || state.happy);
    const lid = state.lid || 0;
    rig.angry.visible = angryEye;
    rig.smile.visible = smiling;
    rig.shut.visible = !angryEye && !smiling && lid > 0.5;
    rig.open.visible = !angryEye && !smiling && lid <= 0.5;
  }

  // 놀람의 눈 변형 — ☆_☆ / ♥_♥. 그동안 눈(정지 눈 프레임·눈 리그)은 **끄고** 글리프로 대체한다 (덮지 않는다). 봉투(k)로 팝인/아웃 (0.7 → 1)
  const fx = state.eyeFx;
  const fxOn = !!fx && fx.k > 0.02;
  if (fxOn) for (const lid of item.staticLids) for (const g of lid.frames) g.visible = false;
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
