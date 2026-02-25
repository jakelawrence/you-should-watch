// middleware.js
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key");

export async function middleware(request) {
  const token = request.cookies.get("auth_token")?.value;
  const path = request.nextUrl.pathname;

  const protectedRoutes = ["/home", "/profile", "/profile/saved-movies", "/profile/settings", "/scenario", "/profile/streaming-service"];

  if (protectedRoutes.some((route) => path.startsWith(route))) {
    if (!token) {
      const url = new URL("/login", request.url);
      url.searchParams.set("returnTo", path);
      return NextResponse.redirect(url);
    }

    try {
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch (err) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("auth_token");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/home/:path*", "/profile/:path*", "/scenario/:path*", "/profile/streaming-service/:path*"],
};
