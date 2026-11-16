import { auth } from "@/auth";

/** Returns the signed-in user if they are in the Cognito "admins" group, otherwise null. */
export async function verifyAdmin() {
  const session = await auth();
  return session?.user?.isAdmin ? session.user : null;
}
