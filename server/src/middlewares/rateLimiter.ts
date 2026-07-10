import { Request, Response, NextFunction } from "express";

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const limiters = new Map<string, RateLimitBucket>();

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  return (req: any, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    
    // Per-IP key
    const ipKey = `${options.keyPrefix}:ip:${ip}`;
    
    // Per-account key (if email in body, or if authenticated req.user exists)
    let accountKey: string | null = null;
    const email = req.body?.email || req.body?.emailAddress;
    if (email) {
      accountKey = `${options.keyPrefix}:account:${email.toLowerCase()}`;
    } else if (req.user?.id) {
      accountKey = `${options.keyPrefix}:account:${req.user.id}`;
    }
    
    const now = Date.now();
    
    const checkLimit = (key: string): { allowed: boolean; retryAfterSec: number } => {
      let bucket = limiters.get(key);
      if (!bucket) {
        bucket = { tokens: options.max, lastRefill: now };
        limiters.set(key, bucket);
      }
      
      const timePassed = now - bucket.lastRefill;
      const refillAmount = timePassed * (options.max / options.windowMs);
      bucket.tokens = Math.min(options.max, bucket.tokens + refillAmount);
      bucket.lastRefill = now;
      
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true, retryAfterSec: 0 };
      } else {
        const missingTokens = 1 - bucket.tokens;
        const refillRate = options.max / options.windowMs;
        const timeToWaitMs = missingTokens / refillRate;
        return { allowed: false, retryAfterSec: Math.ceil(timeToWaitMs / 1000) };
      }
    };
    
    // Check IP limit
    const ipResult = checkLimit(ipKey);
    if (!ipResult.allowed) {
      res.setHeader("Retry-After", String(ipResult.retryAfterSec));
      return res.status(429).json({
        message: "Too many requests from this IP. Please try again later.",
        retryAfter: ipResult.retryAfterSec
      });
    }
    
    // Check Account limit
    if (accountKey) {
      const accountResult = checkLimit(accountKey);
      if (!accountResult.allowed) {
        res.setHeader("Retry-After", String(accountResult.retryAfterSec));
        return res.status(429).json({
          message: "Too many requests for this account. Please try again later.",
          retryAfter: accountResult.retryAfterSec
        });
      }
    }
    
    next();
  };
}

// Clean old entries from memory periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of limiters.entries()) {
    // If bucket hasn't been accessed in 1 hour, remove it
    if (now - bucket.lastRefill > 60 * 60 * 1000) {
      limiters.delete(key);
    }
  }
}, 30 * 60 * 1000).unref?.();
