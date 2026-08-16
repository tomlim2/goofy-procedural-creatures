// 종족 — 골격. 문서: guidelines/character-types.md

// 종족. 아키타입이 "성향"이라면 종족은 "골격"이다. 줄 단위로 정해져서
// 한 판에 사람 줄, 개 줄, 고양이 줄, 도깨비 줄이 섞인다.
// bias는 아키타입보다 우선한다. 골격이 성향보다 먼저다.
export const SPECIES = [
  {
    name: "kid",
    weight: 5,
    // 사람에게 뿔·더듬이는 없다. 종족 bias가 아키타입(beast의 뿔, sprite의 더듬이)보다
    // 우선이므로 여기서 막으면 kid 줄에는 절대 안 나온다. 그 성향들은 imp 줄에서 산다.
    bias: {
      horns: [["none", 1]]
    }
  },
  {
    name: "pup",
    weight: 2,
    bias: {
      ears: [["flap", 4], ["long", 4], ["round", 1], ["fold", 1]],
      horns: [["none", 8], ["nub", 1]],
      hair: [["none", 5], ["tuft", 2], ["wisp", 1]],
      headgear: [["none", 8], ["cap", 1]],
      eyewear: [["none", 6], ["patch", 2], ["glasses", 1]],
      nose: [["dot", 4], ["wedge", 2], ["hook", 1]],
      eyes: [["dot", 3], ["ring", 3], ["half", 2], ["wide", 2], ["sleepy", 1]],
      marks: [["none", 3], ["stripes", 2], ["patch", 2], ["spots", 2], ["dots", 1]],
      tail: [["flag", 4], ["stubtail", 3], ["longtail", 2], ["curl", 1]],
      face2: [["none", 5], ["blush", 1]]
    }
  },
  {
    name: "cat",
    weight: 2,
    bias: {
      ears: [["pointy", 5], ["fold", 2], ["round", 1]],
      horns: [["none", 1]],
      hair: [["none", 6], ["tuft", 1]],
      headgear: [["none", 1]],
      eyewear: [["none", 6], ["patch", 2], ["monocle", 1]],
      nose: [["dot", 5], ["none", 2]],
      eyes: [["half", 3], ["sleepy", 3], ["slit", 3], ["cross", 2], ["wide", 2], ["dot", 1]],
      mouth: [["omega", 4], ["line", 2], ["dot", 2], ["wave", 1], ["smile", 1]],
      marks: [["none", 3], ["patch", 3], ["stripes", 2], ["spots", 1]],
      tail: [["curl", 4], ["longtail", 3], ["flag", 2], ["stubtail", 1]],
      face2: [["none", 5], ["blush", 1], ["freckles", 1]]
    }
  },
  {
    name: "imp",
    weight: 2,
    bias: {
      horns: [["curved", 3], ["straight", 2], ["antenna", 2], ["ram", 2], ["crown", 2], ["nub", 1]],
      ears: [["none", 5], ["pointy", 2]],
      hair: [["none", 6], ["spikes", 2]],
      headgear: [["none", 1]],
      eyewear: [["none", 6], ["patch", 2], ["goggles", 1]],
      eyes: [["ring", 3], ["wide", 3], ["cyclops", 2], ["spiral", 2], ["cross", 2]],
      nose: [["none", 4], ["dot", 2]],
      mouth: [["teeth", 3], ["zigzag", 3], ["wave", 2], ["open", 2], ["line", 1]],
      marks: [["stripes", 3], ["none", 2], ["hatch", 1]],
      face2: [["none", 6], ["tears", 1]],
      body: [["bean", 3], ["box", 1]],
      brow: [["none", 3], ["flat", 2], ["angry", 2]],
      arms: [["stubby", 5], ["stick", 2]],
      armLength: [["short", 3], ["medium", 2], ["long", 1]],
      legs: [["stub", 3], ["stick", 3], ["wide", 1]]
    }
  }
];
