// Stores runtime secrets for an Amplify environment as SSM SecureString parameters.
//
// Usage (run from the repository root):
//   node scripts/amplify/put-ssm-parameters.mjs <ssm path> NAME=source [NAME=source ...]
//
// Sources:
//   generate      a new random 48-byte secret (for AUTH_SECRET / JWT_SECRET)
//   env:KEY       the value of KEY in .env.local
//   file:PATH     the trimmed contents of a file (~ is expanded)
//   ssm:NAME      the value of another SSM parameter (copied without printing)
//
// Example:
//   node scripts/amplify/put-ssm-parameters.mjs /ysw/nonprod DATABASE_URL=file:~/.ysw-nonprod-db-url AUTH_SECRET=generate
//
// Uses the AWS CLI with the current AWS_PROFILE / AWS_REGION. Values are never printed or passed
// on the command line: each goes through an owner-only temp file that is deleted immediately.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import dotenv from "dotenv";

const [basePath, ...specs] = process.argv.slice(2);
if (!basePath?.startsWith("/") || specs.length === 0) {
  console.error("Usage: node scripts/amplify/put-ssm-parameters.mjs /path NAME=source [NAME=source ...]");
  process.exit(1);
}

let local = {};
try {
  local = dotenv.parse(readFileSync(".env.local"));
} catch {
  // .env.local is only needed for env: sources.
}

const dir = mkdtempSync(join(tmpdir(), "ssm-put-"));
let failed = false;
try {
  for (const spec of specs) {
    const eq = spec.indexOf("=");
    const name = spec.slice(0, eq);
    const source = spec.slice(eq + 1);
    let value;
    try {
      if (source === "generate") value = randomBytes(48).toString("base64url");
      else if (source.startsWith("env:")) value = local[source.slice(4)];
      else if (source.startsWith("file:")) value = readFileSync(source.slice(5).replace(/^~(?=\/)/, homedir()), "utf8").trim();
      else if (source.startsWith("ssm:"))
        value = execFileSync("aws", ["ssm", "get-parameter", "--name", source.slice(4), "--with-decryption", "--query", "Parameter.Value", "--output", "text"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "inherit"],
        }).replace(/\n$/, "");
      else throw new Error(`unknown source "${source}"`);
    } catch (error) {
      console.error(`${name}: failed (${error.code === "ENOENT" ? "file not found" : error.message})`);
      failed = true;
      continue;
    }
    if (!value) {
      console.log(`${name}: skipped (no value)`);
      continue;
    }
    const file = join(dir, `${name}.json`);
    writeFileSync(file, JSON.stringify({ Name: `${basePath.replace(/\/$/, "")}/${name}`, Type: "SecureString", Value: value, Overwrite: true }), { mode: 0o600 });
    try {
      const version = execFileSync("aws", ["ssm", "put-parameter", "--cli-input-json", `file://${file}`, "--query", "Version", "--output", "text"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      }).trim();
      console.log(`${name}: stored (version ${version})`);
    } catch {
      console.error(`${name}: failed (see AWS CLI error above)`);
      failed = true;
    } finally {
      rmSync(file, { force: true });
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
