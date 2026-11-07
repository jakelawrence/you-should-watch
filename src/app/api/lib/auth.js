import jwt from "jsonwebtoken";
import { getJwtSecret } from "./jwtSecret";
import { cookies } from "next/headers";

export async function getCurrentUser() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, getJwtSecret());
    return decoded;
  } catch (error) {
    return null;
  }
}
