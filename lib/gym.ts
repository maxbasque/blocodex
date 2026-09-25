import { asc } from "drizzle-orm";
import { db } from "@/db";
import { gyms } from "@/db/schema";

/**
 * Single-gym for now (PLAN §1): every admin screen operates on the one seeded
 * gym. Multi-gym would swap this for a tenant lookup (slug/domain/session).
 */
export async function getGym() {
  const gym = await db.query.gyms.findFirst({ orderBy: asc(gyms.name) });
  if (!gym) {
    throw new Error("No gym found — run `npm run db:seed` first.");
  }
  return gym;
}
