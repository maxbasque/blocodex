export type EditorRoute = {
  id: string;
  pinX: number;
  pinY: number;
  color: string;
  gradeId: string | null;
  pointsOverride: number | null;
  name: string | null;
  notes: string | null;
};

export type EditorGrade = {
  id: string;
  label: string;
  colorHint: string | null;
  defaultPoints: number;
};

export type RouteFields = Omit<EditorRoute, "id" | "pinX" | "pinY">;

export type RouteResult = { error: string } | { route: EditorRoute };
