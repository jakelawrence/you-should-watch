import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import { auth } from "./auth/resource";
import { migrateUser } from "./functions/migrate-user/resource";

const backend = defineBackend({ auth, migrateUser });

const { cfnUserPool, cfnUserPoolClient, cfnIdentityPool } = backend.auth.resources.cfnResources;

// Match the app's existing rule (8+ characters) so migrated passwords and the sign-up form agree.
cfnUserPool.policies = {
  passwordPolicy: {
    minimumLength: 8,
    requireLowercase: false,
    requireUppercase: false,
    requireNumbers: false,
    requireSymbols: false,
    temporaryPasswordValidityDays: 7,
  },
};

// The migration trigger needs the plain password, which only USER_PASSWORD_AUTH sends
// (over TLS, to Cognito). Keep SRP for clients that use it.
cfnUserPoolClient.explicitAuthFlows = [
  "ALLOW_USER_PASSWORD_AUTH",
  "ALLOW_USER_SRP_AUTH",
  "ALLOW_REFRESH_TOKEN_AUTH",
];
cfnUserPoolClient.preventUserExistenceErrors = "ENABLED";

// Amplify points Cognito at an SES identity for the exact sender address, but SES verifies the
// whole domain (DKIM, custom MAIL FROM). Point Cognito at the verified domain identity instead;
// any address on the domain can then send.
const { region, account } = Stack.of(cfnUserPool);
cfnUserPool.addPropertyOverride(
  "EmailConfiguration.SourceArn",
  `arn:aws:ses:${region}:${account}:identity/youshouldwatch.app`
);

// Identity pool: signed-in users (email/password or Google, via the user pool) get temporary
// AWS credentials from the authenticated role, which has no permissions until we grant some.
// No guest identities.
cfnIdentityPool.allowUnauthenticatedIdentities = false;
