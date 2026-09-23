import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (the exported function is
// now `proxy`, not `middleware`). This keeps the Supabase auth session
// cookie refreshed on every request, per the @supabase/ssr Next.js pattern.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let isAuthed = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      isAuthed = true;
    } else if (error) {
      // If there's an error but auth-token cookie exists, check for network/transient failures
      const hasAuthCookie = request.cookies
        .getAll()
        .some((c) => c.name.includes("auth-token") && Boolean(c.value));
      if (hasAuthCookie && (error.message?.includes("fetch") || error.status === 500 || error.status === 503)) {
        isAuthed = true;
      }
    }
  } catch (err) {
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.includes("auth-token") && Boolean(c.value));
    if (hasAuthCookie) {
      isAuthed = true;
    }
  }

  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth");
  const isAsset =
    path.startsWith("/_next") || path.startsWith("/api") || path.includes(".");

  if (!isAuthed && !isPublic && !isAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isAuthed && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)",
  ],
};
