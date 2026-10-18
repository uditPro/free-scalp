import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./lib/config";

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  return to;
}

export async function proxy(request: NextRequest) {
  const { url, publishableKey } = supabaseConfig();
  if (!url || !publishableKey || publishableKey.startsWith("sb_secret_")) return NextResponse.next();

  let response = NextResponse.next({ request });
  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (entries: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value, options } of entries) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  // Auth refresh is a network call. A temporary Supabase outage, an expired
  // cookie, or a malformed stale cookie must not turn /login into a framework
  // error page. Treat that state as signed out and let the public auth page
  // render; protected pages still redirect to login below.
  let user: { id: string } | null = null;
  try {
    const result = await client.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }
  const path = request.nextUrl.pathname;
  const authPage = path === "/login" || path === "/signup";
  const privatePage = path === "/profile" || path.startsWith("/applications") || path.startsWith("/dashboard") || path.startsWith("/match");
  if (user && authPage) return copyCookies(response, NextResponse.redirect(new URL("/dashboard", request.url)));
  if (!user && privatePage) {
    const destination = `${path}${request.nextUrl.search}`;
    return copyCookies(response, NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(destination)}`, request.url)));
  }
  return response;
}

export const config = { matcher: ["/login", "/signup", "/dashboard/:path*", "/profile", "/applications/:path*"] };
