// Reads settings from .env.local with clear errors about what's missing.
// Supabase calls the public key "publishable" (new) or "anon" (old); either name works.

function need(name: string, value: string | undefined, hint: string): string {
  const v = value?.trim().replace(/^["']|["']$/g, "");
  if (!v) throw new Error(`Missing ${name} in .env.local. ${hint} Then stop the server (Ctrl+C) and run npm run dev again.`);
  return v;
}

export const supabaseUrl = () =>
  need("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL, "Copy the Project URL (https://xxxx.supabase.co) from Supabase → Connect.");

export const supabasePublicKey = () =>
  need(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    "Copy the publishable key (sb_publishable_…) from Supabase → Project Settings → API Keys.",
  );

export const supabaseSecretKey = () =>
  need(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY,
    "Copy the secret key (sb_secret_…) from Supabase → Project Settings → API Keys.",
  );
