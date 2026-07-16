import { NextResponse, type NextRequest } from "next/server";

/**
 * UX-level route guard. Real security is enforced by Firestore
 * security rules and ID-token verification in /api/generate.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hasAuthCookie =
    request.cookies.has("nexora-auth") || request.cookies.has("vaani-auth");

  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/builder") ||
    path.startsWith("/admin") ||
    path.startsWith("/deployments") ||
    path.startsWith("/connections");

  if (isProtected && !hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if ((path === "/login" || path === "/signup") && hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/builder/:path*",
    "/admin/:path*",
    "/deployments/:path*",
    "/connections/:path*",
    "/login",
    "/signup",
  ],
};
