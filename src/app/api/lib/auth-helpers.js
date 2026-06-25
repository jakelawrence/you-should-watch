import { createOAuthUser as createOAuthUserRecord } from "./userRepository";

/**
 * Creates a new user record for OAuth sign-ups.
 * Email/password users are created via /api/auth/signup instead.
 */
export async function createOAuthUser({ email, name, provider }) {
  const user = await createOAuthUserRecord({ email, name, provider });
  return {
    ...user,
    oauthProviders: [provider],
  };
}
