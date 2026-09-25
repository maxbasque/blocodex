import type { SetStatus } from "@/lib/sets";

const STYLES: Record<SetStatus, string> = {
  draft: "bg-zinc-500/15 text-zinc-500",
  published: "bg-green-500/15 text-green-600 dark:text-green-400",
  archived: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

export function SetStatusBadge({ status }: { status: SetStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STYLES[status]}`}>
      {status}
    </span>
  );
}
