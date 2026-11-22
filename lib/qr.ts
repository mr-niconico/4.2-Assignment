// QR decoding in the browser (spec 5.3): vision models cannot reliably read QR codes, so code does it.
// BROWSER ONLY (uses canvas).

import jsQR from "jsqr";

const MAX_SIDE = 1600; // scale big phone photos down: faster, and still enough pixels for a QR code

/** Returns the decoded QR text, or null if no QR code is found (or the image cannot be read). */
export async function decodeQrFromFile(file: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const { data } = ctx.getImageData(0, 0, width, height);
    const code = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
    const text = code?.data.trim();
    return text ? text : null;
  } catch {
    return null;
  }
}
