"use server";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, max, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp, { type OutputInfo } from "sharp";
import { db } from "@/db";
import { photos, routes, sends, sets, walls } from "@/db/schema";
import {
  ActionError,
  type ActionState,
  requiredStr,
  str,
  withAction,
} from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { getGym } from "@/lib/gym";
import { PHOTO_BUCKET, PHOTO_MAX_EDGE, THUMB_MAX_EDGE } from "@/lib/photos";
import { moveId } from "@/lib/reorder";
import { setStatus } from "@/lib/sets";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------- sets

function parseSetDate(formData: FormData) {
  const value = requiredStr(formData, "setDate", "Set date");
  // Noon UTC so the calendar day survives any viewer's timezone offset.
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new ActionError("Invalid set date.");
  return date;
}

async function getGymSet(setId: string) {
  const gym = await getGym();
  const set = await db.query.sets.findFirst({
    where: and(eq(sets.id, setId), eq(sets.gymId, gym.id)),
  });
  if (!set) throw new ActionError("Set not found.");
  return set;
}

export async function createSet(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAdmin();
  let setId: string | undefined;
  const result = await withAction(async () => {
    const gym = await getGym();
    const [set] = await db
      .insert(sets)
      .values({
        gymId: gym.id,
        name: requiredStr(formData, "name", "Name"),
        setDate: parseSetDate(formData),
        createdBy: user.profile.id,
      })
      .returning({ id: sets.id });
    setId = set.id;
  });
  if (!setId) return result;
  revalidatePath("/", "layout");
  redirect(`/admin/sets/${setId}`);
}

export async function updateSet(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const set = await getGymSet(requiredStr(formData, "id"));
    await db
      .update(sets)
      .set({
        name: requiredStr(formData, "name", "Name"),
        setDate: parseSetDate(formData),
      })
      .where(eq(sets.id, set.id));
    revalidatePath("/", "layout");
  });
}

/**
 * draft → published → archived, with the reverse steps allowed too. Archiving
 * flips the set's routes to `archived` (sends and leaderboards are kept —
 * PLAN §1 "history is preserved forever"); unarchiving flips them back.
 */
export async function transitionSet(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const set = await getGymSet(requiredStr(formData, "id"));
    const status = setStatus(set);
    const to = str(formData, "to");
    const now = new Date();

    await db.transaction(async (tx) => {
      if (to === "published" && status === "draft") {
        await tx.update(sets).set({ publishedAt: now }).where(eq(sets.id, set.id));
      } else if (to === "draft" && status === "published") {
        await tx.update(sets).set({ publishedAt: null }).where(eq(sets.id, set.id));
      } else if (to === "archived" && status === "published") {
        await tx.update(sets).set({ archivedAt: now }).where(eq(sets.id, set.id));
        await tx
          .update(routes)
          .set({ status: "archived" })
          .where(eq(routes.setId, set.id));
      } else if (to === "published" && status === "archived") {
        await tx.update(sets).set({ archivedAt: null }).where(eq(sets.id, set.id));
        await tx
          .update(routes)
          .set({ status: "active" })
          .where(eq(routes.setId, set.id));
      } else {
        throw new ActionError(`Can't move a ${status} set to ${to || "?"}.`);
      }
    });
    revalidatePath("/", "layout");
  });
}

export async function deleteSet(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const result = await withAction(async () => {
    const set = await getGymSet(requiredStr(formData, "id"));
    if (setStatus(set) !== "draft") {
      // Published/archived sets may carry sends — archive, don't delete.
      throw new ActionError("Only draft sets can be deleted. Unpublish it first.");
    }
    await assertNoSends(eq(routes.setId, set.id));
    const setPhotos = await db
      .select({ storagePath: photos.storagePath, thumbPath: photos.thumbPath })
      .from(photos)
      .where(eq(photos.setId, set.id));
    // Cascades photos → routes.
    await db.delete(sets).where(eq(sets.id, set.id));
    await removeObjects(setPhotos);
  });
  if (result) return result;
  revalidatePath("/", "layout");
  redirect("/admin/sets");
}

// -------------------------------------------------------------- photos

async function assertNoSends(routeFilter: SQL) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(sends)
    .innerJoin(routes, eq(sends.routeId, routes.id))
    .where(routeFilter);
  if (value > 0) {
    throw new ActionError(
      `${value} send(s) are logged here — deleting would erase climbers' history.`
    );
  }
}

async function removeObjects(
  rows: { storagePath: string; thumbPath: string | null }[]
) {
  const paths = rows.flatMap((r) =>
    r.thumbPath ? [r.storagePath, r.thumbPath] : [r.storagePath]
  );
  if (paths.length === 0) return;
  // Best effort: an orphaned file is harmless, a failed delete shouldn't
  // undo a DB change that already committed.
  const { error } = await createAdminClient().storage.from(PHOTO_BUCKET).remove(paths);
  if (error) console.error("Failed to remove photo objects", paths, error);
}

