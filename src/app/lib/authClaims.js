import { fetchAuthSession } from "aws-amplify/auth/server";
import { runWithAmplifyServerContext } from "@/app/lib/amplifyServerUtils";

// No database imports here: the middleware (edge runtime) uses this file too.

export const ADMIN_GROUP = "admins";

/** Verified Cognito ID token claims for this request, or null when signed out. */
export async function getIdTokenClaims(nextServerContext) {
  return runWithAmplifyServerContext({
    nextServerContext,
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        return session.tokens?.idToken?.payload ?? null;
      } catch {
        return null;
      }
    },
  });
}
