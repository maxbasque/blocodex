import { count } from "drizzle-orm";
import { db } from "@/db";
import { gyms, sets, routes, profiles } from "@/db/schema";

async function getCounts() {
  const [gymCount] = await db.select({ value: count() }).from(gyms);
  const [setCount] = await db.select({ value: count() }).from(sets);
  const [routeCount] = await db.select({ value: count() }).from(routes);
  const [profileCount] = await db.select({ value: count() }).from(profiles);

  return {
    gyms: gymCount.value,
    sets: setCount.value,
    routes: routeCount.value,
    profiles: profileCount.value,
  };
}

export default async function AdminDashboardPage() {
  const counts = await getCounts();

  const stats = [
    { label: "Gyms", value: counts.gyms },
    { label: "Sets", value: counts.sets },
    { label: "Routes", value: counts.routes },
    { label: "Climbers", value: counts.profiles },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <p className="text-2xl font-semibold">{stat.value}</p>
          <p className="text-sm text-zinc-500">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
