import type { UserMigrationTriggerHandler } from "aws-lambda";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { env } from "$amplify/env/migrate-user";

// One connection per warm Lambda container. Neon's pooled URL handles the fan-in.
let sql: ReturnType<typeof postgres> | undefined;
const db = () => (sql ??= postgres(env.DATABASE_URL, { max: 1, idle_timeout: 20, prepare: false }));

type LegacyUser = { email: string; name: string | null; password_hash: string | null };

async function findLegacyUser(email: string): Promise<LegacyUser | undefined> {
  const rows = await db()<LegacyUser[]>`
    select email, name, password_hash
    from public.users
    where lower(email) = lower(${email})
    limit 1
  `;
  return rows[0];
}

// Cognito calls this only when a user signs in (or resets a password) and does not exist in the
// user pool yet. Throwing makes Cognito report "user not found / incorrect password".
export const handler: UserMigrationTriggerHandler = async (event) => {
  const email = event.userName;
  const user = await findLegacyUser(email);

  // Only email/password accounts migrate here. Google-only accounts have no password and are
  // linked by verified email the first time they sign in with Google.
  if (!user?.password_hash) throw new Error("User not found");

  if (event.triggerSource === "UserMigration_Authentication") {
    const valid = await bcrypt.compare(event.request.password, user.password_hash);
    if (!valid) throw new Error("Bad password");
    event.response.finalUserStatus = "CONFIRMED";
  } else if (event.triggerSource !== "UserMigration_ForgotPassword") {
    throw new Error("Unsupported trigger");
  }

  event.response.userAttributes = {
    email: user.email.toLowerCase(),
    // The address was already the account's login in the old system.
    email_verified: "true",
    ...(user.name ? { name: user.name } : {}),
  };
  event.response.messageAction = "SUPPRESS";
  return event;
};
