// Face part audit — draws every individual on one board in each face state, toggling one part off and on and counting the pixel difference.
// If the difference is under the threshold (4% of the head width), that part is "not visible" in that state (gone to width 0, drawn on the same color, or covered by something else).
// Docs: guidelines/character/rules.md § a face part has to be visible in every state
//   audit.html?seed=0z0y9qe
//
// What counts as correct (the expectation):
//   brows (not none) · mouth · nose (muzzle) · eyewear · cheeks · whiskers (cats) — visible in every state
//   static eyes (dot, sleepy, cross, spiral, slit, half) — for sleep, ^^, a wink (on that side) and anger, a substitute glyph shows instead (shut line / smile arc / fierce eye)
//   the eye rig's pupil (ring, wide, cyclops) — closed during a blink, ^^, a wink (that side) and sleep, so it is left out then. In exchange,
//   the shut line has to be visible then — an eye closing must not make the eye disappear from the face
//   the ^^ arc — visible when happy or winking (that side) · the sleep lid — visible when asleep

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

// Face states — fields written over BIND_STATE
const STATES = {
  idle: {}, surprise: { startle: 1 }, sleep: { sleep: 1, lid: 1 }, blink: { lid: 1 }, happy: { happy: true },
  winkR: { winkSide: 1 }, winkL: { winkSide: -1 }, mouthAlt: { mouthAlt: true }, browAlt: { browAlt: true },
  turnR: { faceTurn: [1, 0] }, turnL: { faceTurn: [-1, 0] }, turnU: { faceTurn: [0, 1] }, turnD: { faceTurn: [0, -1] },
  turnRU: { faceTurn: [1, 1] }, turnLD: { faceTurn: [-1, -1] }, turnRsurp: { faceTurn: [1, 0], startle: 1 },
  turnDsurp: { faceTurn: [0, -1], startle: 1 }, sleepTurn: { sleep: 1, lid: 1, faceTurn: [0.5, -0.5] },
  starEyes: { startle: 1, eyeFx: { kind: "star", k: 1 } }, heartEyes: { startle: 1, eyeFx: { kind: "heart", k: 1 } },
  angry: { angry: 1 }, angryTurn: { angry: 1, faceTurn: [-1, 0.5] }
};
// The threshold for "visible" — 4% of the head width (pixels). About the size of a dot mouth, a dot nose, one freckle or one small brow. A smaller screen lowers the threshold too
const minPixels = (headPx) => Math.max(3, Math.round(headPx * 0.04));

