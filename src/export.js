// Drops the screen to a PNG. Puts the WebGL canvas onto a 2D canvas and lays a signature over it. It knows nothing about the scene — it takes a canvas already drawn.
//
// WebGL clears the drawing buffer at the end of a frame (the renderer does not enable preserveDrawingBuffer — that would cost every frame).
// So it has to be read right after a redraw, **within the same task**: the caller calls scene.draw() first.
// Yield the task (await, setTimeout) and the image comes out blank.

const INK = "rgba(43, 39, 36, 0.5)";
const FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";   // same as the on-screen font (styles.css)

export function exportPng(canvas, { mark, name }) {
  const out = document.createElement("canvas");
  out.width = canvas.width;      // canvas pixels as they are (the size setPixelRatio settled on — it goes out at screen resolution)
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  ctx.drawImage(canvas, 0, 0);

  // Signature — the name, bottom-right. It has to scale with the image or it turns into specks on a big board
  const short = Math.min(out.width, out.height);
  const size = Math.max(11, Math.round(short * 0.018));
  const pad = Math.round(short * 0.03);
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(size * 0.14).toFixed(2)}px`;   // wider than the on-screen tracking (0.04em) — it is a signature

  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(mark, out.width - pad, out.height - pad);

  out.toBlob((blob) => {
    if (blob) downloadBlob(blob, name);
  }, "image/png");
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Some browsers lose the URL before the save starts if it is revoked right after the click. Revoke on the next tick
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// A finished picture handed to the visitor (the name screen's card): a phone's share sheet where it takes files — save to photos,
// send it on — and a download everywhere else, a desktop's share sheet included (a SAVE button that opens one is not a save).
// **Synchronous up to the share call**: a share sheet opens only inside the click that asked for it, and toBlob's callback has already
// left that click, so the PNG is read with toDataURL in the same task
export function savePng(canvas, name) {
  const [, data] = canvas.toDataURL("image/png").split(",");
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const file = new File([bytes], name, { type: "image/png" });
  const phone = navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches;
  if (phone && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch((error) => {
      if (error.name !== "AbortError") downloadBlob(file, name);   // a sheet closed by hand is not a failure
    });
    return;
  }
  downloadBlob(file, name);
}
