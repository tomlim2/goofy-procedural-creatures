// 시드 → 크리처 스펙. 이 랩의 승부처.
//
// 슬롯을 그냥 균등 랜덤으로 뽑으면 서른 마리쯤에서 "아까 본 것"이 나온다.
// 그래서 세 층을 겹친다.
//   1. 아키타입   — 성향을 먼저 정하고 그 안에서 고른다
//   2. 제약       — 같이 나올 수 없는 조합을 걷어낸다
//   3. 비율 지터  — 실루엣 다양성의 대부분은 연속값에서 나온다

import { makeRng } from "../rng.js";
import { SLOTS, LATE_SLOTS, ARCHETYPES, SPECIES, DEFAULT_BIAS, FILLS, INKS, ACCENTS, POPS, DARKS, FUR_POOL } from "./vocabulary/index.js";
import { shade, luminance } from "../color.js";
import { layout, eyeGeometry } from "./draw/layout.js";
import { LENS_SCALE } from "./draw/face.js";

function pickArchetype(rng) {
  return rng.weighted(ARCHETYPES.map((a) => [a, a.weight]));
}

// 종족 골격 > 아키타입 성향 > 기본 가중치 > 균등. 네 단계로 내려간다.
function pickSlot(rng, species, archetype, slot) {
  const bias = species.bias[slot] || archetype.bias[slot] || DEFAULT_BIAS[slot];
  if (bias) return rng.weighted(bias);
  return rng.pick(SLOTS[slot]);
}

// 같이 나오면 그림이 깨지는 조합을 정리한다.
// 랜덤을 다시 굴리지 않고 결정적으로 덮어써야 시드 재현이 유지된다.
// 종족 금지표. species.js의 forbid를 읽어 결정적으로 덮어쓴다(rng 없음).
// "사람에게 뿔 없음", "외눈은 도깨비만" 같은 제한은 전부 거기 있다 — 여기 하드코딩하지 않는다.
function applyForbid(parts, speciesName) {
  const forbid = (SPECIES.find((s) => s.name === speciesName) || {}).forbid || {};
  for (const [slot, table] of Object.entries(forbid)) {
    if (table[parts[slot]] !== undefined) parts[slot] = table[parts[slot]];
  }
}

function applyConstraints(parts, rng, speciesName) {
  // 종족 금지표를 가장 먼저 적용한다. 맨 앞이어야 뒤의 제약(더듬이→귀 제거 등)이
  // 금지된 값을 보고 오작동하지 않는다.
  applyForbid(parts, speciesName);

  // 헬멧과 항아리는 머리를 덮는다. 머리카락이 비집고 나올 자리가 없다.
  if (parts.headgear === "helmet" || parts.headgear === "pot") {
    parts.hair = "none";
  } else if (parts.headgear !== "none" && parts.hair !== "none") {
    // 모자나 밴드면 짧은 머리만 남긴다 (앞머리·옆단발·두건형은 모자 밑으로 나와도 된다). 밴드는 구름형·고슴도치와도 어울린다(레퍼런스)
    const short = ["bob", "wisp", "sweep", "tuft", "scribble", "curly", "bangs", "longbob", "helmet", "long", "verylong", "twintails", "twintailsBall", "ponytail"];   // 뒷머리는 모자 밑으로 나온다
    if (parts.headgear === "band") short.push("cloud", "hedgehog");
    if (!short.includes(parts.hair)) parts.hair = rng.pick(short);
  }

  // 모히칸·똥머리는 무엇도 쓰지 않는다.
  if (parts.hair === "mohawk" || parts.hair === "bun" || parts.hair === "apple" || parts.hair === "appleBig") parts.headgear = "none";

  // 더듬이가 있으면 귀까지 달지 않는다. 실루엣이 지저분해진다.
  if (parts.horns === "antenna" && rng.chance(0.75)) parts.ears = "none";

  // 안대는 한쪽 눈을 가린다. 어느 쪽인지 여기서 정해 둔다.
  // 외눈의 side가 0이라, 안대 없음의 센티널은 0이면 안 된다.
  parts.patchSide = parts.eyewear === "patch" ? (rng.chance(0.5) ? -1 : 1) : 99;

  // 감은 눈에 화난 눈썹을 붙이면 표정이 읽히지 않는다.
  if (["sleepy", "happy", "squeeze", "droop"].includes(parts.eyes) && parts.brow === "angry") parts.brow = "flat";

  // 외눈에는 안경류가 성립하지 않는다.
  if (parts.eyes === "cyclops") parts.eyewear = "none";

  // 왕관 뿔은 정수리를 차지한다.
  if (parts.horns === "crown") {
    parts.headgear = "none";
    if (!["none", "tuft"].includes(parts.hair)) parts.hair = "none";
  }

  // 안경류는 눈 위에 겹치므로 눈썹을 자주 가린다.
  if ((parts.eyewear === "glasses" || parts.eyewear === "goggles") && rng.chance(0.6)) {
    parts.brow = "none";
  }

  return parts;
}

