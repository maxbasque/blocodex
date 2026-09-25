import type { sets } from "@/db/schema";

export type SetStatus = "draft" | "published" | "archived";

export function setStatus(
  set: Pick<typeof sets.$inferSelect, "publishedAt" | "archivedAt">
): SetStatus {
  if (set.archivedAt) return "archived";
  if (set.publishedAt) return "published";
  return "draft";
}
