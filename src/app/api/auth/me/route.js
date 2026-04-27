import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      username: session.user.username,
      email: session.user.email,
      name: session.user.name,
      isAdmin: session.user.isAdmin || false,
    },
  });
}
