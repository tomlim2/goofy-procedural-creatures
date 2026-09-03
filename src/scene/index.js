// The three.js scene — camera, grid placement, floor line, regen, render loop.
// Assembling an individual is rig.js; applying state is animate.js.

import * as THREE from "three";
import { Sketch } from "../stroke.js";
import { makeCreature } from "../character/index.js";
import { makeNoise, makeRng } from "../rng.js";
import { makePaperMaterial, setGrainScale } from "./paper.js";
import { attachPost } from "./post.js";
import { inkMaterial, disposeGroup, sketchMesh } from "./mesh.js";
import { buildCreature, BOIL_FRAMES } from "./rig.js";
import { applyState } from "./animate.js";
import { drawHouse } from "../house/index.js";
import { BIND_STATE } from "../motion/index.js";
import { makeHifives } from "./hifive.js";
import { makeSparks } from "./spark.js";

// Cell size — the box one individual stands in. The floor line is 0.16 above the bottom of the box (slotPosition). The gallery uses it too, to work out label positions
export const CELL_W = 1.0;
export const CELL_H = 1.35;

// The reference board for paper grain. Whatever the grid is, the grain is drawn as it would look on a screen of this size (9×6 looks best).
const PAPER_GRID = [9, 6];

// The margin around the board. 1×1 is a single creature, so filling the board would eat the whole screen — the view is doubled so it stands at half size
const PAD = 1.08;
const SOLO_PAD = PAD * 2;

