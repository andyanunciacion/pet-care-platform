// Image upload rules, shared by the admin uploader (which resizes in the browser) and the
// API (which checks every upload), so both enforce the same limits (ARCHITECTURE D38).

/** What an upload is for; it decides the owner, the size and the storage path. */
export const UPLOAD_PURPOSES = ['branch_photo', 'business_logo', 'product_image'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

/** Photos per branch on the free listing. The paid plan (PRD, P3) may raise it. */
export const MAX_PHOTOS_PER_BRANCH = 20;

/**
 * Largest file the API accepts. Resized images are about 200–300 KB; the headroom is for
 * busy photos and for browsers that can only make JPEG.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** WebP where the browser can encode it, JPEG otherwise (older Safari). */
export const UPLOAD_CONTENT_TYPES = ['image/webp', 'image/jpeg'] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

export const UPLOAD_EXTENSIONS = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
} as const satisfies Record<UploadContentType, string>;

/** The longest edge, in pixels, an image is resized to before upload. */
export const IMAGE_MAX_EDGE = {
  branch_photo: 1600,
  product_image: 1200,
  business_logo: 512,
} as const satisfies Record<UploadPurpose, number>;

/**
 * The size an image is scaled down to so its longest edge is at most `maxEdge`, keeping its
 * proportions. Images that already fit keep their size (never scaled up).
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
