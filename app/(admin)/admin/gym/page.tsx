import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { gradeScale, walls } from "@/db/schema";
import { getGym } from "@/lib/gym";
import { ActionForm } from "../_components/action-form";
import { MoveButtons } from "../_components/move-buttons";
import { button, card, dangerButton, input, primaryButton } from "../_components/ui";
import {
  createGrade,
  createWall,
  deleteGrade,
  deleteWall,
  moveGrade,
  moveWall,
  updateGrade,
  updateWall,
} from "./actions";

export default async function GymSetupPage() {
  const gym = await getGym();
  const [grades, wallRows] = await Promise.all([
    db.query.gradeScale.findMany({
      where: eq(gradeScale.gymId, gym.id),
      orderBy: [asc(gradeScale.sortOrder), asc(gradeScale.defaultPoints)],
    }),
    db.query.walls.findMany({
      where: eq(walls.gymId, gym.id),
      orderBy: [asc(walls.sortOrder), asc(walls.name)],
    }),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">Grade scale</h2>
          <p className="text-sm text-zinc-500">
            Colors are the grade; annotate the V-scale range in the label, e.g.
            &ldquo;Yellow (V0–V1)&rdquo;. Changing points recomputes every
            leaderboard, past sets included.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {grades.map((grade, index) => (
            <li key={grade.id} className={`${card} flex flex-wrap items-center gap-2`}>
              <MoveButtons
                id={grade.id}
                index={index}
                total={grades.length}
                action={moveGrade}
              />
              <ActionForm action={updateGrade} className="flex flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={grade.id} />
                <input
                  type="color"
                  name="colorHint"
                  defaultValue={grade.colorHint ?? "#888888"}
                  aria-label="Color"
                  className="h-9 w-10 cursor-pointer rounded border border-black/15 bg-transparent dark:border-white/20"
                />
                <input
                  name="label"
                  defaultValue={grade.label}
                  aria-label="Label"
                  className={`${input} min-w-40 flex-1`}
                />
                <input
                  name="defaultPoints"
                  type="number"
                  min={0}
                  defaultValue={grade.defaultPoints}
                  aria-label="Points"
                  className={`${input} w-24`}
                />
                <button type="submit" className={button}>
                  Save
                </button>
              </ActionForm>
              <ActionForm action={deleteGrade} confirm={`Delete grade “${grade.label}”?`}>
                <input type="hidden" name="id" value={grade.id} />
                <button type="submit" className={dangerButton}>
                  Delete
                </button>
              </ActionForm>
            </li>
          ))}
        </ul>

        <ActionForm action={createGrade} className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            name="colorHint"
            defaultValue="#888888"
            aria-label="Color"
            className="h-9 w-10 cursor-pointer rounded border border-black/15 bg-transparent dark:border-white/20"
          />
          <input name="label" placeholder="New grade label" className={`${input} min-w-40 flex-1`} />
          <input
            name="defaultPoints"
            type="number"
            min={0}
            placeholder="Points"
            className={`${input} w-24`}
          />
          <button type="submit" className={primaryButton}>
            Add grade
          </button>
        </ActionForm>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">Walls</h2>
          <p className="text-sm text-zinc-500">
            Optional groupings for wall photos (e.g. &ldquo;Cave&rdquo;,
            &ldquo;Slab&rdquo;). Deleting a wall just unassigns its photos.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {wallRows.map((wall, index) => (
            <li key={wall.id} className={`${card} flex flex-wrap items-center gap-2`}>
              <MoveButtons
                id={wall.id}
                index={index}
                total={wallRows.length}
                action={moveWall}
              />
              <ActionForm action={updateWall} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="id" value={wall.id} />
                <input
                  name="name"
                  defaultValue={wall.name}
                  aria-label="Name"
                  className={`${input} min-w-40 flex-1`}
                />
                <button type="submit" className={button}>
                  Save
                </button>
              </ActionForm>
              <ActionForm action={deleteWall} confirm={`Delete wall “${wall.name}”?`}>
                <input type="hidden" name="id" value={wall.id} />
                <button type="submit" className={dangerButton}>
                  Delete
                </button>
              </ActionForm>
            </li>
          ))}
        </ul>

        <ActionForm action={createWall} className="flex items-center gap-2">
          <input name="name" placeholder="New wall name" className={`${input} min-w-40 flex-1`} />
          <button type="submit" className={primaryButton}>
            Add wall
          </button>
        </ActionForm>
      </section>
    </div>
  );
}
