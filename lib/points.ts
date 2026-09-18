export function pointsFor(
  route: { pointsOverride: number | null },
  gradeScale: { defaultPoints: number } | null
): number {
  return route.pointsOverride ?? gradeScale?.defaultPoints ?? 0;
}
