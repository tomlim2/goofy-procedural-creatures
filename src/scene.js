// three.js 씬. 그리드 배치, 종이 배경, 개체 리그 조립.
//
// 개체 하나의 계층:
//   group(발 원점) ── bodyGroup ── 보일 몸 3벌 · tailGroup(꼬리) · 팔 상태 2벌
//                └── headGroup(목 축) ── 보일 머리 3벌 · faceGroup(요) ── 눈 리그 · 눈썹 · 입
// 애니메이션 원칙: 생성은 개체당 한 번, 매 프레임은 변형만.

import * as THREE from "three";
import { drawCreature, facePartKinds, facePartSketch, limbSketches, armPoseAngle, tailSketch } from "./draw.js";
import { blobPath, arcPath, Sketch } from "./stroke.js";
import { makeClock } from "./clocks.js";
import { makeCreature } from "./creature.js";
import { makeNoise, makeRng } from "./rng.js";
import { PAPER } from "./vocabulary.js";

const CELL_W = 1.0;
const CELL_H = 1.35;
const BOIL_FRAMES = 3;

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
    depthWrite: false,
    // 2D 그림이라 뒷면 컬링이 필요 없다. 켜두면 시계방향으로 감긴
    // 경로(box 몸통 등)의 fan 삼각형이 백페이스로 잘려 채색이 사라진다.
    side: THREE.DoubleSide
  });
}

// dy만큼 지오메트리를 미리 내린다. 회전 축(그룹 원점)을 맞추는 데 쓴다.
function sketchMesh(sketch, opacity, renderOrder, dy = 0) {
  const geometry = sketch.build();
  if (dy) geometry.translate(0, dy, 0);
  const mesh = new THREE.Mesh(geometry, inkMaterial(opacity));
  mesh.renderOrder = renderOrder;
  return mesh;
}

// 이모트 글리프. 이벤트가 드물어서 그때그때 굽는다.
function buildEmote(kind, noise) {
  const sketch = new Sketch(noise, 0.6);
  if (kind === "heart") {
    const pts = [];
    for (let i = 0; i <= 28; i += 1) {
      const a = (i / 28) * Math.PI * 2;
      const x = 0.045 * Math.pow(Math.sin(a), 3);
      const y = 0.038 * (Math.cos(a) - 0.35 * Math.cos(2 * a) - 0.18 * Math.cos(3 * a) - 0.06 * Math.cos(4 * a)) + 0.01;
      pts.push([x, y]);
    }
    sketch.fill(pts, "#b0432e");
    sketch.outline(pts, { color: "#7d2f20", width: 0.007 });
  } else if (kind === "bang") {
    sketch.stroke([[0, 0.075], [0.004, 0.02]], { color: "#2b2724", width: 0.018 });
    sketch.stroke([[-0.002, -0.012], [0.006, -0.014]], { color: "#2b2724", width: 0.018 });
  } else if (kind === "dots") {
    // "..." — 중얼거림
    for (let i = 0; i < 3; i += 1) {
      const x = -0.03 + i * 0.03;
      sketch.stroke([[x - 0.006, 0.01 + (i % 2) * 0.008], [x + 0.006, 0.01 + (i % 2) * 0.008]], {
        color: "#2b2724", width: 0.014
      });
    }
  } else {
    sketch.stroke(arcPath(0, 0.045, 0.03, 0.03, Math.PI, -Math.PI * 0.35, 12), { color: "#2b2724", width: 0.012 });
    sketch.stroke([[0.012, 0.012], [0.008, -0.004]], { color: "#2b2724", width: 0.012 });
    sketch.stroke([[0.004, -0.026], [0.012, -0.028]], { color: "#2b2724", width: 0.015 });
  }
  return sketchMesh(sketch, 0.95, 7);
}

function buildCreature(spec, noise, birth = 0) {
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

function disposeGroup(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.geometry.dispose();
      node.material.dispose();
    }
  });
}

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
      const state = item.clock.update(t);

      if (state.regen && regenEnabled) {
        regenerate(index);
        continue;
      }

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
    renderer.render(scene, camera);
  }

  function setRegen(value) {
    regenEnabled = value;
  }

  return { build, update, resize, setRegen, renderer, scene, camera };
}
