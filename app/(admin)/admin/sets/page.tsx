import { count, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { routes, sets } from "@/db/schema";
import { getGym } from "@/lib/gym";
import { setStatus } from "@/lib/sets";
import { ActionForm } from "../_components/action-form";
import { card, input, primaryButton } from "../_components/ui";
import { createSet } from "./actions";
import { SetStatusBadge } from "./status-badge";

export default async function SetsPage() {
  const gym = await getGym();
  const rows = await db
    .select({ set: sets, routeCount: count(routes.id) })
    .from(sets)
    .leftJoin(routes, eq(routes.setId, sets.id))
    .where(eq(sets.gymId, gym.id))
    .groupBy(sets.id)
    .orderBy(desc(sets.setDate));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Sets</h2>
        <p className="text-sm text-zinc-500">
          A set is one reset cycle. Draft it, pin its routes, publish it to climbers, and
          archive it when the holds come down — sends and leaderboards are kept forever.
        </p>
      </div>

      <ActionForm action={createSet} className="flex flex-wrap items-center gap-2">
        <input name="name" placeholder="e.g. Autumn 2026" className={`${input} min-w-48 flex-1`} />
        <input
          name="setDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          aria-label="Set date"
          className={input}
        />
        <button type="submit" className={primaryButton}>
          New set
        </button>
      </ActionForm>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No sets yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ set, routeCount }) => (
            <li key={set.id}>
              <Link
                href={`/admin/sets/${set.id}`}
                className={`${card} flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5`}
              >
                <span className="flex-1 font-medium">{set.name}</span>
                <span className="text-sm text-zinc-500">
                  {set.setDate.toISOString().slice(0, 10)} · {routeCount} route
                  {routeCount === 1 ? "" : "s"}
                </span>
                <SetStatusBadge status={setStatus(set)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
