// app/api/admin/providers/add/route.js
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../lib/adminAuth";
import { updateProvider, deleteProvider } from "../../../lib/dynamodb";

export async function PUT(request, { params }) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { provider_id, provider_name, type, logo_path } = await request.json();
    const result = await updateProvider(id, { provider_id, provider_name, type, logo_path });
    return NextResponse.json({ message: "Provider updated successfully", result });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: "Failed to update provider" }, { status: 500 });
  }
}

//Delete provider
export async function DELETE(request, { params }) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Here you would call a function to delete the provider from the database
    await deleteProvider(id);
    return NextResponse.json({ message: "Provider deleted successfully" });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: "Failed to delete provider" }, { status: 500 });
  }
}
