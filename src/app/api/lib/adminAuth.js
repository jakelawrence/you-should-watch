import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "./jwtSecret";

export async function verifyAdmin(req) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("admin_token");

    if (!token) return null;

    const decoded = jwt.verify(token.value, getJwtSecret());
    return decoded;
  } catch (error) {
    return null;
  }
}
