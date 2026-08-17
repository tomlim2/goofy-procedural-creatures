// 파츠 어휘. 여기는 "무엇이 있는가"만 정의한다. 고르는 규칙은 ../creature.js,
// 그리는 일은 ../draw/가 한다. 셋을 섞지 않는다.
// 문서: guidelines/character/parts.md

// 슬롯별 선택지. 이름은 draw.js의 그리기 함수 키와 1:1로 맞춘다.
export const SLOTS = {
  head: ["round", "square", "tall", "pear", "wide", "egg", "block"],
  // 살아 있는 눈(리그 — 동공·깜빡임·놀람): ring · wide(1.3배 큰 ring) · cyclops(외눈) · bead(단추눈 — 흰자 없이 검은 구슬 + 하이라이트) ·
  // oval(세로 타원 왕눈). 정적 눈: dot · sleepy · half · spiral · cross · slit · line(일자눈 ㅡ ㅡ) · happy(늘 웃는 ^^) · hollow(빈 눈 — 동공 없는 타원)
  // 카오모지에서 온 것: squeeze(>_< 꼭 감음) · side(¬_¬ 곁눈질) · sparkle(◕ 반짝 왕눈 — 살아 있음) · droop(´･ω･` 처진 눈꼬리).
  // ☆_☆·♥_♥은 눈 종류가 아니라 놀람의 변형(motion/events.js stepSurprise)이다 — 잠깐 눈이 그렇게 바뀐다
  eyes: ["ring", "dot", "wide", "sleepy", "spiral", "cross", "half", "slit", "cyclops", "bead", "oval", "line", "happy", "hollow",
    "squeeze", "side", "sparkle", "droop"],
  brow: ["none", "flat", "angry", "worry"],
  eyewear: ["none", "glasses", "goggles", "patch", "monocle"],
  // 헤어는 면을 칠하지 않고 펜으로 왕복해 긋는 스크리블로 그린다.
  // 레퍼런스 아이 줄: 앞머리 있는 바가지(bangs) · 옆으로 턱까지 내려오는 단발(longbob) · 정수리 똥머리(bun) 포함
  // 레퍼런스 부피형: helmet 두건형(정수리~눈썹·귀를 감싸는 큰 덩어리) · cloud 구름형 곱슬(스캘럽 윤곽 큰 덩어리) · hedgehog 고슴도치(정수리 전면 짧은 가시)
  // 뒷머리 층이 생겨서 되는 것: long 긴 생머리(어깨까지) · twintails 트윈테일 · ponytail 포니테일 · apple 사과머리(정수리 꼭지)
  hair: ["none", "bob", "spikes", "mop", "mohawk", "tuft", "wisp", "scribble", "sweep", "pigtails", "curly", "bangs", "longbob", "bun", "helmet", "cloud", "hedgehog",
    "long", "twintails", "ponytail", "apple"],
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
  // 꼬리 **골격** — 척추 모양만. curl 위로 말림 · flag 위로 곧게 · longtail 뒤로 길게 · stubtail 뭉툭 · hook 위로 섰다 갈고리(고양이) ·
  // kink 꺾인 꼬리(고양이) · ring 등 위로 말린 고리(스피츠). 무엇을 입히나는 tailSkin
  tail: ["curl", "flag", "longtail", "stubtail", "hook", "kink", "ring"],
  // 꼬리 **스킨** — 골격 위에 입히는 것. line 가는 선 한 획 · thick 채운 굵은 꼬리 · plume 북슬한 깃털(털 획) · tuft 끝 뭉치(사자) · ringed 고리 무늬(너구리) ·
  // block 네모(폭 일정, 끝이 각짐) · wedge 세모(뿌리 넓고 끝 뾰족) · ball 동그라미(척추를 따라 구슬, 스텁이면 폼폼 하나).
  // ringed·wedge는 쥐꼬리처럼 보여 **비활성** — 자산(그리기·갤러리)은 남기고 어떤 bias에도 안 넣는다 (뽑히지 않는다)
  // puff 몽실 — 골격과 상관없이 엉덩이 쪽에 붙는 북슬한 토끼 꼬리(폼폼 + 털 획). 개
  tailSkin: ["line", "thick", "plume", "tuft", "ringed", "block", "wedge", "ball", "puff"],
  // 꼬리 **기장** — 골격을 통째로 줄인다 (long 1 · medium 0.7 · short 0.45). 스킨 두께는 그대로
  tailLength: ["long", "medium", "short"],
  // 팔 형태. 자세(늘어짐·벌림·들기·뒷짐)는 여기 없다 — 그건 clocks.js의 모션이다. none은 팔 없음(도깨비 일부) — 팔 행위 층이 쉰다
  arms: ["stick", "sleeve", "stubby", "mitten", "none"],
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
export const LATE_SLOTS = ["legLength", "build", "tailSkin", "tailLength"];

// 아키타입 bias가 없는 슬롯의 기본 가중치.
//
// 이게 없으면 슬롯 안에서 균등 추첨이 되는데, 그러면 선택지가 5개인 eyewear는
// 80%가 무언가를 쓰고, 선택지가 9개인 hair는 눈에 띄는 종류가 거의 안 나온다.
// "없음"이 흔해야 하는 슬롯과 흔하면 안 되는 슬롯을 여기서 가른다.
export const DEFAULT_BIAS = {
  // 종족·아키타입 bias가 없을 때. cyclops는 여기 없다 (도깨비 bias로만 나온다)
  eyes: [["ring", 3], ["dot", 2], ["wide", 2], ["sleepy", 1.5], ["half", 1.5], ["spiral", 1], ["cross", 1], ["slit", 1], ["bead", 1.5], ["oval", 1.5], ["line", 1.5], ["happy", 1.5], ["hollow", 1],
    ["sparkle", 1.5], ["squeeze", 1], ["side", 1], ["droop", 1]],
  hair: [["none", 3], ["bob", 2], ["mop", 2], ["scribble", 2], ["sweep", 2], ["spikes", 2], ["tuft", 2], ["wisp", 2], ["pigtails", 1.5], ["curly", 1.5], ["mohawk", 1], ["bangs", 2], ["longbob", 1.5], ["bun", 1], ["helmet", 2], ["cloud", 1.5], ["hedgehog", 1.5], ["long", 1.5], ["twintails", 1], ["ponytail", 1.5], ["apple", 1]],
  headgear: [["none", 6], ["cap", 2], ["band", 2], ["beret", 2], ["bonnet", 1.5], ["helmet", 1], ["pot", 1]],
  eyewear: [["none", 5], ["glasses", 2], ["patch", 2], ["goggles", 1], ["monocle", 1]],
  ears: [["none", 4], ["round", 1.5], ["roundMid", 0.5], ["pointy", 1.5], ["pointyMid", 1], ["pointyBig", 0.5], ["flap", 1], ["fold", 0.7], ["foldMid", 0.3]],
  brow: [["none", 2], ["flat", 2], ["angry", 1], ["worry", 1]],
  marks: [["none", 4], ["stripes", 2], ["hatch", 2], ["dots", 2], ["patch", 1], ["spots", 1]],
  nose: [["hook", 3], ["dot", 2], ["wedge", 2], ["none", 2], ["long", 1]],
  face2: [["none", 5], ["blush", 2], ["freckles", 2], ["tears", 1.5]],
  horns: [["none", 5], ["curved", 2], ["straight", 2], ["antenna", 2], ["nub", 2]],
  tail: [["curl", 3], ["flag", 3], ["longtail", 2], ["stubtail", 2], ["hook", 1.5], ["kink", 1], ["ring", 1.5]],
  tailSkin: [["line", 3], ["thick", 2.5], ["plume", 1.5], ["tuft", 1], ["block", 1], ["ball", 1], ["puff", 1]],   // ringed·wedge 비활성
  tailLength: [["long", 3], ["medium", 2], ["short", 1.5]],
  arms: [["stick", 3], ["sleeve", 3], ["mitten", 2], ["stubby", 2]],
  armLength: [["medium", 3], ["long", 1]],
  legs: [["stick", 3], ["boots", 3], ["stub", 2.5], ["bent", 2], ["float", 1.5], ["tiptoe", 1]],
  legLength: [["long", 3], ["medium", 2], ["short", 1]],
  build: [["medium", 4], ["narrow", 1.5], ["wide", 1.5], ["skinny", 1], ["small", 1]]
};
