// 얼굴 파츠 전수조사 — 판 하나의 모든 개체를 얼굴 상태별로 그려, 파츠 하나를 껐다 켰다 하며 픽셀 차이를 센다.
// 차이가 문턱(머리 폭의 4%) 미만이면 그 상태에서 그 파츠는 "안 보인다"(폭 0으로 사라졌거나, 같은 색 위에 그려졌거나, 다른 것에 덮였거나).
// 문서: guidelines/character/rules.md § 얼굴 파츠는 어느 상태에서도 보여야 한다
//   audit.html?seed=0z0y9qe
//
// 판단 기준(기대값):
//   눈썹(none 아님)·입·코(주둥이)·안경·볼·수염(고양이) — 모든 상태에서 보인다
//   정지 눈(dot·sleepy·cross·spiral·slit·half) — 잠·^^·윙크(그쪽)·화남에는 대체 글리프(감은 눈 선 / 미소 아치 / 사나운 눈)가 대신 보인다
//   눈 리그의 동공(ring·wide·cyclops) — 깜빡임·^^·윙크(그쪽)·잠에는 감기니 그때는 빼고 본다. 대신 그때는
//   감은 눈 선(shut)이 보여야 한다 — 눈이 감겼다고 얼굴에서 눈이 사라지면 안 된다
//   ^^ 아치 — 행복·윙크(그쪽)일 때 보인다 · 잠 눈꺼풀 — 잠들었을 때 보인다

import * as THREE from "three";
import { createScene } from "./scene/index.js";
import { makeGrid, layout, eyeGeometry, facePartKinds } from "./character/index.js";
import { drawEyes, drawFace2, drawNose, drawEyewear, drawWhiskers } from "./character/draw/face.js";
import { Sketch } from "./stroke.js";
import { makeNoise, makeRng, formatSeed } from "./rng.js";
import { sketchMesh, disposeGroup } from "./scene/material.js";
import { randomSeed } from "./ui.js";

const COLS = 7, ROWS = 5;
const canvas = document.getElementById("stage");
const report = document.getElementById("report");
const seedLabel = document.getElementById("seed");
const statusLabel = document.getElementById("status");
const params = new URLSearchParams(window.location.search);
let seed = params.get("seed") ? parseInt(params.get("seed"), 36) >>> 0 : randomSeed();

const scene = createScene(canvas);

// 얼굴 상태 — BIND_STATE 위에 덮어쓰는 필드
const STATES = {
  idle: {}, surprise: { startle: 1 }, sleep: { sleep: 1, lid: 1 }, blink: { lid: 1 }, happy: { happy: true },
  winkR: { winkSide: 1 }, winkL: { winkSide: -1 }, mouthAlt: { mouthAlt: true }, browAlt: { browAlt: true },
  turnR: { faceTurn: [1, 0] }, turnL: { faceTurn: [-1, 0] }, turnU: { faceTurn: [0, 1] }, turnD: { faceTurn: [0, -1] },
  turnRU: { faceTurn: [1, 1] }, turnLD: { faceTurn: [-1, -1] }, turnRsurp: { faceTurn: [1, 0], startle: 1 },
  turnDsurp: { faceTurn: [0, -1], startle: 1 }, sleepTurn: { sleep: 1, lid: 1, faceTurn: [0.5, -0.5] },
  starEyes: { startle: 1, eyeFx: { kind: "star", k: 1 } }, heartEyes: { startle: 1, eyeFx: { kind: "heart", k: 1 } },
  angry: { angry: 1 }, angryTurn: { angry: 1, faceTurn: [-1, 0.5] }
};
// "보인다"의 문턱 — 머리 폭의 4%(픽셀). 점 입·점 코·주근깨 하나·작은 눈썹 하나가 이 정도다. 화면이 작으면 문턱도 내려간다
const minPixels = (headPx) => Math.max(3, Math.round(headPx * 0.04));

function run() {
  seedLabel.textContent = formatSeed(seed);
  window.history.replaceState(null, "", `?seed=${seed.toString(36)}`);
  const specs = makeGrid(seed, COLS * ROWS, COLS, null);
  scene.build(specs, COLS);
  scene.setBind(true);
  scene.update(0);
  statusLabel.textContent = "조사 중…";
  report.textContent = "조사 중…";
  // 한 프레임 뒤에 센다 — 캔버스 크기가 잡힌 뒤여야 한다
  requestAnimationFrame(() => {
    const result = audit();
    statusLabel.textContent = `${result.violations.length}건 안 보임`;
    report.textContent = result.text;
  });
}