// 실루엣을 가르는 연속값들. 파츠 조합보다 이쪽이 다양성에 더 크게 기여한다.
function makeProportions(rng, archetype, species) {
  const sprite = archetype.name === "sprite";
  const blob = archetype.name === "blob";
  const human = species === "human";

  return {
    headScale: rng.around(blob ? 1.14 : sprite ? 0.96 : 1.04, 0.34),
    headWide: rng.around(blob ? 1.16 : 1, 0.18),

    // 머리 외곽선을 얼마나 찌그러뜨릴지. 0이면 도형, 크면 손으로 그린 덩어리.
    // 사람 두상은 매끄럽되 손그림 떨림은 남긴다 — 혹을 절반으로(울퉁불퉁한 건 도깨비·동물). rng 호출 수는 같다 (배율만)
    headLumps: rng.int(4, 7),
    headLump: rng.around(0.07, 0.045) * (human ? 0.5 : 1),

    eyeSize: rng.around(sprite ? 0.24 : 0.17, 0.07),
    eyeGap: rng.around(0.42, 0.12),
    eyeHeight: rng.around(0.03, 0.09),

    // 좌우 비대칭. 손그림처럼 보이게 하는 가장 값싼 장치다.
    eyeSizeSkew: rng.around(0, 0.22),
    eyeHeightSkew: rng.around(0, 0.05),

    noseDrop: rng.around(0.1, 0.06),
    mouthDrop: rng.around(0.3, 0.07),

    bodyScale: rng.around(0.52, 0.12),
    bodyWide: rng.around(1, 0.2),
    legLength: rng.around(0.3, 0.12),
    armSpread: rng.around(1, 0.25),

    // 네발 종족용. 두발 종족도 값은 뽑아 둔다. 종족에 따라 rng 호출 수가
    // 달라지면 시드 재현이 꼬인다.
    bodyLen: rng.around(1, 0.2),
    tailLift: rng.around(0, 1),

    // 팔의 쉼 자세. 형태(arms 슬롯)와 별개다. 개체가 어떤 자세를 기본으로
    // 두는지 — 대부분 늘어뜨리고, 일부는 벌리거나 뒷짐진 채 쉰다.


    // 개체마다 손떨림 정도가 다르다. 어떤 놈은 반듯하고 어떤 놈은 엉망이다.
    wobble: rng.around(1, 0.55),
    wobbleSeed: rng.int(0, 100000)
  };
}

