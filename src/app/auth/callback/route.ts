// Where the "confirm your email" link lands. Swaps the one-time code for a login session.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/shop";
  if (code) {
    const db = await supabaseServer();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/shop", url.origin));
  }
  return NextResponse.redirect(new URL("/login", url.origin));
}
