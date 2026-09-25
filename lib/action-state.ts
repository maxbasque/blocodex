/** Return shape for form-driven admin Server Actions (see ActionForm). */
export type ActionState = { error?: string } | null;

/** Thrown by input parsers; caught by `withAction` and shown to the user. */
export class ActionError extends Error {}

export async function withAction(fn: () => Promise<void>): Promise<ActionState> {
  try {
    await fn();
    return null;
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
}

export function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function requiredStr(formData: FormData, key: string, label = key) {
  const value = str(formData, key);
  if (!value) throw new ActionError(`${label} is required.`);
  return value;
}

export function optionalInt(formData: FormData, key: string, label = key) {
  const value = str(formData, key);
  if (!value) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new ActionError(`${label} must be a whole number ≥ 0.`);
  }
  return n;
}
