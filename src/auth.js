import { cache } from "react";
import { cookies } from "next/headers";
import { getIdTokenClaims, ADMIN_GROUP } from "@/app/lib/authClaims";
import { createOAuthUser } from "@/app/api/lib/userRepository";

export { ADMIN_GROUP };

const isTrue = (value) => value === true || value === "true";

/**
 * Returns `{ user: { username, email, name, isAdmin, sub } }` for the signed-in user, or null.
 *
 * Identity always comes from the verified Cognito token, never from the request body. The user's
 * database row is matched by verified email (so email/password and Google sign-ins with the same
 * address share one account) and created on first sign-in. Admin rights come from the Cognito
 * "admins" group.
 */
export const auth = cache(async () => {
  const claims = await getIdTokenClaims({ cookies });
  if (!claims?.email || !isTrue(claims.email_verified)) return null;

  const user = await createOAuthUser({
    email: String(claims.email).toLowerCase(),
    name: claims.name,
    provider: Array.isArray(claims.identities) && claims.identities.length ? claims.identities[0].providerName : "cognito",
  });
  const groups = Array.isArray(claims["cognito:groups"]) ? claims["cognito:groups"] : [];

  return {
    user: {
      username: user.username,
      email: user.email,
      name: user.name || user.username,
      isAdmin: groups.includes(ADMIN_GROUP),
      sub: claims.sub,
    },
  };
});
