// Writes allowlisted server-side runtime variables to .env.production during an Amplify build.
//
// Amplify Hosting does not expose console environment variables to the Next.js SSR runtime,
// so they must be written to .env.production before `next build`. Values are read from,
// highest precedence first:
//   1. SSM Parameter Store SecureStrings under SSM_PARAMETER_PATH (e.g. /ysw/nonprod), read with
//      the Amplify service role. The parameter name's last segment is the variable name.
//   2. Amplify Gen 1 secrets, which Amplify exposes as a JSON string in process.env.secrets.
//   3. Amplify branch environment variables (process.env).
// Values are never printed.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const REQUIRED = ["DATABASE_URL", "AUTH_SECRET", "JWT_SECRET"];

const OPTIONAL = [
  "NEON_DATABASE_URL",
  "AUTH_URL",
  "AUTH_TRUST_HOST",
  "POSTGRES_MAX_CONNECTIONS",
  "POSTGRES_IDLE_TIMEOUT_SECONDS",
  "POSTGRES_MAX_LIFETIME_SECONDS",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_ID",
  "GITHUB_CLIENT_SECRET",
  "APPLE_ID",
  "APPLE_SECRET",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
  "RECOMMENDER_ENGINE",
  "SEMANTIC_SEARCH_EMBEDDING_COLUMN",
  "SEMANTIC_SEARCH_MAX_QUERY_LENGTH",
  "EMBEDDING_RECOMMENDER_CANDIDATE_LIMIT",
  "QUERY_EMBEDDING_PROVIDER",
  "QUERY_EMBEDDING_MODEL",
  "QUERY_EMBEDDING_DIMENSIONS",
  "QUERY_EMBEDDING_CACHE_LIMIT",
  "OPENAI_API_KEY",
];

let secrets = {};
if (process.env.secrets) {
  try {
    secrets = JSON.parse(process.env.secrets);
  } catch {
    console.error("write-runtime-env: could not parse Amplify secrets JSON; ignoring it.");
  }
}

let ssm = {};
const ssmPath = process.env.SSM_PARAMETER_PATH;
if (ssmPath) {
  const region = process.env.SSM_PARAMETER_REGION || process.env.AWS_REGION || "us-east-1";
  let output;
  try {
    // The AWS CLI handles pagination. stderr is inherited for diagnostics; it never contains values.
    output = execFileSync(
      "aws",
      ["ssm", "get-parameters-by-path", "--path", ssmPath, "--recursive", "--with-decryption", "--region", region, "--query", "Parameters[].[Name,Value]", "--output", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 10 * 1024 * 1024 }
    );
  } catch {
    console.error(`write-runtime-env: could not read SSM parameters under ${ssmPath}`);
    process.exit(1);
  }
  for (const [name, value] of JSON.parse(output)) ssm[name.split("/").pop()] = value;
  console.log(`write-runtime-env: loaded ${Object.keys(ssm).length} parameters from ${ssmPath}`);
}

const read = (name) => ssm[name] ?? secrets[name] ?? process.env[name];

// dotenv does not unescape quotes, so wrap each value in a quote character it does not contain.
// Only double-quoted values expand \n, so multi-line values (such as private keys) use double quotes.
// Next.js also expands $VAR references in env files, so escape every "$" as "\\$".
const quote = (name, value) => {
  const text = String(value).replace(/\$/g, "\\$");
  if (text.includes("\n")) {
    if (text.includes('"')) throw new Error(`write-runtime-env: ${name} contains both a newline and a double quote`);
    return `"${text.replace(/\r?\n/g, "\\n")}"`;
  }
  const mark = ["'", '"', "`"].find((q) => !text.includes(q));
  if (!mark) throw new Error(`write-runtime-env: ${name} contains every quote character`);
  return `${mark}${text}${mark}`;
};

const missing = REQUIRED.filter((name) => !read(name) && !(name === "DATABASE_URL" && read("NEON_DATABASE_URL")));
if (missing.length) {
  console.error(`write-runtime-env: missing required variables: ${missing.join(", ")}`);
  process.exit(1);
}

const lines = [];
const written = [];
for (const name of [...REQUIRED, ...OPTIONAL]) {
  const value = read(name);
  if (value === undefined || value === "") continue;
  lines.push(`${name}=${quote(name, value)}`);
  written.push(name);
}

// NextAuth v5 must trust the forwarded host behind Amplify's CloudFront distribution.
if (!read("AUTH_TRUST_HOST") && !read("AUTH_URL")) {
  lines.push(`AUTH_TRUST_HOST="true"`);
  written.push("AUTH_TRUST_HOST");
}

writeFileSync(".env.production", `${lines.join("\n")}\n`, { mode: 0o600 });
console.log(`write-runtime-env: wrote ${written.length} variables: ${written.join(", ")}`);
