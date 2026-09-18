import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const envOk = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
  ].every((key) => Boolean(process.env[key]));

  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const ok = envOk && dbOk;

  return NextResponse.json({ ok, env: envOk, db: dbOk }, { status: ok ? 200 : 503 });
}
