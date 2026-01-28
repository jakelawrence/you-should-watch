// app/api/admin/providers/add/route.js
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../lib/adminAuth";
import { saveProvider, updateProvider } from "../../lib/dynamodb";

export async function POST(req) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provider = await req.json();
    console.log("Adding provider:", provider);

    // Save to DynamoDB providers table
    await saveProvider(provider);

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { provider_id, provider_name, type, logo_path } = await request.json();
    const result = await updateProvider({ provider_id, provider_name, type, logo_path });
    return NextResponse.json({ message: "Provider updated successfully", result });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: "Failed to update provider" }, { status: 500 });
  }
}
