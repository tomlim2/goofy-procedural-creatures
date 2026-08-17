// 그리기 리팩토링 전후 비교 — 작업 트리의 그리기 결과를 git 시점(기본 HEAD)과 **슬롯값 전부 × 종족 × 시드**로 맞댄다.
//   node scripts/drawdiff.mjs          # HEAD와 비교
//   node scripts/drawdiff.mjs main     # 다른 ref와 비교
//
// snapshot.mjs는 판 하나(35마리)의 층별 해시라 모든 슬롯값을 지나지 않는다. 그리기 코드를 크게 옮겼을 때(파일 분리·표로 바꾸기)
// 이걸 돌린다 — 층 11개 × 보일 2벌 + 팔다리 + 꼬리 마디 + 눈썹/입 상태를 스케치 단위로 해시해 비교한다. diff 0이면 그리기 불변.
// 이전 트리는 `git archive`로 임시 폴더에 꺼내고 node_modules(three)를 링크한다. 스펙(makeCreature)도 같이 비교한다.

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const ref = process.argv[2] || "HEAD";

const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, encoding: "utf8" }).trim();
const repoRoot = git("rev-parse --show-toplevel");
const prefix = git("rev-parse --show-prefix").replace(/\/$/, "");   // 레포 루트 기준 menagerie 경로

// node_modules(three)를 위로 올라가며 찾는다 — 꺼낸 트리 옆에 링크한다
let modules = null;
for (let dir = root; dir !== dirname(dir); dir = dirname(dir)) {
  if (existsSync(join(dir, "node_modules", "three"))) { modules = join(dir, "node_modules"); break; }
}
if (!modules) { console.error("node_modules/three를 못 찾았다"); process.exit(2); }

const tmp = mkdtempSync(join(tmpdir(), "menagerie-drawdiff-"));
try {
  execSync(`git archive ${ref} ${prefix} | tar -x -C "${tmp}"`, { cwd: repoRoot, shell: "/bin/sh" });
  symlinkSync(modules, join(tmp, "node_modules"), "dir");
  const oldRoot = join(tmp, prefix);

  const oldM = await import(pathToFileURL(join(oldRoot, "src/character/index.js")).href);
  const newM = await import(pathToFileURL(join(root, "src/character/index.js")).href);
  const oldSlots = (await import(pathToFileURL(join(oldRoot, "src/character/vocabulary/slots.js")).href)).SLOTS;

  const hash = (s) => createHash("sha1").update(JSON.stringify([Array.from(s.positions, (v) => Math.round(v * 1e6)), Array.from(s.colors, (v) => Math.round(v * 1e6))])).digest("hex").slice(0, 10);
  const KEYS = ["body", "crownBack", "head", "crown", "hairBack", "hairFront", "front", "hat", "face", "staticEyes", "faceFront"];
  let n = 0;
  const diffs = [];
  const note = (label) => { if (diffs.length < 30) diffs.push(label); };
  const check = (spec, label) => {
    for (const v of [0, 1]) {
      const a = oldM.drawCreature(spec, v), b = newM.drawCreature(spec, v);
      for (const k of KEYS) {
        n += 1;
        if (!a[k] || !b[k]) { note(`${label} ${k} (층 없음)`); continue; }
        if (hash(a[k].ink) !== hash(b[k].ink) || hash(a[k].fills) !== hash(b[k].fills)) note(`${label} ${k} variant ${v}`);
      }
    }
    const la = oldM.limbSketches(spec), lb = newM.limbSketches(spec);
    if (la.length !== lb.length) note(`${label} limbs 수`);
    else la.forEach((l, i) => { n += 1; if (hash(l.sketch) !== hash(lb[i].sketch)) note(`${label} limb ${i}`); });
    const ta = oldM.tailSketch(spec), tb = newM.tailSketch(spec);
    ta.sketches.forEach((s, i) => { n += 1; if (!tb.sketches[i] || hash(s) !== hash(tb.sketches[i])) note(`${label} tail ${i}`); });
    for (const part of ["brow", "mouth"]) {
      for (const kind of oldM.facePartKinds(spec)[part]) {
        n += 1;
        if (hash(oldM.facePartSketch(spec, part, kind)) !== hash(newM.facePartSketch(spec, part, kind))) note(`${label} ${part}=${kind}`);
      }
    }
  };
  let specDiffs = 0;
  for (const species of ["human", "cat", "pup", "imp"]) {
    for (const seed of [11, 2222, 333333]) {
      const base = oldM.makeCreature(seed, species);
      if (JSON.stringify(base) !== JSON.stringify(newM.makeCreature(seed, species))) specDiffs += 1;
      for (const [slot, values] of Object.entries(oldSlots)) {
        for (const value of values) check({ ...base, parts: { ...base.parts, [slot]: value } }, `${species}/${seed}/${slot}=${value}`);
      }
    }
  }
  console.log(`${ref} ↔ 작업 트리: 스케치 ${n}개 비교, 스펙 차이 ${specDiffs}건, 그리기 차이 ${diffs.length}건${diffs.length >= 30 ? " 이상" : ""}`);
  for (const d of diffs) console.log("  " + d);
  process.exitCode = diffs.length || specDiffs ? 1 : 0;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
