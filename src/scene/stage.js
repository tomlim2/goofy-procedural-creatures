// The stage — the cast stood up in a room. A creature on the board is a flat drawing: its triangles lie in one x·y
// plane at z = 0 and front-to-back is renderOrder alone (mesh.js — no depth test). The stage takes that rig **as it
// is** — nothing is redrawn, the clock and applyState are the board's — and stands the plane on a floor at a point
// (x, 0, z), the way a paper standee is stood on a desk. A perspective camera goes round it, the sheet lies under it
// as the floor, and what the board decides by cell index (which individual is drawn over which) the stage decides by
// **distance to the camera**, every tick. Docs: guidelines/rig.md § the stage, guidelines/drawing.md § the paper

import * as THREE from "three";
import { Sketch } from "../stroke.js";
import { blobPath } from "../shape.js";
import { PAPER } from "../character/index.js";
import { shade } from "../color.js";
import { makeNoise, makeRng } from "../rng.js";
import { GRAIN, GRAIN_GLSL, setGrainScale } from "./paper.js";
import { attachPost } from "./post.js";
import { inkMaterial, disposeGroup } from "./mesh.js";
import { buildCreature, BOIL_FRAMES } from "./rig.js";
import { applyState } from "./animate.js";
import { buildHouse, viewSize, PAPER_GRID, CELL_W } from "./index.js";
import { BIND_STATE } from "../motion/index.js";
import { makeHifives } from "./hifive.js";
import { makeSparks } from "./spark.js";

// The knobs, in one place. Distances in world units (a cell is CELL_W across, a creature about 1.1 tall), angles in radians
export const STAGE = {
  rowZ: 1.5,               // the depth between two rows
  stagger: 0.5,            // every other row set this much of a cell over — a brick lattice, so a back row shows between the front row's heads
  fov: 32,                 // the camera's vertical field of view, degrees
  homePitch: [0.32, 0.06, 0.7],   // the elevation the page opens at: base, per row past the first, cap
  pitch: [0.03, 1.45],     // how low and how high the camera may go — never under the floor, never straight down
  dist: [1.6, 40],         // how near and how far it may come
  targetY: 0.5,            // it looks at the lattice's centre this high off the floor
  sheetMargin: 1.6,        // the sheet reaches this far past the lattice
  desk: "#d3c8b3",         // what shows past the sheet — the desk it lies on
  smudge: 0.87,            // the contact smudge under the feet: the paper shaded this much
  ordering: 10             // the render order block per individual (the board's ORDER_STRIDE) — the layers inside are rig.md's
};

