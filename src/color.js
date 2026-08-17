// 색 유틸 — 헥스 문자열("#rrggbb") 하나로 통한다. 캐릭터(팔레트·얼굴 잉크 판정)와 그리기(정점 색·톤)가 같은 함수를 쓴다.
// 문서: guidelines/drawing.md § 색은 선형 공간으로 넣는다

// three.js는 정점 색을 선형 공간으로 보고 출력할 때 sRGB로 변환한다.
// sRGB 헥스를 그대로 넣으면 어두운 색이 중간 회색으로 밝아진다.
export function srgbToLinear(channel) {
  return channel < 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

// "#rrggbb" → 선형 [r, g, b] (0~1). 획마다 부르므로 문자열별로 캐시한다 (판 하나에 수천 획, 색은 수십 가지)
const linearCache = new Map();
export function hexToRgb(hex) {
  let rgb = linearCache.get(hex);
  if (!rgb) {
    const value = parseInt(hex.slice(1), 16);
    rgb = [
      srgbToLinear(((value >> 16) & 255) / 255),
      srgbToLinear(((value >> 8) & 255) / 255),
      srgbToLinear((value & 255) / 255)
    ];
    linearCache.set(hex, rgb);
  }
  return rgb;
}

// 휘도(0~255, Rec.601 가중치). 얼굴 잉크를 검정으로 할지 밝게 할지(spec.js), 스크리블을 어둡게 긁을지 밝게 긁을지(isDark) 가른다
export function luminance(hex) {
  const v = parseInt(hex.slice(1), 16);
  return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
}

// 어두운 색인가. 도깨비 머리·몸처럼 어두운 면 위에는 스크리블을 밝게 긁는다
export function isDark(hex) {
  return luminance(hex) < 90;
}

// 같은 계열의 톤. factor < 1 어둡게, > 1 밝게. 연필 음영(채색보다 살짝 어두운 톤), 개·고양이·도깨비의 몸을 머리색과 "비슷한 색"으로 줄 때
export function shade(hex, factor) {
  const v = parseInt(hex.slice(1), 16);
  const ch = (x) => Math.round(Math.max(0, Math.min(255, x * factor))).toString(16).padStart(2, "0");
  return "#" + ch((v >> 16) & 255) + ch((v >> 8) & 255) + ch(v & 255);
}
