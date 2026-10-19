"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { geocodeAddress } from "@/lib/stores";

export type FormState = { error?: string; ok?: string };

async function requireUser() {
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  if (!data.user) throw new Error("Sign in first.");
  return { db, user: data.user };
}

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const { db, user } = await requireUser();
  const { error } = await db.from("profiles").update({
    full_name: String(form.get("full_name") ?? "").trim() || null,
    phone: String(form.get("phone") ?? "").trim() || null,
  }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/account");
  return { ok: "Saved." };
}

export async function addAddress(_: FormState, form: FormData): Promise<FormState> {
  const { db, user } = await requireUser();
  const addr = {
    line1: String(form.get("line1") ?? "").trim(),
    line2: String(form.get("line2") ?? "").trim() || null,
    city: String(form.get("city") ?? "").trim(),
    state: "IN",
    zip: String(form.get("zip") ?? "").trim(),
    delivery_notes: String(form.get("delivery_notes") ?? "").trim() || null,
  };
  if (!addr.line1 || !addr.city || !/^\d{5}$/.test(addr.zip)) return { error: "Enter a street address, city and 5-digit ZIP." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (supabaseAdmin() as any).from("settings").select("service_area_zips").single();
  const zips: string[] = settings?.service_area_zips ?? [];
  if (zips.length > 0 && !zips.includes(addr.zip)) return { error: `Speedy Turtle doesn't deliver to ${addr.zip} yet.` };

  const point = await geocodeAddress(addr);
  const { count } = await db.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  const { error } = await db.from("addresses").insert({
    ...addr, user_id: user.id, is_default: (count ?? 0) === 0,
    latitude: point?.latitude ?? null, longitude: point?.longitude ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/account");
  return { ok: point ? "Address saved." : "Address saved. Cody will confirm the nearest store for it." };
}

export async function makeDefault(id: string) {
  const { db, user } = await requireUser();
  await db.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  await db.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/account");
}

export async function deleteAddress(id: string) {
  const { db, user } = await requireUser();
  const { error } = await db.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error("This address is on a past order, so it can't be deleted.");
  revalidatePath("/account");
}
