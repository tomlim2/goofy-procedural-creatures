// 머티리얼·메시 유틸. 문서: guidelines/drawing.md § 색공간, guidelines/rig.md, guidelines/performance.md

import * as THREE from "three";
import { buildGeometry } from "../stroke.js";

// 잉크 재질은 **불투명도별로 하나씩만** 만들어 모든 메시가 나눠 쓴다. 개체 35마리 × 메시 수십 개가 저마다 재질을 가지면
// 렌더러가 메시마다 재질을 갈아 끼우고(uniform 갱신) 재생성 때마다 재질을 새로 굽는다 — 공유하면 같은 재질이 이어지는 동안 건너뛴다.
// 공유 재질은 아무도 dispose하지 않고(disposeGroup이 건너뛴다) opacity를 프레임마다 바꾸지도 않는다 — 그런 메시는 ownInkMaterial.
const shared = new Map();
export function inkMaterial(opacity) {
  let material = shared.get(opacity);
  if (!material) {
    material = makeInkMaterial(opacity);
    material.userData.shared = true;
    shared.set(opacity, material);
  }
  return material;
}

// 혼자 쓰는 재질 — 프레임마다 opacity를 바꾸는 메시(이모지)용. 공유 재질의 opacity를 건드리면 같은 값을 쓰는 모든 메시가 같이 변한다
export function ownInkMaterial(opacity) {
  return makeInkMaterial(opacity);
}

function makeInkMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    // 2D 그림이라 뒷면 컬링이 필요 없다. 켜두면 시계방향으로 감긴
    // 경로(box 몸통 등)의 fan 삼각형이 백페이스로 잘려 채색이 사라진다.
    side: THREE.DoubleSide,
    // transparent + DoubleSide는 three.js가 뒷면·앞면을 두 번에 나눠 그린다(draw call ×2, 재질 needsUpdate 매번). 앞뒤 정렬이
    // 필요한 3D 반투명 물체용이라 depthTest 없는 2D 리본에는 뜻이 없다 — 한 번만 그린다
    forceSinglePass: true
  });
}

// 스케치(들) → 메시. 여러 벌을 주면 한 지오메트리로 잇는다 — 앞의 것이 밑에 깔린다(채색 → 잉크). 같은 층의 채색·잉크를 한 메시로 굽는 데 쓴다.
// dy만큼 지오메트리를 미리 내린다. 회전 축(그룹 원점)을 맞추는 데 쓴다. own이면 재질을 공유하지 않는다.
export function sketchMesh(sketches, opacity, renderOrder, dy = 0, { own = false } = {}) {
  const geometry = buildGeometry(Array.isArray(sketches) ? sketches : [sketches]);
  if (dy) geometry.translate(0, dy, 0);
  const mesh = new THREE.Mesh(geometry, own ? ownInkMaterial(opacity) : inkMaterial(opacity));
  mesh.renderOrder = renderOrder;
  return mesh;
}

// 지오메트리를 버린다. 재질은 공유 재질이 아닐 때만(이모지) — 공유 재질을 dispose하면 다른 메시가 다음 프레임에 다시 컴파일한다
export function disposeGroup(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.geometry.dispose();
      if (!node.material.userData.shared) node.material.dispose();
    }
  });
}
