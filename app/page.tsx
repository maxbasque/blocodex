import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold">Blocodex</h1>
      <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
        Browse the routes currently up, tick the ones you&rsquo;ve sent, and
        climb the leaderboard.
      </p>
      <div className="flex gap-3">
        <Link
          href="/routes"
          className="rounded-md bg-foreground px-4 py-2 text-background"
        >
          See current set
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-black/10 px-4 py-2 dark:border-white/15"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
