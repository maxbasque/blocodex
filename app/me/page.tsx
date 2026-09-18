import { requireUser } from "@/lib/auth";

export default async function MePage() {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">
        {user.profile.displayName}&rsquo;s dex
      </h1>
      <p className="text-zinc-500">
        Points, send history, and dex % — coming in M3.
      </p>
    </div>
  );
}
