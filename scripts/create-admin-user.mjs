import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";
import bcrypt from "bcryptjs";
import readline from "readline";
import { getDatabaseUrl } from "./lib/postgres-url.mjs";

const sql = postgres(getDatabaseUrl({ direct: true }), { ssl: "require", prepare: false });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createAdminUser() {
  console.log("\n🔐 Create Admin User\n");
  console.log("=".repeat(50));

  const username = await question("Enter admin username: ");
  const email = await question("Enter admin email: ");
  const password = await question("Enter admin password: ");
  const confirmPassword = await question("Confirm password: ");

  if (password !== confirmPassword) {
    console.error("\n❌ Passwords do not match!");
    rl.close();
    return;
  }

  if (password.length < 8) {
    console.error("\n❌ Password must be at least 8 characters!");
    rl.close();
    return;
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const now = new Date().toISOString();
    await sql`
      insert into public.users (
        username,
        email,
        name,
        password_hash,
        is_admin,
        streaming_services,
        created_at,
        updated_at
      )
      values (
        ${username},
        ${email.toLowerCase().trim()},
        ${username},
        ${passwordHash},
        true,
        ${[]},
        ${now},
        ${now}
      )
    `;

    console.log("\n✅ Admin user created successfully!");
    console.log("\nUser Details:");
    console.log(`  Email: ${email}`);
    console.log(`  Username: ${username}`);
    console.log(`  Admin: Yes`);
    console.log("\n⚠️  Keep your credentials safe!");
  } catch (error) {
    if (error.code === "23505") {
      console.error("\n❌ User with this username already exists!");
    } else {
      console.error("\n❌ Error creating admin user:", error.message);
    }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
    rl.close();
  }
}

createAdminUser();
