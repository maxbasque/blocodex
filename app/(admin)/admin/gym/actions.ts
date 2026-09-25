"use server";

import { and, asc, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { gradeScale, routes, walls } from "@/db/schema";
import {
  ActionError,
  type ActionState,
  optionalInt,
  requiredStr,
  str,
  withAction,
} from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { getGym } from "@/lib/gym";
import { moveId } from "@/lib/reorder";

function parseGrade(formData: FormData) {
  const defaultPoints = optionalInt(formData, "defaultPoints", "Points");
  if (defaultPoints === null) throw new ActionError("Points is required.");
  const colorHint = str(formData, "colorHint");
  return {
    label: requiredStr(formData, "label", "Label"),
    colorHint: /^#[0-9a-f]{6}$/i.test(colorHint) ? colorHint : null,
    defaultPoints,
  };
}

export async function createGrade(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const gym = await getGym();
    const [{ value: n }] = await db
      .select({ value: count() })
      .from(gradeScale)
      .where(eq(gradeScale.gymId, gym.id));
    await db
      .insert(gradeScale)
      .values({ gymId: gym.id, sortOrder: n, ...parseGrade(formData) });
    revalidatePath("/", "layout");
  });
}

export async function updateGrade(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const gym = await getGym();
    await db
      .update(gradeScale)
      .set(parseGrade(formData))
      .where(
        and(
          eq(gradeScale.id, requiredStr(formData, "id")),
          eq(gradeScale.gymId, gym.id)
        )
      );
    // Points are derived, never snapshotted (PLAN §4) — every leaderboard
    // recomputes from the new value, so revalidate everything.
    revalidatePath("/", "layout");
  });
}

export async function deleteGrade(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const gym = await getGym();
    const id = requiredStr(formData, "id");
    const [{ value: used }] = await db
      .select({ value: count() })
      .from(routes)
      .where(eq(routes.gradeId, id));
    if (used > 0) {
      // Deleting would null routes.grade_id and silently zero their points.
      throw new ActionError(
        `${used} route(s) use this grade — regrade them before deleting it.`
      );
    }
    await db
      .delete(gradeScale)
      .where(and(eq(gradeScale.id, id), eq(gradeScale.gymId, gym.id)));
    revalidatePath("/", "layout");
  });
}

export async function moveGrade(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const gym = await getGym();
    const rows = await db
      .select({ id: gradeScale.id })
      .from(gradeScale)
      .where(eq(gradeScale.gymId, gym.id))
      .orderBy(asc(gradeScale.sortOrder), asc(gradeScale.defaultPoints));
    const order = moveId(
      rows.map((r) => r.id),
      requiredStr(formData, "id"),
      str(formData, "direction") === "up" ? "up" : "down"
    );
    await db.transaction(async (tx) => {
      for (const [sortOrder, id] of order.entries()) {
        await tx.update(gradeScale).set({ sortOrder }).where(eq(gradeScale.id, id));
      }
    });
    revalidatePath("/", "layout");
  });
}

export async function createWall(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const gym = await getGym();
    const [{ value: n }] = await db
      .select({ value: count() })
      .from(walls)
      .where(eq(walls.gymId, gym.id));
    await db.insert(walls).values({
      gymId: gym.id,
      name: requiredStr(formData, "name", "Name"),
      sortOrder: n,
    });
    revalidatePath("/", "layout");
  });
}

export async function updateWall(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const gym = await getGym();
    await db
      .update(walls)
      .set({ name: requiredStr(formData, "name", "Name") })
      .where(and(eq(walls.id, requiredStr(formData, "id")), eq(walls.gymId, gym.id)));
    revalidatePath("/", "layout");
  });
}

export async function deleteWall(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const gym = await getGym();
    // photos.wall_id is ON DELETE SET NULL — photos just become unassigned.
    await db
      .delete(walls)
      .where(and(eq(walls.id, requiredStr(formData, "id")), eq(walls.gymId, gym.id)));
    revalidatePath("/", "layout");
  });
}

export async function moveWall(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  return withAction(async () => {
    const gym = await getGym();
    const rows = await db
      .select({ id: walls.id })
      .from(walls)
      .where(eq(walls.gymId, gym.id))
      .orderBy(asc(walls.sortOrder), asc(walls.name));
    const order = moveId(
      rows.map((r) => r.id),
      requiredStr(formData, "id"),
      str(formData, "direction") === "up" ? "up" : "down"
    );
    await db.transaction(async (tx) => {
      for (const [sortOrder, id] of order.entries()) {
        await tx.update(walls).set({ sortOrder }).where(eq(walls.id, id));
      }
    });
    revalidatePath("/", "layout");
  });
}
