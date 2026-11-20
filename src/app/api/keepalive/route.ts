// Daily check-in from Vercel Cron (see vercel.json) so Supabase's free plan never pauses the
// database for inactivity during slow weeks. Runs one tiny read; returns nothing private.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set; then only Vercel can call this.
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { error } = await supabaseAdmin().from("settings").select("id").limit(1);
  return NextResponse.json({ ok: !error, at: new Date().toISOString() }, { status: error ? 500 : 200, headers: { "Cache-Control": "no-store" } });
}
