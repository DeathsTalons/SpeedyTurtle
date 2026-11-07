"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/welcome") ? s : "/shop";
};

/** "Got it" on the fee screen: remember it, then send new customers to add their address first. */
export async function acknowledgeFees(form: FormData) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/welcome");
  await db.from("profiles").update({ fees_seen_at: new Date().toISOString() }).eq("id", user.id);
  const { count } = await db.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  redirect(count ? safeNext(form.get("next")) : "/account");
}
