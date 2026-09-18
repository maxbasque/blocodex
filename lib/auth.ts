import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  authId: string;
  email: string | null;
  profile: typeof profiles.$inferSelect;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  let profile = await db.query.profiles.findFirst({
    where: eq(profiles.authId, user.id),
  });

  if (!profile) {
    [profile] = await db
      .insert(profiles)
      .values({
        authId: user.id,
        displayName:
          (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          "Climber",
        avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        isAdmin: user.id === process.env.ADMIN_AUTH_ID,
      })
      .returning();
  }

  return { authId: user.id, email: user.email ?? null, profile };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.profile.isAdmin) {
    redirect("/");
  }
  return user;
}
