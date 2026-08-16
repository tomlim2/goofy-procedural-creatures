// 리팩토링 전후 동작 불변 검증.
//   node scripts/snapshot.mjs before   → snapshots/before.json
//   node scripts/snapshot.mjs after    → snapshots/after.json + before와 diff
//
// 스펙 200마리, 지오메트리 해시(머리·몸·팔다리·꼬리·눈썹·입), 4종족 60초 모션 궤적.
// three.js 없이 돌리기 위해 stroke의 build()는 부르지 않고 positions/colors만 해시한다.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const label = process.argv[2] || "before";

const { makeGrid } = await import(join(root, "src/character/index.js"));
const draw = await import(join(root, "src/character/index.js"));
const clocks = await import(join(root, "src/motion/index.js"));

const hash = (obj) => createHash("sha1").update(JSON.stringify(obj)).digest("hex").slice(0, 12);
const round = (a) => Array.from(a, (v) => Math.round(v * 1e5) / 1e5);
const sketchHash = (s) => hash([round(s.positions), round(s.colors)]);

const out = { specs: [], geometry: [], motion: {} };

// 1. 스펙
for (const seed of [12345, 555, 99, 31337]) {
  const g = makeGrid(seed, 50, 7);
  out.specs.push(hash(g));
}

// 2. 지오메트리
const grid = makeGrid(777, 35, 7);
for (const spec of grid) {
  const d = draw.drawCreature(spec, 0);
  const d1 = draw.drawCreature(spec, 1);
  const kinds = draw.facePartKinds(spec);
  const entry = {
    seed: spec.seed,
    body: sketchHash(d.body.ink) + sketchHash(d.body.fills),
    head: sketchHash(d.head.ink) + sketchHash(d.head.fills),
    face: sketchHash(d.face.ink) + sketchHash(d.face.fills),
    front: sketchHash(d.front.ink) + sketchHash(d.front.fills),
    faceFront: sketchHash(d.faceFront.ink) + sketchHash(d.faceFront.fills),
    variant1: sketchHash(d1.head.ink),
    eyes: d.eyes.map((e) => [e.side, +e.x.toFixed(4), +e.y.toFixed(4), +e.r.toFixed(4)]),
    neckY: +d.neckY.toFixed(5),
    limbs: draw.limbSketches(spec).map((l) => [l.kind, l.side, l.pivot.map((v) => +v.toFixed(5)), sketchHash(l.sketch), l.backSketch ? sketchHash(l.backSketch) : null]),
    tail: (() => { const t = draw.tailSketch(spec); return [t.pivot.map((v) => +v.toFixed(5)), sketchHash(t.sketch)]; })(),
    brow: kinds.brow.map((k) => sketchHash(draw.facePartSketch(spec, "brow", k))),
    mouth: kinds.mouth.map((k) => sketchHash(draw.facePartSketch(spec, "mouth", k)))
  };
  out.geometry.push(entry);
}

// 3. 모션 궤적 — 4종족, 60초, 매 10프레임 샘플
for (const species of ["human", "pup", "cat", "imp"]) {
  // 리그 서술(motionRig)을 넘긴다 — 모션 IK가 손 목표를 각도로 풀고, 네발 잠에서 몸이 내려앉는 거리를 안다
  const rig = draw.motionRig ? draw.motionRig(draw.makeCreature(42, species)) : false;
  const clock = clocks.makeClock(42, 3, species, rig);
  const samples = [];
  for (let f = 0; f < 3600; f += 1) {
    const s = clock.update(3 + f / 60);
    if (f % 10 === 0) {
      const flat = {};
      for (const [k, v] of Object.entries(s)) {
        if (typeof v === "number") flat[k] = Math.round(v * 1e6) / 1e6;
        else if (typeof v === "boolean" || typeof v === "string") flat[k] = v;
        else if (Array.isArray(v)) flat[k] = v.map((x) => Math.round(x * 1e6) / 1e6);
        else if (v && typeof v === "object") flat[k] = Object.fromEntries(Object.entries(v).map(([a, b]) => [a, typeof b === "number" ? Math.round(b * 1e6) / 1e6 : b]));
        else flat[k] = v;
      }
      samples.push(flat);
    }
  }
  out.motion[species] = hash(samples);
  out.motion[species + "_sample"] = samples[120];
}

mkdirSync(join(root, "snapshots"), { recursive: true });
const file = join(root, "snapshots", `${label}.json`);
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`저장: snapshots/${label}.json`);

if (label === "after" && existsSync(join(root, "snapshots/before.json"))) {
  const before = JSON.parse(readFileSync(join(root, "snapshots/before.json"), "utf8"));
  const diffs = [];
  if (JSON.stringify(before.specs) !== JSON.stringify(out.specs)) diffs.push("specs");
  before.geometry.forEach((b, i) => {
    const a = out.geometry[i];
    for (const k of Object.keys(b)) if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) diffs.push(`geometry[${i}].${k}`);
  });
  for (const k of Object.keys(before.motion)) if (JSON.stringify(before.motion[k]) !== JSON.stringify(out.motion[k])) diffs.push(`motion.${k}`);
  if (diffs.length) { console.log("차이:", diffs.length, "건"); console.log(diffs.slice(0, 20).join("\n")); process.exit(1); }
  console.log("동작 불변 — diff 0");
}
