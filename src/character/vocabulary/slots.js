// 파츠 어휘. 여기는 "무엇이 있는가"만 정의한다. 고르는 규칙은 ../creature.js,
// 그리는 일은 ../draw/가 한다. 셋을 섞지 않는다.
// 문서: guidelines/character/parts.md

// 슬롯별 선택지. 이름은 draw.js의 그리기 함수 키와 1:1로 맞춘다.
export const SLOTS = {
  head: ["round", "square", "tall", "pear", "wide", "egg", "block"],
  eyes: ["ring", "dot", "wide", "sleepy", "spiral", "cross", "half", "slit", "cyclops"],
  brow: ["none", "flat", "angry", "worry"],
  eyewear: ["none", "glasses", "goggles", "patch", "monocle"],
  // 헤어는 면을 칠하지 않고 펜으로 왕복해 긋는 스크리블로 그린다.
  // 레퍼런스 아이 줄: 앞머리 있는 바가지(bangs) · 옆으로 턱까지 내려오는 단발(longbob) · 정수리 똥머리(bun) 포함
  hair: ["none", "bob", "spikes", "mop", "mohawk", "tuft", "wisp", "scribble", "sweep", "pigtails", "curly", "bangs", "longbob", "bun"],
  headgear: ["none", "helmet", "cap", "band", "pot", "beret", "bonnet"],
  horns: ["none", "curved", "straight", "antenna", "nub", "ram", "crown"],
  // round·pointy·fold는 크기 셋 — 기본(작음) · Mid(중간, 1.4배) · Big(큼, 1.8배). 모양은 같고 크기만 다르다.
  // 고양이 정수리 귀, 개 귀, 사람·도깨비 옆귀 다 같은 배율을 쓴다
  ears: ["none", "round", "roundMid", "roundBig", "pointy", "pointyMid", "pointyBig", "flap", "long", "fold", "foldMid", "foldBig"],
  nose: ["hook", "dot", "wedge", "long", "none"],
  // 볼·눈가 디테일. 레퍼런스의 눈물 자국과 볼터치.
  face2: ["none", "tears", "blush", "freckles"],
  mouth: ["dot", "line", "teeth", "open", "wave", "smile", "pout", "omega", "zigzag"],
  body: ["bean", "box", "dress", "tube"],
  marks: ["none", "stripes", "dots", "patch", "hatch", "spots"],
  // 다리 유형(형태만). 레퍼런스: 전부 끝에 동그란 발이 있고 몸 밑에서 나온다.
  // float는 레이맨식 — 다리 없이 발만 떠 있다. 벌린 정도(스탠스)는 여기 없다 —
  // 몸통 체격(build)이 정한다. 네발은 stub·stick·boots·float만 그리고 나머지는 stick으로 본다.
  legs: ["stick", "stub", "bent", "boots", "tiptoe", "float"],
  // 네발 종족 전용. 두발 종족은 그리지 않는다.
  // hook 위로 섰다 끝이 갈고리로 꺾임(고양이) · kink 꺾인 꼬리(고양이) · ring 등 위로 말린 고리(스피츠) · plume 북슬한 깃털 꼬리(채움 + 털 획)
  tail: ["curl", "flag", "longtail", "stubtail", "hook", "kink", "ring", "plume"],
  // 팔 형태. 자세(늘어짐·벌림·들기·뒷짐)는 여기 없다 — 그건 clocks.js의 모션이다.
  arms: ["stick", "sleeve", "stubby", "mitten"],
  // 팔 길이. 형태와 독립이라 짧은 소매 팔, 매우 긴 장갑 팔이 다 나온다.
  armLength: ["medium", "long"],
  // 다리 길이(기장). 형태와 독립 — 모든 다리 유형에 세 기장이 있다. 스케일이 아니라 기장만 바뀐다:
  // 몸이 바닥 가까이 내려앉고 발·굵기는 그대로다. 네발도 따른다 (short = 닥스훈트).
  legLength: ["long", "medium", "short"],
  // 몸통 체격. 형태(body)와 독립 — 홀쭉이 통·땅딸막한 콩·작은 몸통이 다 나온다.
  // skinny 홀쭉이 · narrow 마름 · medium · wide 넓적 · small 작은 몸통(폭·높이 다 작다).
  // 다리 스탠스(벌림)와 어깨 위치가 이걸 따른다: 좁은 몸은 다리를 모으고, 넓은 몸은 벌린다.
  // 네발에서는 몸 길이·두께다: narrow 짧은 몸, wide 긴 몸(닥스훈트·먼치킨), skinny 얇은 몸, small 작은 몸.
  build: ["skinny", "narrow", "medium", "wide", "small"]
};

