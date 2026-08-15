// three.js 씬. 그리드 배치, 종이 배경, 개체별 메시 구성.

import * as THREE from "three";
import { drawCreature } from "./draw.js";
import { blobPath, Sketch } from "./stroke.js";
import { makeClock } from "./clocks.js";
import { makeNoise, makeRng } from "./rng.js";
import { PAPER } from "./vocabulary.js";

const CELL_W = 1.0;
const CELL_H = 1.35;

// 종이. 균일한 단색이면 선이 떠 보인다. 그레인과 얼룩을 절차적으로 굽는다.
function makePaperTexture(seed) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);

  const rng = makeRng(seed);
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (rng.next() - 0.5) * 26;
    data[i] = Math.max(0, Math.min(255, data[i] + grain));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
  }
  ctx.putImageData(image, 0, 0);

  // 옅은 얼룩 몇 개. 종이가 균일하지 않다는 신호.
  for (let i = 0; i < 18; i += 1) {
    const x = rng.float(0, size);
    const y = rng.float(0, size);
    const r = rng.float(40, 160);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, "rgba(150,132,104,0.05)");
    gradient.addColorStop(1, "rgba(150,132,104,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  // 캔버스는 sRGB로 그렸다. 명시하지 않으면 종이색이 뜬다.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function inkMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false
  });
}

function buildCreature(spec, noise) {
  const group = new THREE.Group();
  const drawn = drawCreature(spec);

  // 채색이 먼저, 그 위에 잉크. 순서가 뒤집히면 선이 묻힌다.
  if (!drawn.fills.empty) {
    const mesh = new THREE.Mesh(drawn.fills.build(), inkMaterial(0.92));
    mesh.renderOrder = 1;
    group.add(mesh);
  }
  const ink = new THREE.Mesh(drawn.ink.build(), inkMaterial(1));
  ink.renderOrder = 2;
  group.add(ink);

  // 동공과 눈꺼풀만 따로 움직인다. 나머지 선은 한 번 굽고 끝이다.
  const pupils = [];
  const lids = [];
  for (const eye of drawn.eyes) {
    const pupilSketch = new Sketch(noise, 0.4);
    pupilSketch.fill(
      blobPath(0, 0, eye.r * 0.44, eye.r * 0.44, { lumps: 3, amount: 0.12, noise: null }),
      spec.palette.ink
    );
    const pupil = new THREE.Mesh(pupilSketch.build(), inkMaterial(0.95));
    pupil.renderOrder = 3;
    pupil.position.set(eye.x, eye.y, 0);
    group.add(pupil);
    pupils.push({ mesh: pupil, eye });

    // 눈꺼풀은 위에서 내려온다. 지오메트리를 미리 내려 두고 scale.y로 여닫는다.
    const lidSketch = new Sketch(noise, 0.4);
    lidSketch.fill(
      blobPath(0, -eye.r * 1.15, eye.r * 1.2, eye.r * 1.15, { lumps: 3, amount: 0.1, noise: null }),
      spec.palette.skin
    );
    const lid = new THREE.Mesh(lidSketch.build(), inkMaterial(1));
    lid.renderOrder = 4;
    lid.position.set(eye.x, eye.y + eye.r * 1.15, 0);
    lid.scale.y = 0;
    group.add(lid);
    lids.push(lid);
  }

  return { group, pupils, lids, clock: makeClock(spec.seed), spec };
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.z = 10;

  let paper = null;
  let creatures = [];
  let columns = 7;
  let rows = 5;

  function clear() {
    for (const item of creatures) {
      item.group.traverse((node) => {
        if (node.isMesh) node.geometry.dispose();
      });
      scene.remove(item.group);
    }
    creatures = [];
  }

  function layout() {
    const width = columns * CELL_W;
    const height = rows * CELL_H;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const gridAspect = width / height;

    // 그리드 전체가 화면에 들어오도록 맞춘다.
    let viewW = width * 1.08;
    let viewH = height * 1.08;
    if (aspect > gridAspect) viewW = viewH * aspect;
    else viewH = viewW / aspect;

    camera.left = -viewW / 2;
    camera.right = viewW / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();

    if (paper) {
      paper.scale.set(viewW, viewH, 1);
      paper.material.map.repeat.set(viewW / 3, viewH / 3);
    }
  }

  function build(specs, cols) {
    clear();
    columns = cols;
    rows = Math.ceil(specs.length / cols);

    const rng = makeRng(specs[0] ? specs[0].seed : 1);
    const noise = makeNoise(rng);

    if (!paper) {
      paper = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: makePaperTexture(7), depthTest: false })
      );
      paper.renderOrder = 0;
      paper.position.z = -1;
      scene.add(paper);
    }

    const width = columns * CELL_W;
    const height = rows * CELL_H;

    specs.forEach((spec, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = -width / 2 + CELL_W * (col + 0.5);
      const y = height / 2 - CELL_H * (row + 1) + 0.16;

      const item = buildCreature(spec, noise);
      item.group.position.set(x, y, 0);
      scene.add(item.group);
      creatures.push(item);
    });

    // 각 줄의 바닥선. 셀마다 끊지 않고 한 줄을 통으로 긋되 손으로 그은 것처럼 흔든다.
    const ground = new Sketch(noise, 1.4);
    for (let row = 0; row < rows; row += 1) {
      const y = height / 2 - CELL_H * (row + 1) + 0.16;
      ground.stroke([[-width / 2 + 0.1, y], [width / 2 - 0.1, y]], {
        color: "#4a423a", width: 0.012, jitter: 0.02, step: 0.08
      });
    }
    const groundMesh = new THREE.Mesh(ground.build(), inkMaterial(0.72));
    groundMesh.renderOrder = 1;
    scene.add(groundMesh);
    creatures.push({ group: groundMesh, pupils: [], lids: [], clock: null, spec: null });

    layout();
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
    }
    layout();
  }

  function update(t) {
    for (const item of creatures) {
      if (!item.clock) continue;
      const state = item.clock.update(t);

      // 호흡 — 아주 작게. 크게 주면 젤리처럼 보인다.
      item.group.scale.set(1 + state.breathe * 0.006, 1 + state.breathe * 0.011, 1);
      item.group.position.y += 0;

      for (const { mesh, eye } of item.pupils) {
        mesh.position.x = eye.x + state.gaze[0] * eye.r * 0.34;
        mesh.position.y = eye.y + state.gaze[1] * eye.r * 0.28;
      }
      for (const lid of item.lids) {
        lid.scale.y = state.lid;
      }
    }
    renderer.render(scene, camera);
  }

  return { build, update, resize, renderer, scene, camera };
}