function run() {
  seedLabel.textContent = formatSeed(seed);
  window.history.replaceState(null, "", `?seed=${seed.toString(36)}`);
  const specs = makeGrid(seed, COLS * ROWS, COLS, null);
  scene.build(specs, COLS);
  scene.setBind(true);
  scene.update(0);
  statusLabel.textContent = "auditing…";
  report.textContent = "auditing…";
  // Counted one frame later — the canvas has to be sized first
  requestAnimationFrame(() => {
    const result = audit();
    statusLabel.textContent = `${result.violations.length} not visible`;
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
    for (const other of list) other.group.visible = other === item;   // one creature at a time — for speed
    const spec = item.spec;
    const box = layout(spec);
    const eyes = eyeGeometry(spec, box);
    const kinds = facePartKinds(spec);
    const noise = makeNoise(makeRng(spec.proportions.wobbleSeed >>> 0));
    // Parts baked into a shared frame (static eyes, cheeks, nose, eyewear) get their own temp mesh from the same drawing function,
    // and only the temp mesh is toggled while the original frame stays hidden
    const temp = [];
    // hide: the original frames to hide while the temp mesh is on — a layer name (a key of item.frames) or a frame list. side: which side an eye temp mesh is on (for the wink check)
    const mk = (label, fn, fillOrder, inkOrder, hide, side = 0) => {
      const ink = new Sketch(noise, spec.proportions.wobble);
      const fills = new Sketch(noise, spec.proportions.wobble);
      fn(ink, fills);
      const base = item.orderBase || 0;   // the individual's block offset (scene/index.js stack) — temp meshes go in the same block
      const meshes = [sketchMesh(fills, 0.92, fillOrder + base, -item.faceCy), sketchMesh(ink, 0.92, inkOrder + base, -item.faceCy)];
      for (const m of meshes) { m.visible = false; item.faceGroup.add(m); }
      temp.push({ label, meshes, hidden: typeof hide === "string" ? item.frames[hide] : hide, side });
    };
    // Static eyes get one layer per eye — so do the temp meshes (only the winking side is substituted; the other has to stay)
    for (const lid of item.staticLids) mk(`eyes${lid.eye.side < 0 ? 0 : 1}`, (ink, fills) => drawEyes(ink, fills, spec, box, [lid.eye]), 2.3, 2.4, lid.frames, lid.eye.side);
    if (spec.parts.face2 !== "none") mk("face2", (ink, fills) => drawFace2(ink, fills, spec, box, eyes), 2.3, 2.4, "face");
    if (spec.species === "pup" || spec.parts.nose !== "none") mk("nose", (ink, fills) => drawNose(ink, fills, spec, box, eyes), 6.4, 6.5, "faceFront");
    if (spec.parts.eyewear !== "none") mk("eyewear", (ink, fills) => drawEyewear(ink, fills, spec, box, eyes), 6.4, 6.5, "faceFront");
    if (spec.species === "cat") mk("whiskers", (ink) => drawWhiskers(ink, spec, box), 2.3, 2.4, "face");

    const reg = region(item);
    const headPx = reg.w / 1.5;   // the region width is 1.5× the head width — so this is the head width in pixels
    headPxMin = Math.min(headPxMin, headPx);
    const MIN_PIXELS = minPixels(headPx);
    for (const [stateName, ov] of Object.entries(STATES)) {
      scene.probe(item, ov);
      const asleep = !!ov.sleep, closedAll = !!ov.lid || !!ov.happy;
      const parts = [];   // [label, meshes, should it show, frame keys to hide]
      const angry = !!ov.angry;
      const browIdx = angry ? 2 : ov.browAlt ? 1 : 0, mouthIdx = angry ? 2 : ov.happy ? 3 : ov.mouthAlt ? 1 : 0;   // same priority as animate
      if (kinds.brow[browIdx] !== "none") parts.push(["brow", [item.faceStates.brow[browIdx]], true]);
      parts.push(["mouth", [item.faceStates.mouth[mouthIdx]], true]);
      // Static eyes are substituted only for sleep, ^^, anger, startle variants and **a wink on that side** — the other eye has to stay visible through a wink
      for (const t of temp) parts.push([t.label, t.meshes, t.label.startsWith("eyes") ? !(asleep || ov.happy || angry || ov.eyeFx || (ov.winkSide && ov.winkSide === t.side)) : true, t.hidden]);
      item.eyeRigs.forEach((rig, i) => {
        const winked = ov.winkSide && rig.eye.side === ov.winkSide;
        const closed = winked || closedAll || asleep || !!ov.eyeFx || angry;
        parts.push([`pupil${i}`, [rig.pupil], !closed]);
        parts.push([`smile${i}`, [rig.smile], !angry && !!(winked || ov.happy)]);
        // A closed eye (blink, sleep) has to have its shut line — "the pupil may be invisible" does not mean "the eye may be gone"
        parts.push([`shut${i}`, [rig.shut], !angry && !winked && !ov.happy && (asleep || (ov.lid || 0) > 0.5)]);
        parts.push([`angry${i}`, [rig.angry], angry && !asleep]);   // anger — the fierce eye shows instead
      });
      // Startle variants — the ☆/♥ cover has to show then, and the eye underneath is allowed not to
      if (ov.eyeFx) item.eyeFx.forEach((e, i) => parts.push([`eyeFx${i}`, [ov.eyeFx.kind === "star" ? e.star : e.heart], true]));
      item.staticLids.forEach((lid, i) => {
        const angryEye = angry && !asleep;
        const happyEye = !angryEye && (!!ov.happy || (ov.winkSide && lid.eye.side === ov.winkSide));
        parts.push([`sleepLid${i}`, [lid.shut], asleep && !happyEye]);   // sleep — the shut line (the cover stays; only the line is toggled)
        parts.push([`smile${i}`, [lid.smile], !!happyEye]);            // ^^ / wink — the smile arc
        parts.push([`angry${i}`, [lid.angry], angryEye]);              // anger — the fierce eye
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
        if (hidden) hidden[0].visible = true;   // probe turns on boil frame 0 only — that is the only one restored
        else for (const m of meshes) m.visible = true;
        if (d < MIN_PIXELS) {
          violations.push(`${spec.species} ${spec.seed.toString(36)} ${stateName} ${key} — eyes=${spec.parts.eyes} mouth=${spec.parts.mouth} nose=${spec.parts.nose} eyewear=${spec.parts.eyewear} face2=${spec.parts.face2} (${d}px)`);
        }
      }
    }
    for (const t of temp) for (const m of t.meshes) { item.faceGroup.remove(m); disposeGroup(m); }   // materials are shared — only the geometry is thrown away
  }
  for (const other of list) other.group.visible = true;
  scene.update(0);

  const lines = [`board ${formatSeed(seed)} · ${list.length} creatures × ${Object.keys(STATES).length} states · head width ≥ ${Math.round(headPxMin)}px (threshold ${minPixels(headPxMin)}px)`, `checked ${Object.entries(checked).map(([k, v]) => `${k} ${v}`).join(" · ")}`, ""];
  lines.push(violations.length ? `not visible: ${violations.length}` : "not visible: 0 — every part shows in every state");
  lines.push(...violations);
  return { violations, text: lines.join("\n") };
}

const reseed = () => { seed = randomSeed(); run(); };
document.getElementById("reseed").addEventListener("click", reseed);
window.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "r") reseed(); });
window.addEventListener("resize", () => scene.resize());
scene.resize();
run();
