import { fitWithin, IMAGE_MAX_EDGE, type UploadContentType, type UploadPurpose } from '@paw/domain';

// Resizes an image in the browser before upload (ARCHITECTURE D38): phone photos are often
// 4000 px and 5 MB; resized they're about 200–300 KB, so uploads are quick on mobile data
// and storage stays in R2's free tier. Browser-only (canvas).

export interface ResizedImage {
  blob: Blob;
  contentType: UploadContentType;
  width: number;
  height: number;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

/**
 * The image scaled down to the purpose's size limit, as WebP (or JPEG where the browser
 * can't encode WebP). Null when the browser can't read the file (e.g. HEIC outside Safari).
 */
export async function resizeForUpload(
  file: File,
  purpose: UploadPurpose,
): Promise<ResizedImage | null> {
  let bitmap: ImageBitmap;
  try {
    // from-image: phone photos store their rotation separately; apply it, so they're upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, IMAGE_MAX_EDGE[purpose]);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    bitmap.close();
    return null;
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);

  // Browsers that can't encode WebP silently return PNG instead, so check the type.
  const webp = await toBlob(canvas, 'image/webp', 0.82);
  if (webp?.type === 'image/webp') {
    bitmap.close();
    return { blob: webp, contentType: 'image/webp', width, height };
  }

  // JPEG has no transparency: put transparent logos on white instead of black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.85);
  return jpeg === null ? null : { blob: jpeg, contentType: 'image/jpeg', width, height };
}
