import { and, asc, count, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { photos, routes, sets, walls } from "@/db/schema";
import { getGym } from "@/lib/gym";
import { photoUrl } from "@/lib/photos";
import { setStatus } from "@/lib/sets";
import { ActionForm } from "../../_components/action-form";
import { MoveButtons } from "../../_components/move-buttons";
import { button, card, dangerButton, input, primaryButton } from "../../_components/ui";
import { deletePhoto, deleteSet, movePhoto, transitionSet, updatePhoto, updateSet } from "../actions";
import { SetStatusBadge } from "../status-badge";
import { PhotoUploader } from "./photo-uploader";

const TRANSITIONS = {
  draft: [{ to: "published", label: "Publish", confirm: "Publish this set to climbers?" }],
  published: [
    { to: "draft", label: "Unpublish", confirm: "Hide this set from climbers again?" },
    {
      to: "archived",
      label: "Archive",
      confirm: "Archive this set? Its routes come down; sends and leaderboards are kept.",
    },
  ],
  archived: [{ to: "published", label: "Unarchive", confirm: "Put this set's routes back up?" }],
} as const;

export default async function SetPage({ params }: PageProps<"/admin/sets/[setId]">) {
  const { setId } = await params;
  const gym = await getGym();
  const set = await db.query.sets.findFirst({
    where: and(eq(sets.id, setId), eq(sets.gymId, gym.id)),
  });
  if (!set) notFound();

  const [setPhotos, wallRows, routeCounts] = await Promise.all([
    db.query.photos.findMany({
      where: eq(photos.setId, set.id),
      orderBy: [asc(photos.sortOrder), asc(photos.id)],
    }),
    db.query.walls.findMany({
      where: eq(walls.gymId, gym.id),
      orderBy: [asc(walls.sortOrder), asc(walls.name)],
    }),
    db
      .select({ photoId: routes.photoId, value: count() })
      .from(routes)
      .where(eq(routes.setId, set.id))
      .groupBy(routes.photoId),
  ]);
  const routesByPhoto = new Map(routeCounts.map((r) => [r.photoId, r.value]));
  const totalRoutes = routeCounts.reduce((sum, r) => sum + r.value, 0);
  const status = setStatus(set);

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href="/admin/sets" className="text-sm text-zinc-500 hover:underline">
          ← All sets
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold">{set.name}</h2>
          <SetStatusBadge status={status} />
          <span className="text-sm text-zinc-500">
            {setPhotos.length} photo{setPhotos.length === 1 ? "" : "s"} · {totalRoutes} route
            {totalRoutes === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TRANSITIONS[status].map((t) => (
            <ActionForm key={t.to} action={transitionSet} confirm={t.confirm}>
              <input type="hidden" name="id" value={set.id} />
              <input type="hidden" name="to" value={t.to} />
              <button type="submit" className={t.to === "published" ? primaryButton : button}>
                {t.label}
              </button>
            </ActionForm>
          ))}
          {status === "draft" && (
            <ActionForm
              action={deleteSet}
              confirm={`Delete “${set.name}” and all its photos and routes? This can't be undone.`}
            >
              <input type="hidden" name="id" value={set.id} />
              <button type="submit" className={dangerButton}>
                Delete set
              </button>
            </ActionForm>
          )}
        </div>

        <ActionForm action={updateSet} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={set.id} />
          <input name="name" defaultValue={set.name} aria-label="Name" className={`${input} min-w-48 flex-1`} />
          <input
            name="setDate"
            type="date"
            defaultValue={set.setDate.toISOString().slice(0, 10)}
            aria-label="Set date"
            className={input}
          />
          <button type="submit" className={button}>
            Save
          </button>
        </ActionForm>
      </div>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Wall photos</h3>
        <PhotoUploader setId={set.id} walls={wallRows.map(({ id, name }) => ({ id, name }))} />

        {setPhotos.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No photos yet. Upload one per wall section, then tap into each to pin its routes.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {setPhotos.map((photo, index) => {
              const n = routesByPhoto.get(photo.id) ?? 0;
              const tagHref = `/admin/sets/${set.id}/photos/${photo.id}`;
              return (
                <li key={photo.id} className={`${card} flex flex-col gap-3 sm:flex-row`}>
                  <Link href={tagHref} className="shrink-0">
                    {/* Pre-sized WebP thumbnail from Supabase Storage (PLAN §6). */}
                    <img
                      src={photoUrl(photo.thumbPath ?? photo.storagePath)}
                      alt={photo.caption ?? "Wall photo"}
                      width={photo.width}
                      height={photo.height}
                      className="h-32 w-full rounded-md object-cover sm:w-48"
                    />
                  </Link>
                  <div className="flex flex-1 flex-col gap-2">
                    <ActionForm action={updatePhoto} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={photo.id} />
                      <select name="wallId" defaultValue={photo.wallId ?? ""} aria-label="Wall" className={input}>
                        <option value="">No wall</option>
                        {wallRows.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                      <input
                        name="caption"
                        defaultValue={photo.caption ?? ""}
                        placeholder="Caption (optional)"
                        className={`${input} min-w-40 flex-1`}
                      />
                      <button type="submit" className={button}>
                        Save
                      </button>
                    </ActionForm>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={tagHref} className={primaryButton}>
                        Tag routes ({n})
                      </Link>
                      <MoveButtons id={photo.id} index={index} total={setPhotos.length} action={movePhoto} />
                      <ActionForm
                        action={deletePhoto}
                        confirm={
                          n > 0
                            ? `Delete this photo and its ${n} route(s)?`
                            : "Delete this photo?"
                        }
                        className="ml-auto"
                      >
                        <input type="hidden" name="id" value={photo.id} />
                        <button type="submit" className={dangerButton}>
                          Delete
                        </button>
                      </ActionForm>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
