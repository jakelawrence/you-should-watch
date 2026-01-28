import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export async function getCurrentUser() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    return decoded;
  } catch (error) {
    return null;
  }
}
