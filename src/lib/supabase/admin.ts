// Master-key Supabase client. SERVER ONLY — bypasses security rules.
// Used for checkout (so prices/fees are computed here, not trusted from the browser)
// and for counting how full each delivery window is.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseSecretKey } from "@/lib/env";

let client: ReturnType<typeof createClient> | null = null;

export function supabaseAdmin() {
  client ??= createClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
