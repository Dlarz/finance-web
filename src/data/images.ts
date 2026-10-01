import type { NewImage } from './transactionsRepo';

export const MAX_IMAGE_SIDE = 2000;
export const THUMB_SIDE = 320;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image-decode'));
    };
    img.src = url;
  });
}

function draw(img: HTMLImageElement, maxSide: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve({ blob, width, height }) : reject(new Error('encode'))), 'image/jpeg', quality);
  });
}

/**
 * Shrinks a picture to max 2000 px on the long side and re-encodes it as JPEG (~85 %).
 * Browsers apply the EXIF rotation when decoding, so the result is upright.
 */
export async function processImageFile(file: Blob): Promise<NewImage> {
  const img = await loadImage(file);
  const full = await draw(img, MAX_IMAGE_SIDE, 0.85);
  const thumb = await draw(img, THUMB_SIDE, 0.8);
  return { data: await full.blob.arrayBuffer(), thumb: await thumb.blob.arrayBuffer(), mimeType: 'image/jpeg', width: full.width, height: full.height };
}

/** Blob for displaying stored image bytes. */
export function imageBlob(data: ArrayBuffer, mimeType = 'image/jpeg'): Blob {
  return new Blob([data], { type: mimeType });
}
