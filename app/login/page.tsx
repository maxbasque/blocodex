"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold">Sign in to Blocodex</h1>

      <form onSubmit={sendMagicLink} className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-black/10 px-4 py-2 dark:border-white/15"
        />
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-background"
        >
          Send magic link
        </button>
        {status === "sent" && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Check your email for a sign-in link.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </form>

      <div className="flex w-full max-w-sm items-center gap-3 text-sm text-zinc-500">
        <div className="h-px flex-1 bg-black/10 dark:bg-white/15" />
        or
        <div className="h-px flex-1 bg-black/10 dark:bg-white/15" />
      </div>

      <button
        onClick={signInWithGoogle}
        className="w-full max-w-sm rounded-md border border-black/10 px-4 py-2 dark:border-white/15"
      >
        Continue with Google
      </button>
    </div>
  );
}