// 뒤늦게 붙인 슬롯. makeCreature가 다른 모든 것(파츠·제약·색·비율) 뒤에 뽑는다 —
// 그래야 앞선 rng 소비가 그대로라 기존 시드의 판이 유지된다(새 슬롯 값만 더해진다).
// 새 슬롯은 여기 끝에 붙인다. 순서를 바꾸면 이 슬롯들의 값이 바뀐다.
export const LATE_SLOTS = ["legLength", "build"];

// 아키타입 bias가 없는 슬롯의 기본 가중치.
//
// 이게 없으면 슬롯 안에서 균등 추첨이 되는데, 그러면 선택지가 5개인 eyewear는
// 80%가 무언가를 쓰고, 선택지가 9개인 hair는 눈에 띄는 종류가 거의 안 나온다.
// "없음"이 흔해야 하는 슬롯과 흔하면 안 되는 슬롯을 여기서 가른다.
export const DEFAULT_BIAS = {
  hair: [["none", 3], ["bob", 2], ["mop", 2], ["scribble", 2], ["sweep", 2], ["spikes", 2], ["tuft", 2], ["wisp", 2], ["pigtails", 1.5], ["curly", 1.5], ["mohawk", 1], ["bangs", 2], ["longbob", 1.5], ["bun", 1]],
  headgear: [["none", 6], ["cap", 2], ["band", 2], ["beret", 2], ["bonnet", 1.5], ["helmet", 1], ["pot", 1]],
  eyewear: [["none", 5], ["glasses", 2], ["patch", 2], ["goggles", 1], ["monocle", 1]],
  ears: [["none", 4], ["round", 1.5], ["roundMid", 0.5], ["pointy", 1.5], ["pointyMid", 1], ["pointyBig", 0.5], ["flap", 1], ["fold", 0.7], ["foldMid", 0.3]],
  brow: [["none", 2], ["flat", 2], ["angry", 1], ["worry", 1]],
  marks: [["none", 4], ["stripes", 2], ["hatch", 2], ["dots", 2], ["patch", 1], ["spots", 1]],
  nose: [["hook", 3], ["dot", 2], ["wedge", 2], ["none", 2], ["long", 1]],
  face2: [["none", 5], ["blush", 2], ["freckles", 2], ["tears", 1.5]],
  horns: [["none", 5], ["curved", 2], ["straight", 2], ["antenna", 2], ["nub", 2]],
  tail: [["curl", 3], ["flag", 3], ["longtail", 2], ["stubtail", 2], ["hook", 1.5], ["kink", 1], ["ring", 1.5], ["plume", 1.5]],
  arms: [["stick", 3], ["sleeve", 3], ["mitten", 2], ["stubby", 2]],
  armLength: [["medium", 3], ["long", 1]],
  legs: [["stick", 3], ["boots", 3], ["stub", 2.5], ["bent", 2], ["float", 1.5], ["tiptoe", 1]],
  legLength: [["long", 3], ["medium", 2], ["short", 1]],
  build: [["medium", 4], ["narrow", 1.5], ["wide", 1.5], ["skinny", 1], ["small", 1]]
};
