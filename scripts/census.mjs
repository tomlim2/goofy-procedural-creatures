// 종족 × 슬롯 분포와 정체성 위반 검사.
//   node scripts/census.mjs            → 종족별 슬롯 분포표 + 위반 목록
//   node scripts/census.mjs --slot eyes → 한 슬롯만 자세히
//   node scripts/census.mjs --check     → 위반만 (CI용, 위반 있으면 exit 1)
//
// "kid에 외눈이 새고 있다" 같은 것을 요청 전에 잡는다. 눈으로 보지 말고 센다.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const { makeGrid, SLOTS, SPECIES } = await import(join(root, "src/character/index.js"));
const { limbSketches, tailSketch } = await import(join(root, "src/character/index.js"));

const args = process.argv.slice(2);
const onlySlot = args.includes("--slot") ? args[args.indexOf("--slot") + 1] : null;
const checkOnly = args.includes("--check");
const BOARDS = 40;

// ── 표본 ──
const bySpecies = {};
for (let s = 0; s < BOARDS; s += 1) {
  for (const c of makeGrid(s * 7919 + 1, 35, 7)) {
    (bySpecies[c.species] ||= []).push(c);
  }
}
const speciesNames = SPECIES.map((s) => s.name);

// ── 정체성 검사 ──
const violations = [];
for (const sp of SPECIES) {
  const id = sp.identity || {};
  for (const c of bySpecies[sp.name] || []) {
    const where = `${sp.name} seed=${c.seed}`;
    if (id.horns && !id.horns.includes(c.parts.horns)) violations.push(`${where}: horns=${c.parts.horns} (허용: ${id.horns.join("/")})`);
    if (id.eyes?.not && id.eyes.not.includes(c.parts.eyes)) violations.push(`${where}: eyes=${c.parts.eyes} 금지`);
    if (id.darkHead) {
      const v = parseInt(c.palette.skin.slice(1), 16);
      const lum = 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
      if (lum >= 90) violations.push(`${where}: 머리가 어둡지 않다 ${c.palette.skin}`);
    }
    if (id.arms !== undefined || id.tail !== undefined) {
      const limbs = limbSketches(c);
      const hasArms = limbs.some((l) => l.kind === "arm");
      const tail = tailSketch(c);
      const hasTail = !tail.sketch.empty;
      if (id.arms === true && !hasArms) violations.push(`${where}: 팔이 없다`);
      if (id.arms === false && hasArms) violations.push(`${where}: 팔이 있다`);
      if (id.tail === true && !hasTail) violations.push(`${where}: 꼬리가 없다`);
      if (id.tail === false && hasTail) violations.push(`${where}: 꼬리가 있다`);
      const legs = limbs.filter((l) => l.kind === "leg").length;
      if (id.skeleton === "quad" && legs !== 4) violations.push(`${where}: 다리 ${legs}개 (네발)`);
      if (id.skeleton === "biped" && legs !== 2) violations.push(`${where}: 다리 ${legs}개 (두발)`);
    }
  }
}

if (checkOnly) {
  if (violations.length) {
    console.log(`정체성 위반 ${violations.length}건`);
    for (const v of violations.slice(0, 30)) console.log("  " + v);
    process.exit(1);
  }
  console.log(`정체성 위반 0건 (${BOARDS}판 ${Object.values(bySpecies).flat().length}마리)`);
  process.exit(0);
}

// ── 분포표 ──
const pad = (s, n) => String(s).padEnd(n);
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

console.log(`표본: ${BOARDS}판 · ` + speciesNames.map((n) => `${n} ${(bySpecies[n] || []).length}`).join(" · "));
console.log();

const slots = onlySlot ? [onlySlot] : Object.keys(SLOTS);
for (const slot of slots) {
  const values = SLOTS[slot];
  if (!values) { console.log(`슬롯 없음: ${slot}`); continue; }
  console.log(`## ${slot}`);
  console.log(pad("", 10) + speciesNames.map((n) => pad(n, 8)).join(""));
  for (const v of values) {
    const row = speciesNames.map((n) => {
      const list = bySpecies[n] || [];
      const k = list.filter((c) => c.parts[slot] === v).length;
      const p = pct(k, list.length);
      return pad(p === 0 ? "·" : `${p}%`, 8);
    });
    console.log(pad(v, 10) + row.join(""));
  }
  console.log();
}

if (violations.length) {
    console.log(`정체성 위반 ${violations.length}건`);
    for (const v of violations.slice(0, 30)) console.log("  " + v);
    process.exit(1);
  }
  console.log(`정체성 위반 0건 (${BOARDS}판 ${Object.values(bySpecies).flat().length}마리)`);
  process.exit(0);
}

// ── 분포표 ──
const pad = (s, n) => String(s).padEnd(n);
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

console.log(`표본: ${BOARDS}판 · ` + speciesNames.map((n) => `${n} ${(bySpecies[n] || []).length}`).join(" · "));
console.log();

const slots = onlySlot ? [onlySlot] : Object.keys(SLOTS);
for (const slot of slots) {
  const values = SLOTS[slot];
  if (!values) { console.log(`슬롯 없음: ${slot}`); continue; }
  console.log(`## ${slot}`);
  console.log(pad("", 10) + speciesNames.map((n) => pad(n, 8)).join(""));
  for (const v of values) {
    const row = speciesNames.map((n) => {
      const list = bySpecies[n] || [];
      const k = list.filter((c) => c.parts[slot] === v).length;
      const p = pct(k, list.length);
      return pad(p === 0 ? "·" : `${p}%`, 8);
    });
    console.log(pad(v, 10) + row.join(""));
  }
  console.log();
}

// 팔 자세(형태 아님, proportions)
if (!onlySlot || onlySlot === "armRest") {
  console.log("## armRest (자세, proportions)");
  console.log(pad("", 10) + speciesNames.map((n) => pad(n, 8)).join(""));
  for (const v of ["rest", "out", "behind", "up"]) {
    const row = speciesNames.map((n) => {
      const list = bySpecies[n] || [];
      const k = list.filter((c) => c.proportions.armRest === v).length;
      const p = pct(k, list.length);
      return pad(p === 0 ? "·" : `${p}%`, 8);
    });
    console.log(pad(v, 10) + row.join(""));
  }
  console.log();
}

if (violations.length) {
  console.log(`⚠ 정체성 위반 ${violations.length}건`);
  for (const v of violations.slice(0, 20)) console.log("  " + v);
} else {
  console.log("정체성 위반 0건");
}
