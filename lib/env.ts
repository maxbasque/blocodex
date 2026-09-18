const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

/**
 * Call at the point of use (client factories, route handlers), never at
 * module import time — otherwise `next build` would require real secrets.
 */
export function assertEnv(): Record<RequiredEnvVar, string> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  return Object.fromEntries(
    REQUIRED_ENV_VARS.map((key) => [key, process.env[key] as string])
  ) as Record<RequiredEnvVar, string>;
}
