// Writes allowlisted server-side runtime variables to .env.production during an Amplify build.
//
// Amplify Hosting does not expose console environment variables to the Next.js SSR runtime,
// so they must be written to .env.production before `next build`. Values are read from:
//   1. Amplify branch environment variables (process.env)
//   2. Amplify secrets stored in SSM Parameter Store (/amplify/<appId>/<branch>/<NAME>),
//      which Amplify exposes to the build as a JSON string in process.env.secrets.
// Secret values take precedence. Values are never printed.
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

const read = (name) => secrets[name] ?? process.env[name];

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
