import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function verifyAdmin(req) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("admin_token");

    if (!token) return null;

    const decoded = jwt.verify(token.value, process.env.JWT_SECRET || "your-secret-key");
    return decoded;
  } catch (error) {
    return null;
  }
}
