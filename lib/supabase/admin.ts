import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { assertEnv } from "@/lib/env";

/**
 * Service-role client for Storage admin operations (bucket setup, signed
 * upload URLs, writing processed photos). Server-only — never import this
 * from a Client Component; the key bypasses all Storage policies.
 */
export function createAdminClient() {
  const env = assertEnv();
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