// The floor — the board's sheet (paper.js sheetColor) keyed on the floor's own plane, x·z: its tone and its blotches only
// (cell 0.5 — no grain: the speckle is the pass over the screen, as on the board). Its blotch scale is its own uniform,
// one grain unit per world unit (the 9×6 board's), not the shared one the pass is laid at
const FLOOR_VERTEX = /* glsl */ `
varying vec2 vPaper;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPaper = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const FLOOR_FRAGMENT = /* glsl */ `
${GRAIN_GLSL}
varying vec2 vPaper;
void main() {
  gl_FragColor = vec4(sheetColor(vPaper, 0.5), 1.0);
  #include <colorspace_fragment>
}`;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createStage(canvas, { hifiveRush = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Two renders a frame — the room, then the sheet over the screen — so the clear is done by hand (draw)
  renderer.autoClear = false;
  renderer.setClearColor(new THREE.Color(STAGE.desk));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(STAGE.fov, 1, 0.1, 100);

  // The sheet over the screen — the same pass the board draws last (post.js), in a render of its own with an orthographic
  // camera in the 9×6 board's view (viewSize — one grain unit per world unit there, the board's own speckle). Keyed on
  // where a fragment lies in that camera's plane, it stays pinned to the screen while the perspective camera moves; laid
  // in the room it would slide over the drawing
  const overlay = new THREE.Scene();
  const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  overlayCamera.position.z = 10;
  const post = attachPost(overlay);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { ...GRAIN, grainScale: { value: new THREE.Vector2(1, 1) } },
    vertexShader: FLOOR_VERTEX,
    fragmentShader: FLOOR_FRAGMENT,
    depthTest: false,
    depthWrite: false
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = 0;
  scene.add(floor);
  let edge = null;   // the sheet's edge — a pencil contour lying flat around it, in the ground line's own colour

  // The stage's own hand — the paper's roll (7), as the sheet: the desk, not the cast
  const deskNoise = makeNoise(makeRng(7));

  const hifives = makeHifives({ rush: hifiveRush });
  const sparks = makeSparks(scene);
  let creatures = [];   // in lattice order (index = cell), as on the board — the high five pairs row neighbours by index
  let noise = null;
  let columns = 7;
  let rows = 5;
  let clockNow = 0;
  let sized = [0, 0, 0];
  let laidOut = [0, 0];
  let bindView = false;
  let boilOn = true;
  // "camera" — every card turns to the camera's bearing (one yaw for the whole cast, so a pair's walk toward each other stays
  // along the row); "front" — stood facing +z, the way paper standees are left on a desk, and seen edge-on from the side
  let facing = "camera";
  let built = null;   // the lattice size the camera was last homed for

  // The camera — an orbit about the lattice's centre. yaw 0 is in front, looking toward −z
  const orbit = { yaw: 0, pitch: STAGE.homePitch[0], dist: 8 };
  const target = new THREE.Vector3(0, STAGE.targetY, 0);
  let moved = true;   // a draw is owed outside the tick — the camera or the canvas changed
  function aim() {
    const cp = Math.cos(orbit.pitch);
    camera.position.set(
      target.x + orbit.dist * Math.sin(orbit.yaw) * cp,
      target.y + orbit.dist * Math.sin(orbit.pitch),
      target.z + orbit.dist * Math.cos(orbit.yaw) * cp
    );
    camera.lookAt(target);
    moved = true;
  }
  function turn(dYaw, dPitch) {
    orbit.yaw += dYaw;
    orbit.pitch = clamp(orbit.pitch + dPitch, STAGE.pitch[0], STAGE.pitch[1]);
    aim();
  }
  function zoom(k) {
    orbit.dist = clamp(orbit.dist * k, STAGE.dist[0], STAGE.dist[1]);
    aim();
  }
  // How far back the camera stands to hold the whole lattice: the front row's width across the view, and the lattice's
  // depth (foreshortened by the elevation) plus a creature's height and some air down it — 2.3 stands a single creature
  // at about half the view, the board's own 1×1 measure
  function fitDistance() {
    const half = Math.tan(THREE.MathUtils.degToRad(STAGE.fov) / 2);
    const width = (columns + STAGE.stagger) * CELL_W + 1.2;
    const depth = (rows - 1) * STAGE.rowZ;
    const tall = depth * Math.sin(orbit.pitch) + 2.3;
    return Math.max(width / (2 * half * camera.aspect), tall / (2 * half)) + (depth / 2) * Math.cos(orbit.pitch);
  }
  function home() {
    orbit.yaw = 0;
    orbit.pitch = Math.min(STAGE.homePitch[2], STAGE.homePitch[0] + STAGE.homePitch[1] * (rows - 1));
    orbit.dist = clamp(fitDistance(), STAGE.dist[0], STAGE.dist[1]);
    aim();
  }

  // The cell's place on the floor: the board's x (a cell across, the row centred), every other row half a cell over, and
  // the rows down the depth — the last row (the board's front row) nearest the camera, the lattice centred on the origin
  function slotPosition(index) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = -(columns * CELL_W) / 2 + CELL_W * (col + 0.5) + (row % 2 ? 0.5 : -0.5) * STAGE.stagger * CELL_W;
    const z = (row - (rows - 1) / 2) * STAGE.rowZ;
    return [x, z];
  }

  // The contact smudge — a puddle of shadow under the feet, the paper shaded a little, lying flat: it is what makes a
  // card stand ON the floor rather than float in front of it. It follows the feet (update) and stays on the floor
  // when the creature hops. A scene mark, not a part — filled the way the board's hover arrow is, not painted
  function makeSmudge(item) {
    const sketch = new Sketch(deskNoise, 0.8);
    const rx = item.static ? 0.42 : Math.max(0.22, item.headRx * 1.15);
    sketch.fill(blobPath(0, 0, rx, rx * 0.36, { lumps: 4, amount: 0.18, noise: null, phase: item.spec.roll % 7 }), shade(PAPER, STAGE.smudge));
    const mesh = new THREE.Mesh(sketch.build(), inkMaterial(1));
    mesh.rotation.order = "YXZ";   // laid flat first (x), then turned with the card (y)
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 0.5;   // over the floor, under every individual's block
    return mesh;
  }

  function settle(item) {
    if (bindView || item.static) return;
    applyState(item, item.clock.update(clockNow), clockNow, noise, { snap: true, boil: boilOn });
  }

  function place(item, index) {
    const [x, z] = slotPosition(index);
    item.baseX = x;
    item.baseY = 0;
    item.group.position.set(x, 0, z);
    item.orderBase = 0;   // restack hands the blocks out by distance before the first draw
    settle(item);
    item.smudge = makeSmudge(item);
    scene.add(item.smudge);
    scene.add(item.group);
    scene.add(item.emojiRoot);
  }

  function discard(item) {
    for (const node of [item.group, item.emojiRoot, item.smudge]) {
      disposeGroup(node);
      scene.remove(node);
    }
  }

  function clear() {
    for (const item of creatures) discard(item);
    creatures = [];
    if (edge) {
      disposeGroup(edge);
      scene.remove(edge);
      edge = null;
    }
  }

  function build(specs, cols) {
    clear();
    hifives.reset();
    sparks.clear();
    columns = cols;
    rows = Math.ceil(specs.length / cols);
    noise = makeNoise(makeRng(specs[0] ? specs[0].roll : 1));

    specs.forEach((spec, index) => {
      const item = spec.kind === "house" ? buildHouse(spec) : buildCreature(spec, noise, clockNow);
      place(item, index);
      creatures.push(item);
    });

    // The sheet — the lattice plus a margin, and its edge drawn round it
    const width = (columns + STAGE.stagger) * CELL_W + 2 * STAGE.sheetMargin;
    const depth = (rows - 1) * STAGE.rowZ + 2 * STAGE.sheetMargin;
    floor.scale.set(width, depth, 1);
    const edgeSketch = new Sketch(deskNoise, 1.4);
    edgeSketch.contour([[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]], { color: "#4a423a" });
    edge = new THREE.Mesh(edgeSketch.build(), inkMaterial(0.72));
    edge.rotation.x = -Math.PI / 2;
    edge.renderOrder = 1;
    scene.add(edge);

    layout();
    const size = `${columns}x${rows}`;
    if (size !== built) home();   // a new lattice is looked at afresh; NEW on the same lattice keeps the view where the hand left it
    built = size;
    restack();
  }

  // Front to back by distance to the camera, every tick — far first, so the nearest individual is drawn last and whole
  // (the board does this by cell index once, scene/index.js stack). A block moves only when its rank does
  function restack() {
    const cx = camera.position.x, cz = camera.position.z;
    const ranked = creatures.map((item) => ({ item, d: (item.group.position.x - cx) ** 2 + (item.group.position.z - cz) ** 2 }));
    ranked.sort((a, b) => b.d - a.d);
    ranked.forEach(({ item }, rank) => {
      const base = (rank + 1) * STAGE.ordering;
      if (base === item.orderBase) return;
      const delta = base - item.orderBase;
      item.group.traverse((node) => { if (node.isMesh) node.renderOrder += delta; });
      item.orderBase = base;
    });
  }

  function layout() {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    laidOut = [canvas.clientWidth, canvas.clientHeight];
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const [viewW, viewH] = viewSize(PAPER_GRID[0], PAPER_GRID[1], aspect);
    overlayCamera.left = -viewW / 2;
    overlayCamera.right = viewW / 2;
    overlayCamera.top = viewH / 2;
    overlayCamera.bottom = -viewH / 2;
    overlayCamera.updateProjectionMatrix();
    post.layout(viewW, viewH);
    setGrainScale(1, 1);   // the pass's view is the grain space itself
    moved = true;
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
    const yaw = facing === "camera" ? orbit.yaw : 0;
    for (const item of creatures) {
      item.group.rotation.y = yaw;   // XYZ: the sway (rotation.z, animate) in the card's own plane, then the turn
      if (item.static) {
        const frame = boilOn ? Math.floor(t * item.boilFps + item.boilOffset) % BOIL_FRAMES : 0;
        for (let k = 0; k < BOIL_FRAMES; k += 1) item.frames.house[k].visible = k === frame;
      } else if (bindView) {
        item.lastState = item.clock.update(t);
        applyState(item, BIND_STATE, t, noise, { snap: true, boil: boilOn });
      } else {
        const state = item.clock.update(t);
        item.lastState = state;
        applyState(item, state, t, noise, { boil: boilOn });
      }
      if (item.emojiMesh) item.emojiMesh.rotation.y = yaw;   // the glyph faces the way its card does
      item.smudge.position.set(item.group.position.x, 0.002, item.group.position.z);
      item.smudge.rotation.y = yaw;
    }
    if (bindView) hifives.releaseAll();
    else hifives.update(creatures, columns, clockNow, (x, y, anchor) => sparks.burst(x, y, clockNow, noise, { z: anchor.group.position.z, yaw }));
    sparks.update(clockNow);
    restack();
    draw();
  }

  function draw() {
    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(overlay, overlayCamera);
    moved = false;
  }

  return {
    build, update, draw, resize, turn, zoom, home,
    moved: () => moved,
    setBind: (value) => { bindView = value; },
    setBoil: (value) => { boilOn = value; },
    setFacing: (value) => { facing = value === "front" ? "front" : "camera"; },
    renderer, scene, camera, creatures: () => creatures
  };
}