export function makeCreature(seed, speciesName = "human") {
  const rng = makeRng(seed);
  const species = SPECIES.find((s) => s.name === speciesName) || SPECIES[0];
  const archetype = pickArchetype(rng);

  const parts = {};
  for (const slot of Object.keys(SLOTS)) {
    if (LATE_SLOTS.includes(slot)) continue;   // 맨 끝에 뽑는다 (아래)
    parts[slot] = pickSlot(rng, species, archetype, slot);
  }
  applyConstraints(parts, rng, species.name);

  const skin = rng.pick(FILLS);
  const palette = {
    ink: rng.pick(INKS),
    skin,
    // 옷은 피부와 다른 색이어야 몸이 읽힌다.
    cloth: rng.pick(FILLS.filter((c) => c !== skin)),
    accent: rng.pick(ACCENTS),
    // 채색은 선 밖으로 삐져나간다. 인쇄가 어긋난 것처럼.
    fillOffset: [rng.around(0, 0.035), rng.around(0, 0.035)]
  };

  // 도깨비 머리색과 몸 색 추첨. rng 호출 수는 종족과 무관하게 고정한다 (판정은 아래).
  const darkHead = rng.pick(DARKS);
  const bodyRoll = rng.next();
  // 검정 계열 털 — 개·고양이만. 주머니에 null이 섞여 있어 이 한 번의 pick이 "검정 털이냐"와 "어느 검정이냐"를 같이 정한다 (약 1/3)
  const darkFur = rng.pick(FUR_POOL);

  // 색 포인트. 호출 수를 고정하기 위해 무조건 두 번 뽑고 나서 판정한다.
  const popRoll = rng.next();
  const popTarget = rng.pick(["hair", "headgear", "skin"]);
  palette.pop = popRoll < 0.14 ? { color: POPS[Math.floor(popRoll / 0.14 * POPS.length) % POPS.length], target: popTarget } : null;
  if (palette.pop && palette.pop.target === "skin") {
    // 도깨비 머리는 먹빛이라 피부 포인트가 무의미하다.
    if (species.name === "imp") palette.pop = null;
    else palette.skin = palette.pop.color;
  }

  // 몸 색. 사람은 옷이라 피부와 다른 색이지만, 개·고양이는 털이고 도깨비는 덩어리라 몸이 머리와
  // **같거나 비슷한 색**이어야 한 몸으로 읽힌다. (색 포인트가 머리에 붙은 뒤에 정한다 — 몸이 따라가게)
  if (species.name === "imp") {
    // 도깨비: 머리는 DARKS 9색 중 하나(먹·회갈·회청·자흑…). 몸은 머리색 그대로 절반, 나머지는 같은 계열의 톤
    palette.skin = darkHead;
    if (bodyRoll < 0.5) palette.cloth = darkHead;
    else if (bodyRoll < 0.8) palette.cloth = shade(darkHead, 1.35);   // 조금 밝은 톤
    else palette.cloth = shade(darkHead, 0.75);                        // 조금 어두운 톤
    // 잉크는 머리보다 더 어둡게 — 윤곽이 머리에 묻히지 않도록
    palette.ink = "#1c1917";
  } else if (species.name === "pup" || species.name === "cat") {
    // 검정 계열 털(약 1/3) — 색 포인트가 피부에 붙은 개체는 그대로 둔다 (포인트가 이기는 게 판에서 더 눈에 띈다).
    // 삼색 얼룩(marks calico)은 **밝은 바탕**이어야 얼룩이 읽히니 검정 털을 안 입힌다 (판정만 — rng 호출은 그대로)
    if (darkFur && !(palette.pop && palette.pop.target === "skin") && parts.marks !== "calico") palette.skin = darkFur;
    // 개·고양이: 몸은 머리(털)색 그대로 절반, 나머지는 같은 계열의 톤
    if (bodyRoll < 0.5) palette.cloth = palette.skin;
    else if (bodyRoll < 0.8) palette.cloth = shade(palette.skin, 0.9);   // 조금 어두운 톤
    else palette.cloth = shade(palette.skin, 1.06);                       // 조금 밝은 톤
  }

  const proportions = makeProportions(rng, archetype, species.name);

  // 뒤늦게 붙인 슬롯. 여기서 뽑아야 앞선 파츠·색·비율의 시드가 유지된다 (slots.js LATE_SLOTS).
  // 종족 forbid는 다시 한 번 — 이 슬롯들에도 적용되게.
  for (const slot of LATE_SLOTS) parts[slot] = pickSlot(rng, species, archetype, slot);
  applyForbid(parts, species.name);

  // 눈 자리가 정해진 뒤(비율·마지막 슬롯까지 뽑힌 뒤)에야 알 수 있는 안경류 제약 — 결정적으로 덮어쓴다 (rng 없음)
  const eyes = eyeGeometry({ species: species.name, parts, proportions }, layout({ species: species.name, parts, proportions }));
  const hadPatch = parts.eyewear === "patch";
  if (eyes.length === 2) {
    const [a, b] = eyes;
    const gap = Math.hypot(b.x - a.x, b.y - a.y);
    // 안경·고글은 두 알이 겹치면(눈이 가까우면) 뺀다 — 겹친 안경테는 실수처럼 보인다. 눈에 맞춰 억지로 줄이지 않는다
    if ((parts.eyewear === "glasses" || parts.eyewear === "goggles") && gap < (a.r + b.r) * LENS_SCALE[parts.eyewear] * 1.02) parts.eyewear = "none";
    // 안대는 **눈이 겹치는 개체에 안 씌운다** — 안대(눈 1.5배)가 다른 눈 위에 걸치면 실수처럼 보인다
    if (parts.eyewear === "patch") {
      const covered = eyes.find((e) => e.side === parts.patchSide) || a;
      const other = covered === a ? b : a;
      if (gap < covered.r * 1.5 + other.r + 0.004) parts.eyewear = "none";
    }
  }
  // 짝눈(좌우 크기·높이가 눈에 띄게 다른 눈)에는 안대를 안 씌운다 — 한쪽을 가리면 남은 눈이 혼자 크거나 높아서 실수처럼 보인다
  if (parts.eyewear === "patch" && (Math.abs(proportions.eyeSizeSkew) > 0.09 || Math.abs(proportions.eyeHeightSkew) > 0.03)) parts.eyewear = "none";
  // 여기서 안대가 빠졌으면 patchSide도 지운다 (눈·눈썹이 그쪽을 건너뛰지 않게)
  if (hadPatch && parts.eyewear !== "patch") parts.patchSide = 99;

  return {
    seed,
    species: species.name,
    archetype: archetype.name,
    parts,
    proportions,
    palette,
    // 얼굴 잉크 — 머리색이 어두우면(도깨비 먹빛, 색 포인트 파랑·초록·붉은 갈색 피부: 휘도 < 120) 검정 대신 밝은 잉크로 이목구비를 그린다.
    // 안 그러면 짙은 색 위에 검정 선이 묻혀 눈·입이 안 읽힌다
    faceInk: species.name === "imp" || luminance(palette.skin) < 120 ? "#e9e3d5" : null
  };
}

