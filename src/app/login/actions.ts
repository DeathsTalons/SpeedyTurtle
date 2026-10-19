"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/shop";
};

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error) return { error: error.message === "Invalid login credentials" ? "That email and password don't match an account." : error.message };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const fullName = String(form.get("full_name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  if (!fullName) return { error: "Enter your name so Cody knows who the order is for." };
  if (password.length < 8) return { error: "Use a password with at least 8 characters." };

  const origin = (await headers()).get("origin") ?? "";
  const db = await supabaseServer();
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone }, emailRedirectTo: `${origin}/auth/callback?next=/account` },
  });
  if (error) return { error: error.message };

  if (data.session) redirect("/account"); // email confirmation turned off
  return { message: `Check ${email} for a confirmation link, then come back and sign in.` };
}

export async function signOut() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect("/");
}
