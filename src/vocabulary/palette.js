// 팔레트. 문서: guidelines/character-types.md § 팔레트

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
