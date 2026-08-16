// 아키타입 — 성향. 문서: guidelines/character-types.md

// 아키타입. 순수 랜덤 조합은 금방 "아까 본 것"처럼 보인다.
// 성향을 먼저 뽑고 그 안에서 변주해야 35마리가 서로 달라 보인다.
export const ARCHETYPES = [
  {
    name: "beast",
    weight: 3,
    bias: {
      horns: [["curved", 4], ["straight", 3], ["nub", 2], ["none", 1]],
      ears: [["pointy", 3], ["flap", 2], ["round", 2], ["none", 1]],
      mouth: [["teeth", 4], ["wave", 2], ["open", 2], ["line", 1]],
      nose: [["wedge", 3], ["hook", 2], ["dot", 2], ["none", 1]],
      hair: [["spikes", 3], ["mop", 2], ["mohawk", 2], ["tuft", 2], ["none", 2]],
      head: [["round", 3], ["wide", 2], ["square", 2], ["pear", 1]]
    }
  },
  {
    name: "scholar",
    weight: 2,
    bias: {
      eyewear: [["glasses", 5], ["monocle", 2], ["goggles", 1], ["none", 1]],
      eyes: [["dot", 3], ["half", 2], ["sleepy", 2], ["ring", 1]],
      hair: [["bob", 3], ["wisp", 2], ["curly", 2], ["sweep", 2], ["none", 2]],
      headgear: [["none", 4], ["beret", 3], ["bonnet", 1], ["cap", 1]],
      mouth: [["line", 3], ["dot", 2], ["smile", 2]],
      nose: [["long", 3], ["hook", 3], ["dot", 1]],
      horns: [["none", 6], ["nub", 1]]
    }
  },
  {
    name: "trooper",
    weight: 3,
    bias: {
      headgear: [["helmet", 4], ["cap", 3], ["band", 2], ["pot", 2], ["none", 1]],
      eyewear: [["patch", 3], ["goggles", 3], ["none", 3]],
      head: [["square", 3], ["block", 2], ["round", 2], ["wide", 1]],
      hair: [["scribble", 3], ["mohawk", 1.5], ["spikes", 2], ["none", 2]],
      marks: [["stripes", 3], ["patch", 2], ["hatch", 2], ["none", 2]],
      arms: [["sleeve", 3], ["stick", 2]],
      legs: [["boots", 4], ["stick", 2], ["stub", 1]]
    }
  },
  {
    name: "sprite",
    weight: 3,
    bias: {
      horns: [["antenna", 5], ["nub", 2], ["none", 2]],
      eyes: [["wide", 4], ["ring", 3], ["spiral", 2]],
      head: [["tall", 3], ["round", 3], ["egg", 2], ["pear", 1]],
      body: [["tube", 3], ["bean", 2]],
      legs: [["stick", 3], ["tiptoe", 2], ["bent", 2]],
      arms: [["stick", 3], ["mitten", 2]],
      armLength: [["long", 3], ["verylong", 2], ["medium", 2]],
      hair: [["none", 2], ["wisp", 2], ["tuft", 1.5], ["pigtails", 2], ["curly", 1], ["spikes", 1]],
      nose: [["none", 4], ["dot", 3], ["hook", 1]]
    }
  },
  {
    name: "blob",
    weight: 2,
    bias: {
      head: [["wide", 4], ["round", 3], ["pear", 2]],
      hair: [["none", 3], ["tuft", 2], ["mop", 1]],
      eyes: [["dot", 3], ["ring", 3], ["half", 2]],
      body: [["bean", 4], ["dress", 2]],
      legs: [["stub", 4], ["wide", 2], ["stick", 1]],
      arms: [["stubby", 4], ["stick", 1]],
      armLength: [["medium", 3], ["long", 1]],
      horns: [["none", 5], ["nub", 2]]
    }
  },
  {
    name: "wanderer",
    weight: 2,
    bias: {
      headgear: [["band", 3], ["pot", 1], ["cap", 1], ["none", 5]],
      hair: [["scribble", 3], ["mop", 2], ["curly", 2], ["none", 2], ["wisp", 1]],
      eyes: [["half", 3], ["sleepy", 3], ["cross", 2], ["ring", 2]],
      marks: [["hatch", 3], ["stripes", 2], ["patch", 2], ["none", 2]],
      mouth: [["wave", 3], ["line", 2], ["dot", 2]],
      body: [["dress", 3], ["bean", 2]]
    }
  }
];