function audit() {
  const list = scene.creatures();
  const renderer = scene.renderer, gl = renderer.getContext(), cam = scene.camera;
  const W = renderer.domElement.width, H = renderer.domElement.height;
  const V = new THREE.Vector3();

  function region(item) {
    item.group.updateWorldMatrix(true, true);
    const gp = new THREE.Vector3();
    item.group.getWorldPosition(gp);
    const cx = gp.x, cy = gp.y + item.headTop - item.headRy;
    const rx = item.headRx * 1.5, ry = item.headRy * 1.5;
    const a = V.set(cx - rx, cy - ry, 0).clone().project(cam), b = V.set(cx + rx, cy + ry, 0).clone().project(cam);
    const x0 = Math.max(0, Math.floor((Math.min(a.x, b.x) + 1) / 2 * W)), x1 = Math.min(W - 1, Math.ceil((Math.max(a.x, b.x) + 1) / 2 * W));
    const y0 = Math.max(0, Math.floor((Math.min(a.y, b.y) + 1) / 2 * H)), y1 = Math.min(H - 1, Math.ceil((Math.max(a.y, b.y) + 1) / 2 * H));
    return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  function grab(reg) {
    const buf = new Uint8Array(reg.w * reg.h * 4);
    gl.readPixels(reg.x0, reg.y0, reg.w, reg.h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }
  function diffCount(a, b) {
    let n = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) > 24 || Math.abs(a[i + 1] - b[i + 1]) > 24 || Math.abs(a[i + 2] - b[i + 2]) > 24) n += 1;
    }
    return n;
  }

  const violations = [];
  const checked = {};
  let headPxMin = Infinity;
  for (const item of list) {
    for (const other of list) other.group.visible = other === item;   // 한 마리씩 — 빠르게
    const spec = item.spec;
    const box = layout(spec);
    const eyes = eyeGeometry(spec, box);
    const kinds = facePartKinds(spec);
    const noise = makeNoise(makeRng(spec.proportions.wobbleSeed >>> 0));
    // 프레임에 섞여 굽힌 파츠(정지 눈·볼·코·안경)는 같은 그리기 함수로 임시 메시를 따로 굽고,
    // 원본 프레임을 숨긴 채 임시 메시만 껐다 켰다 한다
    const temp = [];
    // hide: 임시 메시를 켜는 동안 숨길 원본 프레임 — 층 이름(item.frames의 키) 또는 프레임 목록. side: 눈 임시 메시의 좌우(윙크 판정용)
    const mk = (label, fn, fillOrder, inkOrder, hide, side = 0) => {
      const ink = new Sketch(noise, spec.proportions.wobble);
      const fills = new Sketch(noise, spec.proportions.wobble);
      fn(ink, fills);
      const base = item.orderBase || 0;   // 개체 블록 오프셋 (scene/index.js stack) — 임시 메시도 같은 블록에
      const meshes = [sketchMesh(fills, 0.92, fillOrder + base, -item.faceCy), sketchMesh(ink, 0.92, inkOrder + base, -item.faceCy)];
      for (const m of meshes) { m.visible = false; item.faceGroup.add(m); }
      temp.push({ label, meshes, hidden: typeof hide === "string" ? item.frames[hide] : hide, side });
    };
    // 정지 눈은 눈마다 한 층 — 임시 메시도 눈마다 (윙크한 쪽만 대체되고 반대쪽은 남아야 한다)
    for (const lid of item.staticLids) mk(`eyes${lid.eye.side < 0 ? 0 : 1}`, (ink, fills) => drawEyes(ink, fills, spec, box, [lid.eye]), 2.3, 2.4, lid.frames, lid.eye.side);
    if (spec.parts.face2 !== "none") mk("face2", (ink, fills) => drawFace2(ink, fills, spec, box, eyes), 2.3, 2.4, "face");
    if (spec.species === "pup" || spec.parts.nose !== "none") mk("nose", (ink, fills) => drawNose(ink, fills, spec, box, eyes), 6.4, 6.5, "faceFront");
    if (spec.parts.eyewear !== "none") mk("eyewear", (ink, fills) => drawEyewear(ink, fills, spec, box, eyes), 6.4, 6.5, "faceFront");
    if (spec.species === "cat") mk("whiskers", (ink) => drawWhiskers(ink, spec, box), 2.3, 2.4, "face");

    const reg = region(item);
    const headPx = reg.w / 1.5;   // region 폭은 머리 폭의 1.5배 — 머리 폭(픽셀)
    headPxMin = Math.min(headPxMin, headPx);
    const MIN_PIXELS = minPixels(headPx);
    for (const [stateName, ov] of Object.entries(STATES)) {
      scene.probe(item, ov);
      const asleep = !!ov.sleep, closedAll = !!ov.lid || !!ov.happy;
      const parts = [];   // [라벨, 메시들, 보여야 하나, 숨길 프레임 키]
      const angry = !!ov.angry;
      const browIdx = angry ? 2 : ov.browAlt ? 1 : 0, mouthIdx = angry ? 2 : ov.mouthAlt ? 1 : 0;
      if (kinds.brow[browIdx] !== "none") parts.push(["brow", [item.faceStates.brow[browIdx]], true]);
      parts.push(["mouth", [item.faceStates.mouth[mouthIdx]], true]);
      // 정지 눈은 잠·^^·화남·놀람 변형·**그쪽 윙크**에만 대체된다 — 반대쪽 눈은 윙크 중에도 보여야 한다
      for (const t of temp) parts.push([t.label, t.meshes, t.label.startsWith("eyes") ? !(asleep || ov.happy || angry || ov.eyeFx || (ov.winkSide && ov.winkSide === t.side)) : true, t.hidden]);
      item.eyeRigs.forEach((rig, i) => {
        const winked = ov.winkSide && rig.eye.side === ov.winkSide;
        const closed = winked || closedAll || asleep || !!ov.eyeFx || angry;
        parts.push([`pupil${i}`, [rig.pupil], !closed]);
        parts.push([`smile${i}`, [rig.smile], !angry && !!(winked || ov.happy)]);
        // 감은 눈(깜빡임·잠)은 감은 눈 선이 있어야 한다 — "동공이 안 보여도 된다"가 "눈이 없어도 된다"는 뜻이 아니다
        parts.push([`shut${i}`, [rig.shut], !angry && !winked && !ov.happy && (asleep || (ov.lid || 0) > 0.5)]);
        parts.push([`angry${i}`, [rig.angry], angry && !asleep]);   // 화남 — 사나운 눈이 대신 보인다
      });
      // 놀람 변형 — ☆/♥ 덮개는 그때 보여야 하고, 그 밑의 눈은 안 보여도 된다
      if (ov.eyeFx) item.eyeFx.forEach((e, i) => parts.push([`eyeFx${i}`, [ov.eyeFx.kind === "star" ? e.star : e.heart], true]));
      item.staticLids.forEach((lid, i) => {
        const angryEye = angry && !asleep;
        const happyEye = !angryEye && (!!ov.happy || (ov.winkSide && lid.eye.side === ov.winkSide));
        parts.push([`sleepLid${i}`, [lid.shut], asleep && !happyEye]);   // 잠 — 감은 눈 선 (덮개는 두고 선만 껐다 켠다)
        parts.push([`smile${i}`, [lid.smile], !!happyEye]);            // ^^·윙크 — 미소 아치
        parts.push([`angry${i}`, [lid.angry], angryEye]);              // 화남 — 사나운 눈
      });

      for (const [label, meshes, expect, hidden] of parts) {
        if (!expect) continue;
        const key = label.replace(/\d$/, "");
        checked[key] = (checked[key] || 0) + 1;
        if (hidden) for (const g of hidden) g.visible = false;
        for (const m of meshes) m.visible = true;
        renderer.render(scene.scene, cam);
        const on = grab(reg);
        for (const m of meshes) m.visible = false;
        renderer.render(scene.scene, cam);
        const off = grab(reg);
        const d = diffCount(on, off);
        if (hidden) hidden[0].visible = true;   // probe는 보일 0번 프레임만 켠다 — 그것만 되살린다
        else for (const m of meshes) m.visible = true;
        if (d < MIN_PIXELS) {
          violations.push(`${spec.species} ${spec.seed.toString(36)} ${stateName} ${key} — eyes=${spec.parts.eyes} mouth=${spec.parts.mouth} nose=${spec.parts.nose} eyewear=${spec.parts.eyewear} face2=${spec.parts.face2} (${d}px)`);
        }
      }
    }
    for (const t of temp) for (const m of t.meshes) { item.faceGroup.remove(m); disposeGroup(m); }   // 재질은 공유 — 지오메트리만 버린다
  }
  for (const other of list) other.group.visible = true;
  scene.update(0);

  const lines = [`판 ${formatSeed(seed)} · ${list.length}마리 × ${Object.keys(STATES).length}상태 · 머리 폭 ≥ ${Math.round(headPxMin)}px (문턱 ${minPixels(headPxMin)}px)`, `검사 ${Object.entries(checked).map(([k, v]) => `${k} ${v}`).join(" · ")}`, ""];
  lines.push(violations.length ? `안 보임 ${violations.length}건:` : "안 보임 0건 — 전 파츠가 전 상태에서 보인다");
  lines.push(...violations);
  return { violations, text: lines.join("\n") };
}

const reseed = () => { seed = randomSeed(); run(); };
document.getElementById("reseed").addEventListener("click", reseed);
window.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "r") reseed(); });
window.addEventListener("resize", () => scene.resize());
scene.resize();
run();
