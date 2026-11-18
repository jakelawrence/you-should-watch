import { NextResponse } from "next/server";
import { getIdTokenClaims, ADMIN_GROUP } from "@/app/lib/authClaims";

const protectedRoutes = ["/home", "/profile", "/scenario"];

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  const response = NextResponse.next();

  // Passing the response lets Amplify write refreshed tokens back as cookies.
  const claims = await getIdTokenClaims({ request, response });

  if (path.startsWith("/admin")) {
    const groups = claims?.["cognito:groups"] || [];
    if (!claims) return redirectToLogin(request, path);
    if (!groups.includes(ADMIN_GROUP)) return noStore(NextResponse.redirect(new URL("/", request.url)));
    return noStore(response);
  }

  if (protectedRoutes.some((route) => path.startsWith(route))) {
    return claims ? noStore(response) : redirectToLogin(request, path);
  }
  return response;
}

// Every answer here depends on the visitor's session, so a CDN must not store it. Otherwise a
// cached page could skip this check for signed-out visitors, or a cached redirect could lock out
// signed-in ones.
function noStore(response) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function redirectToLogin(request, path) {
  const url = new URL("/login", request.url);
  url.searchParams.set("returnTo", `${path}${request.nextUrl.search}`);
  return noStore(NextResponse.redirect(url));
}

export const config = {
  matcher: ["/home/:path*", "/profile/:path*", "/scenario/:path*", "/admin/:path*"],
};
