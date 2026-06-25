import { NextResponse } from "next/server";
import { getUserSelectedStreamingServces, updateUserStreamingServices } from "../../lib/userRepository";
import { auth } from "@/auth";

async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.username || !session?.user?.email) {
    return null;
  }
  return session.user;
}

// GET - Load user's streaming services
export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let streamingServices = await getUserSelectedStreamingServces(user.email);

    return NextResponse.json({
      streamingServices,
    });
  } catch (error) {
    console.error("Error loading streaming services:", error);
    return NextResponse.json({ error: "Failed to load streaming services" }, { status: 500 });
  }
}

// POST - Save user's streaming services
export async function POST(req) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("Authenticated user:", user);
    const { streamingServices } = await req.json();
    await updateUserStreamingServices(user.username, streamingServices);

    return NextResponse.json({ success: true, streamingServices });
  } catch (error) {
    console.error("Error saving streaming services:", error);
    return NextResponse.json({ error: "Failed to save streaming services" }, { status: 500 });
  }
}
