import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from "next/server";

const protectedRoutes = ["/home", "/profile", "/profile/saved-movies", "/profile/settings", "/scenario", "/profile/streaming-service"];
const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const path = request.nextUrl.pathname;
  if (protectedRoutes.some((route) => path.startsWith(route))) {
    if (!request.auth?.user) {
      const url = new URL("/login", request.url);
      url.searchParams.set("returnTo", `${path}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/home/:path*", "/profile/:path*", "/scenario/:path*", "/profile/streaming-service/:path*"],
};