// 그리드용 시드 배치.
//
// 시드를 그냥 base+0, base+1... 로 주면 아키타입이 뭉쳐서 한 줄이 통째로
// 비슷해 보이는 일이 생긴다. 미리 만들어 보고 이웃과 겹치면 다시 뽑는다.
// 고정 레인. 위에서부터 사람·고양이·개·도깨비, 그 아래는 같은 순서로 계속 돈다.
// 행 수별 표를 두지 않는다 — 몇 줄이든 네 종족이 같은 간격으로 돌아 어느 판에서도 종족이 빠지지 않는다.
export const LANES = ["human", "cat", "pup", "imp"];

export function laneSpecies(rows) {
  return Array.from({ length: rows }, (_, r) => LANES[r % LANES.length]);
}

// only에 종족명을 주면 전 줄을 그 종족으로 채운다 — 프리뷰용. 한 종족을 54마리
// 한 판에 놓고 봐야 색·파츠 분포를 판단할 수 있다.
export function makeGrid(baseSeed, count, columns, only = null) {
  const creatures = [];
  const rows = Math.ceil(count / columns);

  // 줄 종족은 고정 레인이다: 위에서부터 사람·고양이·개·도깨비가 줄마다 순서대로 돈다.
  const rowSpecies = only ? Array(rows).fill(only) : laneSpecies(rows);

  for (let i = 0; i < count; i += 1) {
    const species = rowSpecies[Math.floor(i / columns)];
    let candidate = null;

    // 최대 8번까지만 다시 뽑는다. 무한정 고르면 오히려 분포가 치우친다.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      candidate = makeCreature((baseSeed + i * 2654435761 + attempt * 40503) >>> 0, species);
      const left = i % columns === 0 ? null : creatures[i - 1];
      const up = i >= columns ? creatures[i - columns] : null;
      const clash =
        (left && left.archetype === candidate.archetype) ||
        (up && up.archetype === candidate.archetype);
      if (!clash) break;
    }

    creatures.push(candidate);
  }

  // 색 포인트는 한 판에 3개까지. 넘치면 앞에서부터 유지하고 나머지는 끈다.
  let pops = 0;
  for (const creature of creatures) {
    if (!creature.palette.pop) continue;
    pops += 1;
    if (pops > 3) creature.palette.pop = null;
  }

  return creatures;
}
