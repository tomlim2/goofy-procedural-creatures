// 머티리얼·메시 유틸. 문서: guidelines/drawing.md § 색공간, guidelines/rig.md

import * as THREE from "three";

export function inkMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    // 2D 그림이라 뒷면 컬링이 필요 없다. 켜두면 시계방향으로 감긴
    // 경로(box 몸통 등)의 fan 삼각형이 백페이스로 잘려 채색이 사라진다.
    side: THREE.DoubleSide
  });
}

// dy만큼 지오메트리를 미리 내린다. 회전 축(그룹 원점)을 맞추는 데 쓴다.
export function sketchMesh(sketch, opacity, renderOrder, dy = 0) {
  const geometry = sketch.build();
  if (dy) geometry.translate(0, dy, 0);
  const mesh = new THREE.Mesh(geometry, inkMaterial(opacity));
  mesh.renderOrder = renderOrder;
  return mesh;
}

export function disposeGroup(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.geometry.dispose();
      node.material.dispose();
    }
  });
}
