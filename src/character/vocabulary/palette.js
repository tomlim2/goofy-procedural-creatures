// 팔레트. 문서: guidelines/character/types.md § 팔레트

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

// 도깨비 머리·몸. 먹빛 하나가 아니라 짙은 회색·회청·회갈·자흑까지.
// 전부 종이 위에서 "검다"고 읽힐 만큼 어둡되, 나란히 서면 서로 다르다.
export const DARKS = [
  "#252220", // 먹
  "#2b2724", // 갈흑
  "#3a3430", // 회갈
  "#443c34", // 밝은 회갈
  "#33383a", // 회청
  "#3d3f44", // 청회
  "#4a4340", // 회
  "#3a2f3a", // 자흑
  "#2f3a33"  // 녹흑
];

// 검정 계열 털 — 개·고양이 전용. **적당히 검정**이다: 도깨비의 먹빛(DARKS, 휘도 34~69)보다 밝고 FILLS(휘도 190~220)보다 훨씬 어둡다(휘도 75~85).
// 종이 위에서 "검은 고양이·검은 개"로 읽히되 먹덩어리가 되지는 않는다. 이 털에는 얼굴 잉크가 밝은 쪽으로 바뀐다(spec.js faceInk, 휘도 < 120).
// FUR_POOL은 뽑기 주머니 — null이 섞여 있어 **한 번의 pick**으로 "검정 털이냐"와 "어느 검정이냐"를 같이 정한다 (rng 호출 수 고정, guidelines/determinism.md)
export const FURS = [
  "#4f4a44", // 먹갈
  "#57534c", // 재빛 갈회
  "#4b4d52", // 청먹
  "#5a5450"  // 밝은 숯
];
export const FUR_POOL = [null, null, null, null, null, null, null, null, ...FURS];   // 4/12 ≈ 33%

// 삼색(calico 무늬)의 가운데 톤 — 진짜 삼색의 주황 자리. 판이 모노톤이라 채도 있는 색 대신 **따뜻한 탄**(휘도 139): 바탕(FILLS 187~217·몸 톤 ≥170)과
// 검정 털(FURS 75~85) 사이에 앉아 셋이 갈린다. 색 포인트(POPS)가 아니라 판당 상한을 안 먹는다
export const CALICO_MID = "#a3866a";

// (같은 계열의 톤을 만드는 shade는 src/color.js — 개·고양이·도깨비의 몸을 머리색과 "비슷한 색"으로 줄 때 spec.js가 쓴다)

export const ACCENTS = [
  "#8a7f72",
  "#6f7a72",
  "#8d7168",
  "#7a7686"
];
