import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../lib/adminAuth";

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ user: { email: admin.email, username: admin.username } });
}
