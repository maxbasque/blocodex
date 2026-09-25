import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { gradeScale, photos, routes, sets, walls } from "@/db/schema";
import { getGym } from "@/lib/gym";
import { photoUrl } from "@/lib/photos";
import { PinEditor } from "./pin-editor";

export default async function TagPhotoPage({
  params,
}: PageProps<"/admin/sets/[setId]/photos/[photoId]">) {
  const { setId, photoId } = await params;
  const gym = await getGym();

  const [row] = await db
    .select({ photo: photos, set: sets, wallName: walls.name })
    .from(photos)
    .innerJoin(sets, eq(photos.setId, sets.id))
    .leftJoin(walls, eq(photos.wallId, walls.id))
    .where(and(eq(photos.id, photoId), eq(sets.id, setId), eq(sets.gymId, gym.id)));
  if (!row) notFound();

  const [photoRoutes, grades] = await Promise.all([
    db.query.routes.findMany({ where: eq(routes.photoId, photoId) }),
    db.query.gradeScale.findMany({
      where: eq(gradeScale.gymId, gym.id),
      orderBy: [asc(gradeScale.sortOrder), asc(gradeScale.defaultPoints)],
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/admin/sets/${setId}`} className="text-sm text-zinc-500 hover:underline">
          ← {row.set.name}
        </Link>
        <h2 className="text-xl font-semibold">
          {row.wallName ?? "Unassigned wall"}
          {row.photo.caption && (
            <span className="font-normal text-zinc-500"> · {row.photo.caption}</span>
          )}
        </h2>
      </div>
      <PinEditor
        // Remount on photo change so local editor state never leaks across photos.
        key={photoId}
        photo={{
          id: row.photo.id,
          url: photoUrl(row.photo.storagePath),
          width: row.photo.width,
          height: row.photo.height,
        }}
        initialRoutes={photoRoutes.map(
          ({ id, pinX, pinY, color, gradeId, pointsOverride, name, notes }) => ({
            id,
            pinX,
            pinY,
            color,
            gradeId,
            pointsOverride,
            name,
            notes,
          })
        )}
        grades={grades.map(({ id, label, colorHint, defaultPoints }) => ({
          id,
          label,
          colorHint,
          defaultPoints,
        }))}
      />
    </div>
  );
}
