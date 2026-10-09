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
  const { data: { user } } = await client.auth.getUser();
  const path = request.nextUrl.pathname;
  const authPage = path === "/login" || path === "/signup";
  if (user && authPage) return copyCookies(response, NextResponse.redirect(new URL("/dashboard", request.url)));
  if (!user && path.startsWith("/dashboard")) return copyCookies(response, NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, request.url)));
  return response;
}

export const config = { matcher: ["/login", "/signup", "/dashboard/:path*"] };
