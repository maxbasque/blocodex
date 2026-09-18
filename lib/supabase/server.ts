import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { assertEnv } from "@/lib/env";

export async function createClient() {
  // Reading cookies first opts the route into dynamic rendering before
  // assertEnv() can throw — otherwise a build without real env vars would
  // fail prerendering instead of deferring this route to request time.
  const cookieStore = await cookies();
  const env = assertEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component with no way to set cookies —
            // proxy.ts refreshes the session instead.
          }
        },
      },
    }
  );
}