async function ensureBucket() {
  const storage = createAdminClient().storage;
  const { data } = await storage.getBucket(PHOTO_BUCKET);
  if (data) return;
  const { error } = await storage.createBucket(PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: "30MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export type PhotoUploadTicket =
  | { error: string }
  | { path: string; token: string };

/**
 * Step 1 of an upload: a one-time signed URL so the browser sends the
 * original straight to Storage. Phone photos blow past both the 1MB Server
 * Action body limit and Vercel's ~4.5MB function payload cap.
 */
export async function createPhotoUpload(setId: string): Promise<PhotoUploadTicket> {
  await requireAdmin();
  try {
    const set = await getGymSet(setId);
    await ensureBucket();
    const path = `originals/${set.id}/${randomUUID()}`;
    const { data, error } = await createAdminClient()
      .storage.from(PHOTO_BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path: data.path, token: data.token };
  } catch (err) {
    console.error(err);
    return { error: err instanceof Error ? err.message : "Upload setup failed." };
  }
}

/**
 * Step 2: download the original, normalize with sharp (EXIF-rotate, cap at
 * PHOTO_MAX_EDGE, WebP + thumbnail), store both, insert the photo row, and
 * drop the original.
 */
export async function finalizePhotoUpload(input: {
  setId: string;
  originalPath: string;
  wallId: string | null;
}): Promise<{ error?: string }> {
  await requireAdmin();
  const set = await getGymSet(input.setId).catch(() => null);
  if (!set) return { error: "Set not found." };
  if (!input.originalPath.startsWith(`originals/${set.id}/`)) {
    return { error: "Invalid upload path." };
  }

  const bucket = createAdminClient().storage.from(PHOTO_BUCKET);
  try {
    const { data: original, error: downloadError } = await bucket.download(
      input.originalPath
    );
    if (downloadError) throw downloadError;
    const source = Buffer.from(await original.arrayBuffer());

    let display: { data: Buffer; info: OutputInfo };
    let thumb: Buffer;
    try {
      display = await sharp(source)
        .rotate()
        .resize(PHOTO_MAX_EDGE, PHOTO_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      thumb = await sharp(display.data)
        .resize(THUMB_MAX_EDGE, THUMB_MAX_EDGE, { fit: "inside" })
        .webp({ quality: 75 })
        .toBuffer();
    } catch {
      return { error: "Couldn't read that image — upload a JPEG, PNG or WebP." };
    }

    const photoId = randomUUID();
    const storagePath = `sets/${set.id}/${photoId}.webp`;
    const thumbPath = `sets/${set.id}/${photoId}-thumb.webp`;
    for (const [path, body] of [
      [storagePath, display.data],
      [thumbPath, thumb],
    ] as const) {
      const { error } = await bucket.upload(path, body, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
    }

    const wallId = await validWallId(input.wallId);
    const [{ value: maxOrder }] = await db
      .select({ value: max(photos.sortOrder) })
      .from(photos)
      .where(eq(photos.setId, set.id));
    await db.insert(photos).values({
      id: photoId,
      setId: set.id,
      wallId,
      storagePath,
      thumbPath,
      width: display.info.width,
      height: display.info.height,
      sortOrder: (maxOrder ?? -1) + 1,
    });
    revalidatePath("/", "layout");
    return {};
  } catch (err) {
    console.error(err);
    return { error: err instanceof Error ? err.message : "Upload failed." };
  } finally {
    await bucket.remove([input.originalPath]);
  }
}

async function validWallId(wallId: string | null) {
  if (!wallId) return null;
  const gym = await getGym();
  const wall = await db.query.walls.findFirst({
    where: and(eq(walls.id, wallId), eq(walls.gymId, gym.id)),
  });
  return wall?.id ?? null;
}

async function getGymPhoto(photoId: string) {
  const photo = await db.query.photos.findFirst({ where: eq(photos.id, photoId) });
  if (!photo) throw new ActionError("Photo not found.");
  await getGymSet(photo.setId);
  return photo;
}

export async function updatePhoto(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const photo = await getGymPhoto(requiredStr(formData, "id"));
    await db
      .update(photos)
      .set({
        wallId: await validWallId(str(formData, "wallId") || null),
        caption: str(formData, "caption") || null,
      })
      .where(eq(photos.id, photo.id));
    revalidatePath("/", "layout");
  });
}

export async function movePhoto(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const photo = await getGymPhoto(requiredStr(formData, "id"));
    const rows = await db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.setId, photo.setId))
      .orderBy(asc(photos.sortOrder), asc(photos.id));
    const order = moveId(
      rows.map((r) => r.id),
      photo.id,
      str(formData, "direction") === "up" ? "up" : "down"
    );
    await db.transaction(async (tx) => {
      for (const [sortOrder, id] of order.entries()) {
        await tx.update(photos).set({ sortOrder }).where(eq(photos.id, id));
      }
    });
    revalidatePath("/", "layout");
  });
}

export async function deletePhoto(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const photo = await getGymPhoto(requiredStr(formData, "id"));
    await assertNoSends(eq(routes.photoId, photo.id));
    // Cascades to the photo's routes.
    await db.delete(photos).where(eq(photos.id, photo.id));
    await removeObjects([photo]);
    revalidatePath("/", "layout");
  });
}