export function createScene(canvas, { hifiveRush = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));   // (resize settles it again — moving monitors changes the pixel ratio)

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.z = 10;

  let paper = null;
  let post = null;   // the passes drawn over the finished board (post.js)
  let ground = null;
  // The high five — the scene owns the pair logic (no clock knows another's position, scene/hifive.js) and
  // the stars that bounce out of a contact (scene/spark.js)
  const hifives = makeHifives({ rush: hifiveRush });
  let sparks = null;
  let creatures = [];
  let noise = null;
  let columns = 7;
  let rows = 5;
  // The global time of the last update. Becomes the birth time of clocks born from a regen or rebuild.
  let clockNow = 0;
  // The canvas CSS size (and pixel ratio) at the last setSize/layout — resize() only works when they changed (main calls it every frame).
  // canvas.width has the pixel ratio multiplied in, so comparing it to clientWidth directly calls setSize every frame and re-allocates the drawing buffer each time
  let sized = [0, 0, 0];
  let laidOut = [0, 0];
  // There are two axes.
  //   pose: rig state. With bindView, BIND_STATE instead of the clock — joints and expression all at default.
  //   ink:  line texture. With boilOn, the 3 boil frames cycle; otherwise frame 0 is pinned.
  // The bind pose is a state of the rig and the boil is a hand-drawn material. Different axes, so they switch separately.
  let bindView = false;
  let boilOn = true;
  // The regen switch. Off by default — form changes only through NEW SEED.
  let regenEnabled = false;
  // A forced action (the ACTION card). null follows each creature's own schedule. Used to judge one action.
  // The active arm of an asymmetric action is split on the parity of the seed, so left and right look mixed on the board.
  let forcedAction = null;
  function applyForced(item) {
    if (item.clock) item.clock.force(forcedAction, item.spec.seed % 2 ? 1 : -1);   // a house has no clock
  }

  // A house — a static occupant (src/house/index.js): three boil frames of one layer, no clock, no face,
  // no emoji. The update loop only cycles its boil; everything else about it stands still on purpose
  function buildHouse(spec) {
    const group = new THREE.Group();
    const frames = { house: [] };
    for (let k = 0; k < BOIL_FRAMES; k += 1) {
      const layer = drawHouse(spec, k);
      const mesh = sketchMesh([layer.fills, layer.ink], 1, 1.5);
      mesh.visible = k === 0;
      frames.house.push(mesh);
      group.add(mesh);
    }
    return {
      static: true, group, frames, boilRanges: [], spec, limbs: [], lastState: null,
      boilFps: (8 + (spec.seed % 5) * 0.5) / 15, boilOffset: spec.seed % BOIL_FRAMES,
      baseX: 0, baseY: 0, generation: 0, emojiRoot: new THREE.Group()
    };
  }

  // Lifts one individual out of the scene — throws the geometry away (materials are shared, so they stay) and detaches the group and emoji root
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

  // Solves the world size the camera holds from the lattice size and the canvas aspect. Wraps the board at 1.08× and stretches whichever side is left over to fit the aspect.
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
      if (post) post.layout(viewW, viewH);
      // Paper grain does not follow the grid — it is pinned to the size it appears at on the 9×6 board (PAPER_GRID).
      // Derived from the current view, the grain would grow relative to the screen as the view narrows: at 1×1 it would
      // come out as blotches instead of grain. The shader gets the 9×6 view as its grain space
      const [grainW, grainH] = viewSize(PAPER_GRID[0], PAPER_GRID[1], aspect);
      setGrainScale(grainW / viewW, grainH / viewH);   // grain units per world unit
    }
  }

  // Seats a newborn individual in the clock's current state immediately (no easing). Otherwise the arms are seen swinging down
  // from the rig's bind pose (T) to idle on the first frame. The bind pose should only be visible in the BIND view.
  function settle(item) {
    if (bindView || item.static) return;   // a house has nothing to seat
    applyState(item, item.clock.update(clockNow), clockNow, noise, { snap: true, boil: boilOn });
  }

  function slotPosition(index) {
    const width = columns * CELL_W;
    const height = rows * CELL_H;
    const col = index % columns;
    const row = Math.floor(index / columns);
    return [-width / 2 + CELL_W * (col + 0.5), height / 2 - CELL_H * (row + 1) + 0.16];
  }

  // Each individual gets a render order block — the layers within it (0.5~6.6) stay as they are and index × ORDER_STRIDE is added.
  // That way, when neighbours overlap (a huge head, walking), the individual in front is drawn **entirely** above the one behind — layers never interleave and let the back one's outline show through the front one's face.
  // Front to back follows index order (lower rows in front; within a row, the right one in front). Emoji go above every individual (scene/emoji.js EMOJI_ORDER)
  const ORDER_STRIDE = 10;
  function stack(item, index) {
    const base = (index + 1) * ORDER_STRIDE;
    item.group.traverse((node) => { if (node.isMesh) node.renderOrder += base; });
    item.orderBase = base;
  }

  // Stands a freshly assembled individual at slot index — forced action, position, render order block, seating in the clock state, adding to the scene. Shared by build and regenerate
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
    hifives.reset();   // slots renumber — index-keyed cooldowns would mean other pairs
    if (sparks) sparks.clear();
    columns = cols;
    rows = Math.ceil(specs.length / cols);

    const rng = makeRng(specs[0] ? specs[0].seed : 1);
    noise = makeNoise(rng);

    if (!paper) {
      // The sheet — the board's one shader (paper.js), behind everything. Seed 7, fixed: the paper is the desk, not the creature
      paper = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makePaperMaterial());
      paper.renderOrder = 0;
      paper.position.z = -1;
      scene.add(paper);
      post = attachPost(scene);   // and what goes over the finished board — the paper again, on top (post.js)
      sparks = makeSparks(scene);
    }

    specs.forEach((spec, index) => {
      const item = spec.kind === "house" ? buildHouse(spec) : buildCreature(spec, noise, clockNow);
      place(item, index);
      creatures.push(item);
    });

    const width = columns * CELL_W;
    const height = rows * CELL_H;
    const groundSketch = new Sketch(noise, 1.4);
    for (let row = 0; row < rows; row += 1) {
      const y = height / 2 - CELL_H * (row + 1) + 0.16;
      groundSketch.line([[-width / 2 + 0.1, y], [width / 2 - 0.1, y]], { color: "#4a423a" });
    }
    ground = new THREE.Mesh(groundSketch.build(), inkMaterial(0.72));
    ground.renderOrder = 1;
    scene.add(ground);

    layout();
  }

  // One slot, swapped for an individual the caller chose. Everything else on the board is left exactly where
  // it stands: rebuilding the whole board to change one cell discards all 35 rigs, resets every clock to its
  // birth and drops the high fives' cooldowns, which reads as the board blinking off and on.
  function replace(index, spec) {
    const old = creatures[index];
    if (!old) return;
    // A five in progress needs no release here: the pairing notices the item is gone on its next tick, the
    // same way it already does for a LIVE regen (scene/hifive.js).
    discard(old);
    const item = spec.kind === "house" ? buildHouse(spec) : buildCreature(spec, noise, clockNow);
    item.generation = old.generation;
    place(item, index);
    creatures[index] = item;
  }

  // Regen. The species stays with the slot; only the individual changes.
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
      if (item.static) {
        // A house — only its lines boil (the medium's, not the occupant's). INK STILL pins frame 0
        const frame = boilOn ? Math.floor(t * item.boilFps + item.boilOffset) % BOIL_FRAMES : 0;
        for (let k = 0; k < BOIL_FRAMES; k += 1) item.frames.house[k].visible = k === frame;
        continue;
      }
      if (bindView) {
        // The clock is let run (to prevent a runaway on return) while the rig is pinned to bind. Joint easing is immediate.
        item.lastState = item.clock.update(t);
        applyState(item, BIND_STATE, t, noise, { snap: true, boil: boilOn });
        continue;
      }
      const state = item.clock.update(t);
      item.lastState = state;   // the high five pairing reads every creature's position off this, after the loop
      if (state.regen && regenEnabled) {
        regenerate(index);
        continue;
      }
      applyState(item, state, t, noise, { boil: boilOn });
    }
    // The high five — after every clock has moved, so both of a pair's positions are this tick's.
    // Off while the rig is pinned (BIND — the picture and the clocks disagree) or the ACTION card is
    // forcing (a forced arm would fight the five)
    if (bindView || forcedAction) hifives.releaseAll();
    else hifives.update(creatures, columns, clockNow, (x, y) => sparks.burst(x, y, clockNow, noise));
    sparks.update(clockNow);
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

  // Draws the current state for one frame. The PNG export calls it **immediately before** reading the canvas —
  // WebGL clears the drawing buffer at the end of a frame, so it has to be redrawn in the same task to be readable (src/export.js)
  function draw() {
    renderer.render(scene, camera);
  }

  // Debug — applies an arbitrary state (fields written over BIND_STATE) to one individual immediately and draws one frame.
  // Used to audit by pixel whether parts are visible in each face state (guidelines/character/rules.md § a face part has to be visible in every state).
  function probe(item, overrides = {}) {
    applyState(item, { ...BIND_STATE, ...overrides }, clockNow, noise, { snap: true, boil: false });
    renderer.render(scene, camera);
  }

  return { build, replace, update, resize, setRegen, setBind, setBoil, setAction, draw, probe, renderer, scene, camera, creatures: () => creatures };
}
