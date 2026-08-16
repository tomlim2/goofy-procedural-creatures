// 파츠 어휘. 여기는 "무엇이 있는가"만 정의하고, 고르는 규칙은 creature.js,
// 실제 선을 긋는 일은 draw.js가 한다. 셋을 섞지 않는다.

// 슬롯별 선택지. 이름은 draw.js의 그리기 함수 키와 1:1로 맞춘다.
export const SLOTS = {
  head: ["round", "square", "tall", "pear", "wide", "egg", "block"],
  eyes: ["ring", "dot", "wide", "sleepy", "spiral", "cross", "half", "slit", "cyclops"],
  brow: ["none", "flat", "angry", "worry"],
  eyewear: ["none", "glasses", "goggles", "patch", "monocle"],
  // 헤어는 면을 칠하지 않고 펜으로 왕복해 긋는 스크리블로 그린다.
  hair: ["none", "bob", "spikes", "mop", "mohawk", "tuft", "wisp", "scribble", "sweep", "pigtails", "curly"],
  headgear: ["none", "helmet", "cap", "band", "pot", "beret", "bonnet"],
  horns: ["none", "curved", "straight", "antenna", "nub", "ram", "crown"],
  ears: ["none", "round", "pointy", "flap", "long", "fold"],
  nose: ["hook", "dot", "wedge", "long", "none"],
  // 볼·눈가 디테일. 레퍼런스의 눈물 자국과 볼터치.
  face2: ["none", "tears", "blush", "freckles"],
  mouth: ["dot", "line", "teeth", "open", "wave", "smile", "pout", "omega", "zigzag"],
  body: ["bean", "box", "dress", "tube"],
  marks: ["none", "stripes", "dots", "patch", "hatch", "spots"],
  // 다리 유형. 레퍼런스: 전부 끝에 동그란 발이 있고 몸 밑에서 나온다.
  legs: ["stick", "stub", "bent", "boots", "wide", "tiptoe"],
  // 네발 종족 전용. 두발 종족은 그리지 않는다.
  tail: ["curl", "flag", "longtail", "stubtail"],
  // 팔 유형. 레퍼런스: 뒷짐·소매+동그란 손·스텁+주먹·늘어진 막대·벌림.
  arms: ["down", "out", "up", "behind", "sleeve", "stubby", "mitten"]
};

// 아키타입 bias가 없는 슬롯의 기본 가중치.
//
// 이게 없으면 슬롯 안에서 균등 추첨이 되는데, 그러면 선택지가 5개인 eyewear는
// 80%가 무언가를 쓰고, 선택지가 9개인 hair는 눈에 띄는 종류가 거의 안 나온다.
// "없음"이 흔해야 하는 슬롯과 흔하면 안 되는 슬롯을 여기서 가른다.
export const DEFAULT_BIAS = {
  hair: [["none", 3], ["bob", 2], ["mop", 2], ["scribble", 2], ["sweep", 2], ["spikes", 2], ["tuft", 2], ["wisp", 2], ["pigtails", 1.5], ["curly", 1.5], ["mohawk", 1]],
  headgear: [["none", 6], ["cap", 2], ["band", 2], ["beret", 2], ["bonnet", 1.5], ["helmet", 1], ["pot", 1]],
  eyewear: [["none", 5], ["glasses", 2], ["patch", 2], ["goggles", 1], ["monocle", 1]],
  ears: [["none", 4], ["round", 2], ["pointy", 2], ["flap", 1], ["fold", 1]],
  brow: [["none", 2], ["flat", 2], ["angry", 1], ["worry", 1]],
  marks: [["none", 4], ["stripes", 2], ["hatch", 2], ["dots", 2], ["patch", 1], ["spots", 1]],
  nose: [["hook", 3], ["dot", 2], ["wedge", 2], ["none", 2], ["long", 1]],
  face2: [["none", 5], ["blush", 2], ["freckles", 2], ["tears", 1.5]],
  horns: [["none", 5], ["curved", 2], ["straight", 2], ["antenna", 2], ["nub", 2]],
  tail: [["curl", 3], ["flag", 3], ["longtail", 2], ["stubtail", 2]],
  arms: [["down", 3], ["out", 2], ["sleeve", 3], ["mitten", 2], ["stubby", 2], ["behind", 2], ["up", 1]],
  legs: [["stick", 3], ["boots", 3], ["stub", 2], ["bent", 2], ["wide", 1.5], ["tiptoe", 1]]
};

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
      hair: [["spikes", 3], ["mop", 2], ["tuft", 2], ["none", 2]],
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
      hair: [["scribble", 3], ["spikes", 2], ["none", 3]],
      marks: [["stripes", 3], ["patch", 2], ["hatch", 2], ["none", 2]],
      arms: [["down", 3], ["sleeve", 3], ["out", 1]],
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
      arms: [["down", 3], ["mitten", 2], ["out", 2]],
      hair: [["none", 2], ["wisp", 2], ["tuft", 2], ["pigtails", 1], ["spikes", 1]],
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
      arms: [["stubby", 4], ["behind", 2], ["down", 1]],
      horns: [["none", 5], ["nub", 2]]
    }
  },
  {
    name: "wanderer",
    weight: 2,
    bias: {
      headgear: [["band", 4], ["pot", 2], ["cap", 2], ["none", 3]],
      eyes: [["half", 3], ["sleepy", 3], ["cross", 2], ["ring", 2]],
      marks: [["hatch", 3], ["stripes", 2], ["patch", 2], ["none", 2]],
      mouth: [["wave", 3], ["line", 2], ["dot", 2]],
      body: [["dress", 3], ["bean", 2]]
    }
  }
];

// 종이 위에서 성립하는 색만 쓴다. 채도를 올리면 손그림 느낌이 바로 깨진다.
export const PAPER = "#efe9dd";

export const INKS = ["#2b2724", "#3a3430", "#252220", "#443c34"];

export const FILLS = [
  "#e8d5c4", // 살구
  "#d9d2c7", // 회백
  "#cdbfa8", // 탄
  "#e3c9c6", // 분홍
  "#c3c7c2", // 청회
  "#ddd0b0", // 모래
  "#c9b8a8"  // 갈회
];

// 색 포인트. 거의 모노톤인 판에 한두 개만 섞이는 채도 있는 색.
// 한 판에 몇 개까지 허용할지는 creature.js의 makeGrid가 통제한다.
export const POPS = ["#4a6fa5", "#5c7a3f", "#b0432e", "#c8871e", "#8a4b2a"];

export const ACCENTS = [
  "#8a7f72",
  "#6f7a72",
  "#8d7168",
  "#7a7686"
];

// 종족. 아키타입이 "성향"이라면 종족은 "골격"이다. 줄 단위로 정해져서
// 한 판에 사람 줄, 개 줄, 고양이 줄, 도깨비 줄이 섞인다.
// bias는 아키타입보다 우선한다. 골격이 성향보다 먼저다.
export const SPECIES = [
  { name: "kid", weight: 5, bias: {} },
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
      arms: [["stubby", 5], ["down", 2], ["out", 1]],
      legs: [["stub", 3], ["stick", 3], ["wide", 1]]
    }
  }
];
