// Keeps customers signed in (refreshes the login cookie) and sends signed-out
// visitors to the sign-in page when they open a page that needs an account.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseUrl, supabasePublicKey } from "@/lib/env";

const NEEDS_ACCOUNT = ["/shop", "/cart", "/checkout", "/orders", "/account", "/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const db = createServerClient(supabaseUrl(), supabasePublicKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await db.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!data.user && NEEDS_ACCOUNT.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
