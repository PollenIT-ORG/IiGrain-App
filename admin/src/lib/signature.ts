// A signature drawn in a box, or photographed on paper, carries a lot of blank
// space around it. Left in, it makes the signature shrink to nothing when it is
// placed on a contract's signature line, so it is cropped to the writing first.

const BLANK_ALPHA = 8;
const BLANK_LIGHT = 245;
const PAD = 6;

/** Crops a canvas to what was actually written on it. */
export function trimToInk(canvas: HTMLCanvasElement, pad = PAD): string {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  if (!ctx || !width || !height) return canvas.toDataURL("image/png");

  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < BLANK_ALPHA) continue;
      const blank =
        data[i] > BLANK_LIGHT && data[i + 1] > BLANK_LIGHT && data[i + 2] > BLANK_LIGHT;
      if (blank) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  // Nothing written, or ink edge to edge: leave it as it is.
  if (maxX < 0) return canvas.toDataURL("image/png");

  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropWidth = Math.min(width, maxX + pad + 1) - left;
  const cropHeight = Math.min(height, maxY + pad + 1) - top;
  if (cropWidth >= width && cropHeight >= height) return canvas.toDataURL("image/png");

  const out = document.createElement("canvas");
  out.width = cropWidth;
  out.height = cropHeight;
  const target = out.getContext("2d");
  if (!target) return canvas.toDataURL("image/png");
  target.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return out.toDataURL("image/png");
}

/** The same, for a signature picked from a file. */
export function trimImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0);
      try {
        resolve(trimToInk(canvas));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
