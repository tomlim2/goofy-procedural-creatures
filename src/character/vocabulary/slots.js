// 파츠 어휘. 여기는 "무엇이 있는가"만 정의한다. 고르는 규칙은 ../creature.js,
// 그리는 일은 ../draw/가 한다. 셋을 섞지 않는다.
// 문서: guidelines/parts-catalog.md

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
  // 팔 형태. 자세(늘어짐·벌림·들기·뒷짐)는 여기 없다 — 그건 clocks.js의 모션이다.
  arms: ["stick", "sleeve", "stubby", "mitten"],
  // 팔 길이. 형태와 독립이라 짧은 소매 팔, 매우 긴 장갑 팔이 다 나온다.
  armLength: ["medium", "long", "verylong"]
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
  arms: [["stick", 3], ["sleeve", 3], ["mitten", 2], ["stubby", 2]],
  armLength: [["medium", 4], ["long", 2.5], ["verylong", 1]],
  legs: [["stick", 3], ["boots", 3], ["stub", 2], ["bent", 2], ["wide", 1.5], ["tiptoe", 1]]
};
