import { eq } from "drizzle-orm";
import { db } from "./index";
import { gyms, walls, gradeScale, profiles } from "./schema";

const GYM_SLUG = "blocodex-demo";

const GRADES = [
  { label: "Yellow", colorHint: "#facc15", defaultPoints: 100, sortOrder: 0 },
  { label: "Green", colorHint: "#22c55e", defaultPoints: 300, sortOrder: 1 },
  { label: "Blue", colorHint: "#3b82f6", defaultPoints: 500, sortOrder: 2 },
  { label: "Purple", colorHint: "#a855f7", defaultPoints: 700, sortOrder: 3 },
  { label: "Red", colorHint: "#ef4444", defaultPoints: 900, sortOrder: 4 },
  { label: "Black", colorHint: "#171717", defaultPoints: 1100, sortOrder: 5 },
] as const;

const WALL_NAMES = ["Cave", "Lead Wall"];

async function main() {
  let gym = await db.query.gyms.findFirst({ where: eq(gyms.slug, GYM_SLUG) });
  if (!gym) {
    [gym] = await db
      .insert(gyms)
      .values({ name: "Blocodex Demo Gym", slug: GYM_SLUG })
      .returning();
    console.log(`Created gym ${gym.name}`);
  }

  const existingWalls = await db.query.walls.findMany({
    where: eq(walls.gymId, gym.id),
  });
  for (const [index, name] of WALL_NAMES.entries()) {
    if (!existingWalls.some((w) => w.name === name)) {
      await db.insert(walls).values({ gymId: gym.id, name, sortOrder: index });
      console.log(`Created wall ${name}`);
    }
  }

  const existingGrades = await db.query.gradeScale.findMany({
    where: eq(gradeScale.gymId, gym.id),
  });
  for (const grade of GRADES) {
    if (!existingGrades.some((g) => g.label === grade.label)) {
      await db.insert(gradeScale).values({ gymId: gym.id, ...grade });
      console.log(`Created grade ${grade.label}`);
    }
  }

  const adminAuthId = process.env.ADMIN_AUTH_ID;
  if (adminAuthId) {
    const existing = await db.query.profiles.findFirst({
      where: eq(profiles.authId, adminAuthId),
    });
    if (existing) {
      if (!existing.isAdmin) {
        await db
          .update(profiles)
          .set({ isAdmin: true })
          .where(eq(profiles.authId, adminAuthId));
        console.log(`Marked profile ${existing.id} as admin`);
      }
    } else {
      await db
        .insert(profiles)
        .values({ authId: adminAuthId, displayName: "Admin", isAdmin: true });
      console.log(`Created admin profile for auth id ${adminAuthId}`);
    }
  } else {
    console.log("ADMIN_AUTH_ID not set — skipping admin profile setup");
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
