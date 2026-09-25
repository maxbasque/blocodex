/**
 * Returns `ids` with `id` swapped one slot up or down; unchanged at the ends.
 * Callers rewrite sort_order = index for the result, which also heals any
 * duplicate/gapped sort_order values left over from earlier inserts.
 */
export function moveId(ids: string[], id: string, direction: "up" | "down") {
  const next = [...ids];
  const from = next.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
