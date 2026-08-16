// three.js 씬 — 카메라·그리드 배치·바닥선·재생성·렌더 루프.
// 개체 조립은 rig.js, 상태 적용은 animate.js.

import * as THREE from "three";
import { Sketch } from "../stroke.js";
import { makeCreature } from "../character/index.js";
import { makeNoise, makeRng } from "../rng.js";
import { makePaperTexture } from "./paper.js";
import { inkMaterial, disposeGroup } from "./material.js";
import { buildCreature } from "./rig.js";
import { applyState } from "./animate.js";
import { BIND_STATE } from "../motion/index.js";

const CELL_W = 1.0;
const CELL_H = 1.35;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.z = 10;

  let paper = null;
  let ground = null;
  let creatures = [];
  let noise = null;
  let columns = 7;
  let rows = 5;
  // 마지막 update의 전역 시각. 재생성·재빌드로 태어나는 시계의 출생 시각이 된다.
  let clockNow = 0;
  // 두 축이다.
  //   pose: 리그 상태. bindView면 clock 대신 BIND_STATE — 관절·표정 전부 기본.
  //   ink:  선 질감. boilOn이면 보일 3벌 순환, 아니면 0번 프레임 고정.
  // 바인드 포즈는 리그의 상태이고 보일은 손그림 재질이다. 다른 축이라 따로 켠다.
  let bindView = false;
  let boilOn = true;
  // 재생성 스위치. 기본 꺼짐 — 형태는 NEW SEED로만 바뀐다.
  let regenEnabled = false;

  function clear() {
    for (const item of creatures) {
      disposeGroup(item.group);
      scene.remove(item.group);
    }
    creatures = [];
    if (ground) {
      disposeGroup(ground);
      scene.remove(ground);
      ground = null;
    }
  }

  function layout() {
    const width = columns * CELL_W;
    const height = rows * CELL_H;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const gridAspect = width / height;

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

  function slotPosition(index) {
    const width = columns * CELL_W;
    const height = rows * CELL_H;
    const col = index % columns;
    const row = Math.floor(index / columns);
    return [-width / 2 + CELL_W * (col + 0.5), height / 2 - CELL_H * (row + 1) + 0.16];
  }

  function build(specs, cols) {
    clear();
    columns = cols;
    rows = Math.ceil(specs.length / cols);

    const rng = makeRng(specs[0] ? specs[0].seed : 1);
    noise = makeNoise(rng);

    if (!paper) {
      paper = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: makePaperTexture(7), depthTest: false })
      );
      paper.renderOrder = 0;
      paper.position.z = -1;
      scene.add(paper);
    }

    specs.forEach((spec, index) => {
      const item = buildCreature(spec, noise, clockNow);
      const [x, y] = slotPosition(index);
      item.baseX = x;
      item.baseY = y;
      item.group.position.set(x, y, 0);
      scene.add(item.group);
      creatures.push(item);
    });

    const width = columns * CELL_W;
    const height = rows * CELL_H;
    const groundSketch = new Sketch(noise, 1.4);
    for (let row = 0; row < rows; row += 1) {
      const y = height / 2 - CELL_H * (row + 1) + 0.16;
      groundSketch.stroke([[-width / 2 + 0.1, y], [width / 2 - 0.1, y]], {
        color: "#4a423a", width: 0.012, jitter: 0.02, step: 0.08
      });
    }
    ground = new THREE.Mesh(groundSketch.build(), inkMaterial(0.72));
    ground.renderOrder = 1;
    scene.add(ground);

    layout();
  }

  // 재생성. 종족은 슬롯에 남고 개체만 바뀐다.
  function regenerate(index) {
    const old = creatures[index];
    const nextSeed = (old.spec.seed + (old.generation + 1) * 48271) >>> 0;
    const spec = makeCreature(nextSeed, old.spec.species);

    disposeGroup(old.group);
    scene.remove(old.group);

    const item = buildCreature(spec, noise, clockNow);
    item.generation = old.generation + 1;
    const [x, y] = slotPosition(index);
    item.baseX = x;
    item.baseY = y;
    item.group.position.set(x, y, 0);
    scene.add(item.group);
    creatures[index] = item;
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
    clockNow = t;
    for (let index = 0; index < creatures.length; index += 1) {
      const item = creatures[index];
      if (bindView) {
        // 시계는 흘려보내되(복귀 시 폭주 방지) 리그는 바인드로 고정. 관절 이징 즉시.
        item.clock.update(t);
        applyState(item, BIND_STATE, t, noise, { snap: true, boil: boilOn });
        continue;
      }
      const state = item.clock.update(t);
      if (state.regen && regenEnabled) {
        regenerate(index);
        continue;
      }
      applyState(item, state, t, noise, { boil: boilOn });
    }
    renderer.render(scene, camera);
  }

  function setRegen(value) {
    regenEnabled = value;
  }

  function setBind(value) {
    bindView = value;
  }

  function setBoil(value) {
    boilOn = value;
  }

  return { build, update, resize, setRegen, setBind, setBoil, renderer, scene, camera };
}
