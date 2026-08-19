// 화면을 PNG로 떨군다. WebGL 캔버스를 2D 캔버스에 올리고 서명을 얹는다. 씬을 모른다 — 다 그려진 캔버스를 받는다.
//
// WebGL은 프레임이 끝나면 그리기 버퍼를 비운다(renderer는 preserveDrawingBuffer를 안 켠다 — 켜면 매 프레임 비용이 붙는다).
// 그래서 **같은 태스크 안에서** 다시 그린 직후에 읽어야 한다: 부르는 쪽이 scene.draw()를 먼저 부른다.
// 태스크를 넘기면(await·setTimeout) 빈 그림이 나온다.

const INK = "rgba(43, 39, 36, 0.5)";
const FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";   // 화면 글꼴과 같다 (styles.css)

export function exportPng(canvas, { seed, mark, name }) {
  const out = document.createElement("canvas");
  out.width = canvas.width;      // 캔버스 픽셀 그대로 (setPixelRatio가 잡은 크기 — 화면 해상도로 나간다)
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  ctx.drawImage(canvas, 0, 0);

  // 서명 — 왼쪽 밑 시드, 오른쪽 밑 이름. 그림 크기를 따라가야 큰 판에서 깨알이 되지 않는다
  const short = Math.min(out.width, out.height);
  const size = Math.max(11, Math.round(short * 0.018));
  const pad = Math.round(short * 0.03);
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(size * 0.14).toFixed(2)}px`;   // 화면 자간(0.04em)보다 넓게 — 서명이라

  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(seed, pad, out.height - pad);

  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(mark, out.width - pad, out.height - pad);

  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    // 클릭 직후에 풀면 저장이 시작되기 전에 URL이 사라지는 브라우저가 있다. 다음 틱에 푼다
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, "image/png");
}
