import { NextResponse } from "next/server";

// In-memory store (for simple implementation)
// For production, use Redis or DynamoDB
const rateLimitStore = new Map();

// Configuration
const RATE_LIMITS = {
  anonymous: {
    suggestions: 8, // 3 suggestion requests
    timeWindow: 86400000, // per 24 hours (milliseconds)
  },
  authenticated: {
    suggestions: 50, // 50 suggestion requests
    timeWindow: 86400000, // per 24 hours
  },
};

export function getRateLimitKey(ip, userId = null) {
  return userId ? `user:${userId}` : `ip:${ip}`;
}

export function checkRateLimit(key, isAuthenticated = false) {
  const now = Date.now();
  const limit = isAuthenticated ? RATE_LIMITS.authenticated : RATE_LIMITS.anonymous;

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + limit.timeWindow,
    });
    return {
      allowed: true,
      remaining: limit.suggestions - 1,
      resetAt: now + limit.timeWindow,
    };
  }

  const record = rateLimitStore.get(key);

  // Reset if time window has passed
  if (now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + limit.timeWindow,
    });
    return {
      allowed: true,
      remaining: limit.suggestions - 1,
      resetAt: now + limit.timeWindow,
    };
  }

  // Check if limit exceeded
  if (record.count >= limit.suggestions) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      retryAfter: Math.ceil((record.resetAt - now) / 1000), // seconds
    };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: limit.suggestions - record.count,
    resetAt: record.resetAt,
  };
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 3600000); // Clean up every hour
