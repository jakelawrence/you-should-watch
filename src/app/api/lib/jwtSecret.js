// Returns the secret used to sign and verify the app's own JWT cookies (auth_token, admin_token).
// Fails closed: there is no default, because a known fallback would let anyone forge tokens.
// Read at call time rather than import time so `next build` does not need the secret.
const PLACEHOLDERS = new Set(["your-secret-key", "replace-me", "changeme"]);

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || PLACEHOLDERS.has(secret)) {
    const message = "JWT_SECRET is not set (or is a placeholder); refusing to sign or verify tokens.";
    console.error(message);
    throw new Error(message);
  }
  return secret;
}
