import { defineAuth, secret } from "@aws-amplify/backend";
import { migrateUser } from "../functions/migrate-user/resource";

// Sign-in and return addresses for every place the app runs. Cognito only redirects to these.
// Add the production domain here when it exists.
const appOrigins = [
  "http://localhost:3000",
  "https://amplify-phase-1.d327p6sk4vykqb.amplifyapp.com",
  "https://cognito-auth.d327p6sk4vykqb.amplifyapp.com",
];

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: "Your You Should Watch verification code",
      verificationEmailBody: (createCode: () => string) => `Your verification code is ${createCode()}`,
    },
    externalProviders: {
      google: {
        clientId: secret("GOOGLE_CLIENT_ID"),
        clientSecret: secret("GOOGLE_CLIENT_SECRET"),
        scopes: ["email", "profile", "openid"],
        attributeMapping: {
          email: "email",
          emailVerified: "email_verified",
          fullname: "name",
        },
      },
      callbackUrls: appOrigins.map((origin) => `${origin}/`),
      logoutUrls: appOrigins.map((origin) => `${origin}/`),
    },
  },
  userAttributes: {
    fullname: { required: false, mutable: true },
  },
  accountRecovery: "EMAIL_ONLY",
  groups: ["admins"],
  triggers: {
    // Moves existing email/password users from Postgres into Cognito on their first sign-in
    // or password reset. Remove once every active user has signed in at least once.
    userMigration: migrateUser,
  },
});
