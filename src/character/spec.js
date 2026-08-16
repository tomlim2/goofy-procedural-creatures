// 시드 → 크리처 스펙. 이 랩의 승부처.
//
// 슬롯을 그냥 균등 랜덤으로 뽑으면 서른 마리쯤에서 "아까 본 것"이 나온다.
// 그래서 세 층을 겹친다.
//   1. 아키타입   — 성향을 먼저 정하고 그 안에서 고른다
//   2. 제약       — 같이 나올 수 없는 조합을 걷어낸다
//   3. 비율 지터  — 실루엣 다양성의 대부분은 연속값에서 나온다

import { makeRng } from "../rng.js";
import { SLOTS, ARCHETYPES, SPECIES, DEFAULT_BIAS, FILLS, INKS, ACCENTS, POPS } from "./vocabulary/index.js";

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
function applyConstraints(parts, rng) {
  // 헬멧과 항아리는 머리를 덮는다. 머리카락이 비집고 나올 자리가 없다.
  if (parts.headgear === "helmet" || parts.headgear === "pot") {
    parts.hair = "none";
  } else if (parts.headgear !== "none" && parts.hair !== "none") {
    // 모자나 밴드면 짧은 머리만 남긴다.
    const short = ["bob", "wisp", "sweep", "tuft"];
    if (!short.includes(parts.hair)) parts.hair = rng.pick(short);
  }

  // 모히칸은 무엇도 쓰지 않는다.
  if (parts.hair === "mohawk") parts.headgear = "none";

  // 더듬이가 있으면 귀까지 달지 않는다. 실루엣이 지저분해진다.
  if (parts.horns === "antenna" && rng.chance(0.75)) parts.ears = "none";

  // 안대는 한쪽 눈을 가린다. 어느 쪽인지 여기서 정해 둔다.
  // 외눈의 side가 0이라, 안대 없음의 센티널은 0이면 안 된다.
  parts.patchSide = parts.eyewear === "patch" ? (rng.chance(0.5) ? -1 : 1) : 99;

  // 감은 눈에 화난 눈썹을 붙이면 표정이 읽히지 않는다.
  if (parts.eyes === "sleepy" && parts.brow === "angry") parts.brow = "flat";

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
function makeProportions(rng, archetype) {
  const sprite = archetype.name === "sprite";
  const blob = archetype.name === "blob";

  return {
    headScale: rng.around(blob ? 1.14 : sprite ? 0.96 : 1.04, 0.34),
    headWide: rng.around(blob ? 1.16 : 1, 0.18),

    // 머리 외곽선을 얼마나 찌그러뜨릴지. 0이면 도형, 크면 손으로 그린 덩어리.
    headLumps: rng.int(4, 7),
    headLump: rng.around(0.07, 0.045),

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
    armRest: rng.weighted([["rest", 5], ["out", 2], ["behind", 2], ["up", 0.5]]),

    // 개체마다 손떨림 정도가 다르다. 어떤 놈은 반듯하고 어떤 놈은 엉망이다.
    wobble: rng.around(1, 0.55),
    wobbleSeed: rng.int(0, 100000)
  };
}

export function makeCreature(seed, speciesName = "kid") {
  const rng = makeRng(seed);
  const species = SPECIES.find((s) => s.name === speciesName) || SPECIES[0];
  const archetype = pickArchetype(rng);

  const parts = {};
  for (const slot of Object.keys(SLOTS)) {
    parts[slot] = pickSlot(rng, species, archetype, slot);
  }
  applyConstraints(parts, rng);

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

  if (species.name === "imp") {
    // 도깨비 머리는 먹빛, 얼굴은 종이색. 몸은 레퍼런스처럼 밝은 줄무늬도 나오도록
    // 절반만 먹빛으로 둔다. rng 호출 수는 조건과 무관하게 고정한다.
    const darkBody = rng.next() < 0.5;
    palette.skin = palette.ink;
    if (darkBody) palette.cloth = palette.ink;
  } else {
    rng.next();
  }

  // 색 포인트. 호출 수를 고정하기 위해 무조건 두 번 뽑고 나서 판정한다.
  const popRoll = rng.next();
  const popTarget = rng.pick(["hair", "headgear", "skin"]);
  palette.pop = popRoll < 0.14 ? { color: POPS[Math.floor(popRoll / 0.14 * POPS.length) % POPS.length], target: popTarget } : null;
  if (palette.pop && palette.pop.target === "skin") {
    // 도깨비 머리는 먹빛이라 피부 포인트가 무의미하다.
    if (species.name === "imp") palette.pop = null;
    else palette.skin = palette.pop.color;
  }

  const proportions = makeProportions(rng, archetype);
  // 매우 긴 팔을 늘어뜨리면 바닥을 뚫는다. 쉼 자세를 벌림으로 고정한다.
  if (parts.armLength === "verylong" && proportions.armRest === "rest") proportions.armRest = "out";

  return {
    seed,
    species: species.name,
    archetype: archetype.name,
    parts,
    proportions,
    palette,
    faceInk: species.name === "imp" ? "#e9e3d5" : null
  };
}

// 그리드용 시드 배치.
//
// 시드를 그냥 base+0, base+1... 로 주면 아키타입이 뭉쳐서 한 줄이 통째로
// 비슷해 보이는 일이 생긴다. 미리 만들어 보고 이웃과 겹치면 다시 뽑는다.
export function makeGrid(baseSeed, count, columns) {
  const creatures = [];
  const rows = Math.ceil(count / columns);

  // 줄마다 종족을 정한다. 바로 윗줄과 같으면 한 번만 다시 뽑는다.
  // 사람(kid)은 흔해서 연속 두 줄이 나와도 자연스럽다.
  const rowRng = makeRng((baseSeed ^ 0x51ed270b) >>> 0);
  const rowSpecies = [];
  for (let r = 0; r < rows; r += 1) {
    let pick = rowRng.weighted(SPECIES.map((s) => [s, s.weight]));
    if (r > 0 && pick.name === rowSpecies[r - 1]) {
      pick = rowRng.weighted(SPECIES.map((s) => [s, s.weight]));
    }
    rowSpecies.push(pick.name);
  }

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
