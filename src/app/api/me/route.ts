// Tiny "who am I" for the header: is the signed-in person Cody (admin)? Never cached.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ signedIn: false, admin: false }, { headers: { "Cache-Control": "no-store" } });
  const { data } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return NextResponse.json({ signedIn: true, admin: data?.role === "admin" }, { headers: { "Cache-Control": "no-store" } });
}
