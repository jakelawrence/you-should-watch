// app/api/admin/auth/verify/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../../../lib/jwtSecret";

export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token");
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = jwt.verify(token.value, getJwtSecret());

    // Fetch user from database to verify admin status
    // const user = await getUserById(decoded.userId);
    // if (!user.isAdmin) throw new Error("Not admin");

    return NextResponse.json({
      user: {
        id: decoded.userId,
        email: decoded.email,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
