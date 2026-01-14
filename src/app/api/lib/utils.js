// lib/utils.js
export function getClientIp(req) {
  // Try various headers (depends on your hosting/proxy setup)
  const forwarded = req.headers.get("x-forwarded-for");
  const real = req.headers.get("x-real-ip");
  const cfConnecting = req.headers.get("cf-connecting-ip"); // Cloudflare

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (real) {
    return real;
  }

  if (cfConnecting) {
    return cfConnecting;
  }

  // Fallback
  return req.ip || "unknown";
}
