// Gate for Cody-only pages and actions. Every admin page and Server Action calls this.
import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireAdmin() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { user, db: supabaseAdmin() as any };
}

/** Same check for Server Actions: throws instead of redirecting. */
export async function assertAdmin() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Sign in again.");
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Only Cody can do that.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { user, db: supabaseAdmin() as any };
}
