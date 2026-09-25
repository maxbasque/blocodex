"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { gradeScale, photos, routes, sends, sets } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getGym } from "@/lib/gym";
import { setStatus } from "@/lib/sets";
import type { EditorRoute, RouteFields, RouteResult } from "./types";

const HEX = /^#[0-9a-f]{6}$/i;

function toEditorRoute(route: typeof routes.$inferSelect): EditorRoute {
  const { id, pinX, pinY, color, gradeId, pointsOverride, name, notes } = route;
  return { id, pinX, pinY, color, gradeId, pointsOverride, name, notes };
}

function clampPin(n: number) {
  if (!Number.isFinite(n)) throw new Error("Invalid pin position.");
  return Math.min(1, Math.max(0, n));
}

/** Validates editable fields against the current gym; throws on bad input. */
async function cleanFields(fields: RouteFields, gymId: string) {
  if (!HEX.test(fields.color)) throw new Error("Pick a hold color.");
  if (fields.gradeId) {
    const grade = await db.query.gradeScale.findFirst({
      where: and(eq(gradeScale.id, fields.gradeId), eq(gradeScale.gymId, gymId)),
    });
    if (!grade) throw new Error("Unknown grade.");
  }
  const points = fields.pointsOverride;
  if (points !== null && (!Number.isInteger(points) || points < 0)) {
    throw new Error("Points must be a whole number ≥ 0.");
  }
  return {
    color: fields.color.toLowerCase(),
    gradeId: fields.gradeId,
    pointsOverride: points,
    name: fields.name?.trim() || null,
    notes: fields.notes?.trim() || null,
  };
}

/** Loads a photo plus its set, scoped to the current gym. */
async function getGymPhoto(photoId: string) {
  const gym = await getGym();
  const [row] = await db
    .select({ photo: photos, set: sets })
    .from(photos)
    .innerJoin(sets, eq(photos.setId, sets.id))
    .where(and(eq(photos.id, photoId), eq(sets.gymId, gym.id)));
  if (!row) throw new Error("Photo not found.");
  return { ...row, gym };
}

async function getGymRoute(routeId: string) {
  const route = await db.query.routes.findFirst({ where: eq(routes.id, routeId) });
  if (!route) throw new Error("Route not found.");
  return { route, ...(await getGymPhoto(route.photoId)) };
}

async function run(fn: () => Promise<EditorRoute>): Promise<RouteResult> {
  try {
    const route = await fn();
    revalidatePath("/", "layout");
    return { route };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function createRoute(
  photoId: string,
  pin: { pinX: number; pinY: number },
  fields: RouteFields
): Promise<RouteResult> {
  const user = await requireAdmin();
  return run(async () => {
    const { photo, set, gym } = await getGymPhoto(photoId);
    const [route] = await db
      .insert(routes)
      .values({
        setId: set.id,
        photoId: photo.id,
        pinX: clampPin(pin.pinX),
        pinY: clampPin(pin.pinY),
        ...(await cleanFields(fields, gym.id)),
        // M1: attribution defaults to the creating admin; real per-route
        // setter assignment is M4 (PLAN §5).
        setterId: user.profile.id,
        status: setStatus(set) === "archived" ? "archived" : "active",
      })
      .returning();
    return toEditorRoute(route);
  });
}

export async function updateRoute(
  routeId: string,
  fields: RouteFields
): Promise<RouteResult> {
  await requireAdmin();
  return run(async () => {
    const { route, gym } = await getGymRoute(routeId);
    const [updated] = await db
      .update(routes)
      .set(await cleanFields(fields, gym.id))
      .where(eq(routes.id, route.id))
      .returning();
    return toEditorRoute(updated);
  });
}

export async function moveRoutePin(
  routeId: string,
  pin: { pinX: number; pinY: number }
): Promise<RouteResult> {
  await requireAdmin();
  return run(async () => {
    const { route } = await getGymRoute(routeId);
    const [updated] = await db
      .update(routes)
      .set({ pinX: clampPin(pin.pinX), pinY: clampPin(pin.pinY) })
      .where(eq(routes.id, route.id))
      .returning();
    return toEditorRoute(updated);
  });
}

export async function deleteRoute(routeId: string): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    const { route } = await getGymRoute(routeId);
    const [{ value }] = await db
      .select({ value: count() })
      .from(sends)
      .where(eq(sends.routeId, route.id));
    if (value > 0) {
      return {
        error: `${value} climber(s) logged this route — deleting would erase their sends.`,
      };
    }
    await db.delete(routes).where(eq(routes.id, route.id));
    revalidatePath("/", "layout");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
