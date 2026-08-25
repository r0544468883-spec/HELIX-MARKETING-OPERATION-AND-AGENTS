/**
 * Strip metadata from images (clean-room, browser-only).
 *
 * Images generated or edited by AI tools carry provenance metadata: EXIF,
 * XMP, ICC, and C2PA manifests (the "Content Credentials" chunk). Decoding the
 * image to raw pixels and re-encoding it drops ALL of that — the output keeps
 * only the visible pixels, no embedded metadata of any kind.
 *
 * This is dependency-free and runs in the browser (canvas). For server-side
 * PDF/DOCX metadata stripping use the existing helix-pdf / helix-docx skills
 * (exiftool/qpdf backed) — this file intentionally covers only raster images.
 *
 * Only process files you own or are authorized to process.
 */

export interface StripImageOptions {
  /** Output MIME type. Default: 'image/png' (lossless). Use 'image/jpeg' to shrink. */
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  /** Quality 0..1 for lossy types. Default: 0.92. */
  quality?: number;
}

/**
 * Return a new Blob with all embedded metadata removed by re-encoding pixels.
 * Rejects if the image can't be decoded.
 */
export async function stripImageMetadata(
  file: Blob,
  options: StripImageOptions = {},
): Promise<Blob> {
  const { type = 'image/png', quality = 0.92 } = options;

  const bitmap = await decodeToBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.drawImage(bitmap, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))),
        type,
        quality,
      );
    });
  } finally {
    // Free bitmap memory where supported.
    (bitmap as ImageBitmap).close?.();
  }
}

async function decodeToBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // Prefer createImageBitmap — never executes embedded scripts (SVG safety).
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to <img> for formats createImageBitmap can't decode.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
