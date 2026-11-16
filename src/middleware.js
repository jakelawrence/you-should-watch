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
    if (!groups.includes(ADMIN_GROUP)) return NextResponse.redirect(new URL("/", request.url));
    return response;
  }

  if (protectedRoutes.some((route) => path.startsWith(route)) && !claims) {
    return redirectToLogin(request, path);
  }
  return response;
}

function redirectToLogin(request, path) {
  const url = new URL("/login", request.url);
  url.searchParams.set("returnTo", `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/home/:path*", "/profile/:path*", "/scenario/:path*", "/admin/:path*"],
};
