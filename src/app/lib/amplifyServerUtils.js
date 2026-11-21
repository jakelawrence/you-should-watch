import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import outputs from "@amplify-outputs";

// Runs Amplify Auth calls on the server against the request's cookies. The adapter verifies the
// Cognito token signatures before trusting them.
export const { runWithAmplifyServerContext } = createServerRunner({ config: outputs });
