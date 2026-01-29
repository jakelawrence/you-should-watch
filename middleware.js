// middleware.js (root directory)
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export function middleware(request) {
  const token = request.cookies.get("auth_token")?.value;
  const path = request.nextUrl.pathname;

  // Routes that require authentication
  const protectedRoutes = ["/profile", "/profile/saved-movies", "/profile/settings", "/scenario", "/profile"];

  if (protectedRoutes.some((route) => path.startsWith(route))) {
    if (!token) {
      // Redirect to login with a return URL
      const url = new URL("/login", request.url);
      url.searchParams.set("returnTo", path);
      return NextResponse.redirect(url);
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
      return NextResponse.next();
    } catch (error) {
      // Invalid token - redirect to login
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("auth_token");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/profile/:path*", "/scenario/:path*", "/profile/:path*"],
};
