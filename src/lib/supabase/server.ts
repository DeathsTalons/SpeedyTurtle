// Supabase client for Server Components, Server Actions and Route Handlers.
// Acts as the signed-in customer, so the database security rules apply.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseUrl, supabasePublicKey } from "@/lib/env";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublicKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes sessions instead.
        }
      },
    },
  });
}

export async function currentUser() {
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  return data.user;
}
