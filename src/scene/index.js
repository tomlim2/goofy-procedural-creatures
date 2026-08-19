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

// 셀 크기 — 개체 하나가 서는 칸. 바닥선은 칸 밑에서 0.16 위 (slotPosition). gallery가 라벨 자리 계산에 같이 쓴다
export const CELL_W = 1.0;
export const CELL_H = 1.35;

// 종이 그레인의 기준 판. 그리드가 뭐든 이 크기의 화면에서 보이는 그레인으로 그린다 (9×6이 제일 보기 좋다).
const PAPER_GRID = [9, 6];

// 판을 감싸는 여백. 1×1은 한 마리뿐이라 판을 꽉 채우면 화면을 다 먹는다 — 뷰를 두 배로 잡아 절반 크기로 세운다
const PAD = 1.08;
const SOLO_PAD = PAD * 2;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));   // (resize가 다시 잡는다 — 모니터를 옮기면 픽셀 비가 바뀐다)

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
  // 마지막 setSize·layout 때의 캔버스 CSS 크기(와 픽셀 비) — resize()는 바뀌었을 때만 일한다 (main이 매 프레임 부른다).
  // canvas.width는 픽셀 비가 곱해진 값이라 clientWidth와 직접 비교하면 매 프레임 setSize가 불려 드로잉 버퍼가 프레임마다 다시 잡힌다
  let sized = [0, 0, 0];
  let laidOut = [0, 0];
  // 두 축이다.
  //   pose: 리그 상태. bindView면 clock 대신 BIND_STATE — 관절·표정 전부 기본.
  //   ink:  선 질감. boilOn이면 보일 3벌 순환, 아니면 0번 프레임 고정.
  // 바인드 포즈는 리그의 상태이고 보일은 손그림 재질이다. 다른 축이라 따로 켠다.
  let bindView = false;
  let boilOn = true;
  // 재생성 스위치. 기본 꺼짐 — 형태는 NEW SEED로만 바뀐다.
  let regenEnabled = false;
  // 강제 행위 (ACTION 카드). null이면 각자 시계의 예약대로. 행위 하나를 판단할 때 쓴다.
  // 비대칭 행위의 활동 팔은 시드 홀짝으로 갈라 좌우가 섞여 보이게 한다.
  let forcedAction = null;
  function applyForced(item) {
    item.clock.force(forcedAction, item.spec.seed % 2 ? 1 : -1);
  }

  // 개체 하나를 씬에서 걷어낸다 — 지오메트리를 버리고(재질은 공유라 그대로) 그룹·이모지 루트를 뗀다
  function discard(item) {
    disposeGroup(item.group);
    scene.remove(item.group);
    disposeGroup(item.emojiRoot);
    scene.remove(item.emojiRoot);
  }

  function clear() {
    for (const item of creatures) discard(item);
    creatures = [];
    if (ground) {
      disposeGroup(ground);
      scene.remove(ground);
      ground = null;
    }
  }

  // 격자 크기와 캔버스 비율로 카메라가 담는 세계 크기를 푼다. 판을 1.08배로 감싸고 남는 쪽을 비율에 맞춰 늘인다.
  function viewSize(cols, rowCount, aspect) {
    const width = cols * CELL_W;
    const height = rowCount * CELL_H;
    const pad = cols * rowCount === 1 ? SOLO_PAD : PAD;
    let viewW = width * pad;
    let viewH = height * pad;
    if (aspect > width / height) viewW = viewH * aspect;
    else viewH = viewW / aspect;
    return [viewW, viewH];
  }

  function layout() {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    laidOut = [canvas.clientWidth, canvas.clientHeight];
    const [viewW, viewH] = viewSize(columns, rows, aspect);

    camera.left = -viewW / 2;
    camera.right = viewW / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();

    if (paper) {
      paper.scale.set(viewW, viewH, 1);
      // 종이 그레인은 그리드를 안 따라간다 — 9×6 판(PAPER_GRID)에서 보이는 크기로 고정한다.
      // 지금 뷰에서 뽑으면 뷰가 좁을수록 타일이 화면에 비해 커진다: 1×1에서는 3단위 타일 하나가
      // 화면보다 커져 그레인이 아니라 뭉갠 얼룩이 된다.
      const [grainW, grainH] = viewSize(PAPER_GRID[0], PAPER_GRID[1], aspect);
      paper.material.map.repeat.set(grainW / 3, grainH / 3);
    }
  }

  // 태어난 개체를 시계의 현재 상태에 즉시 앉힌다(이징 없이). 안 그러면 리그의 바인드(T)에서
  // idle까지 팔이 휘돌며 내려오는 게 첫 프레임에 보인다. 바인드는 BIND 뷰에서만 보여야 한다.
  function settle(item) {
    if (bindView) return;
    applyState(item, item.clock.update(clockNow), clockNow, noise, { snap: true, boil: boilOn });
  }

  function slotPosition(index) {
    const width = columns * CELL_W;
    const height = rows * CELL_H;
    const col = index % columns;
    const row = Math.floor(index / columns);
    return [-width / 2 + CELL_W * (col + 0.5), height / 2 - CELL_H * (row + 1) + 0.16];
  }

  // 개체마다 렌더 순서 블록을 준다 — 개체 안의 층(0.5~6.6)은 그대로 두고 index × ORDER_STRIDE를 더한다.
  // 그래야 이웃과 겹칠 때(왕머리·걷기) 앞 개체가 **통째로** 뒤 개체 위에 그려진다 — 층끼리 섞여 뒤 개체의 윤곽이 앞 개체 얼굴을 뚫고 비치지 않는다.
  // 앞뒤는 index 순서(아랫줄이 앞, 같은 줄에선 오른쪽이 앞). 이모지는 모든 개체 위(scene/emoji.js EMOJI_ORDER)
  const ORDER_STRIDE = 10;
  function stack(item, index) {
    const base = (index + 1) * ORDER_STRIDE;
    item.group.traverse((node) => { if (node.isMesh) node.renderOrder += base; });
    item.orderBase = base;
  }

  // 갓 조립한 개체를 슬롯 index에 세운다 — 강제 행위·자리·렌더 순서 블록·시계 상태 착석·씬 추가. build와 regenerate가 같이 쓴다
  function place(item, index) {
    if (forcedAction) applyForced(item);
    const [x, y] = slotPosition(index);
    item.baseX = x;
    item.baseY = y;
    item.group.position.set(x, y, 0);
    stack(item, index);
    settle(item);
    scene.add(item.group);
    scene.add(item.emojiRoot);
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
      place(item, index);
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
    discard(old);
    const item = buildCreature(spec, noise, clockNow);
    item.generation = old.generation + 1;
    place(item, index);
    creatures[index] = item;
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (width !== sized[0] || height !== sized[1] || dpr !== sized[2]) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      sized = [width, height, dpr];
    }
    if (width !== laidOut[0] || height !== laidOut[1]) layout();
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

  function setAction(name) {
    forcedAction = name || null;
    for (const item of creatures) applyForced(item);
  }

  // 지금 상태를 한 프레임 그린다. PNG 내보내기가 캔버스를 읽기 **직전에** 부른다 —
  // WebGL 그리기 버퍼는 프레임이 끝나면 비워지므로 같은 태스크에서 다시 그려야 읽힌다 (src/export.js)
  function draw() {
    renderer.render(scene, camera);
  }

  // 디버그 — 한 개체에 임의 상태(BIND_STATE 위에 덮어쓴 필드)를 즉시 입히고 한 프레임 그린다.
  // 얼굴 상태별로 파츠가 보이는지 픽셀로 전수조사할 때 쓴다 (guidelines/character/rules.md § 얼굴 파츠는 어느 상태에서도 보여야 한다).
  function probe(item, overrides = {}) {
    applyState(item, { ...BIND_STATE, ...overrides }, clockNow, noise, { snap: true, boil: false });
    renderer.render(scene, camera);
  }

  return { build, update, resize, setRegen, setBind, setBoil, setAction, draw, probe, renderer, scene, camera, creatures: () => creatures };
}
