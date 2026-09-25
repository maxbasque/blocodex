export const PHOTO_BUCKET = "photos";

/** Longest edge of the stored display image, per PLAN §3 (sharp on upload). */
export const PHOTO_MAX_EDGE = 1600;
export const THUMB_MAX_EDGE = 400;

/**
 * Public CDN URL for an object in the photos bucket. Served straight from
 * Supabase Storage, not the Next image optimizer (PLAN §6: bandwidth cost).
 */
export function photoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}
