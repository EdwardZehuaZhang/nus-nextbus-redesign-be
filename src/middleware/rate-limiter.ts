import { rateLimit } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { config } from '@/config/index.js';
import { cacheService } from '@/services/cache.js';
import { logger } from '@/utils/logger.js';

export function createRateLimiter() {
  if (!config.rateLimit.enabled) {
    logger.warn('Rate limiting is disabled');
    return (_req: unknown, _res: unknown, next: () => void) => next();
  }

  const redisClient = cacheService.getRedisClient();

  const limiterConfig = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    },
    handler: (req: unknown, res: unknown) => {
      logger.warn({ ip: (req as { ip?: string }).ip }, 'Rate limit exceeded');
      (res as { status: (code: number) => { json: (data: unknown) => void } })
        .status(429)
        .json({
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
        });
    },
    ...(redisClient && {
      store: new RedisStore({
        sendCommand: async (...args: Parameters<typeof redisClient.call>) => {
          const result = await redisClient.call(...args);
          return result as never;
        },
      }),
    }),
  };

  return rateLimit(limiterConfig);
}

// Stricter rate limiting for expensive endpoints
export function createStrictRateLimiter(maxRequests = 30, windowMs = 60000) {
  if (!config.rateLimit.enabled) {
    return (_req: unknown, _res: unknown, next: () => void) => next();
  }

  const redisClient = cacheService.getRedisClient();

  const limiterConfig = {
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: `Rate limit exceeded for this endpoint. Max ${maxRequests} requests per ${Math.ceil(windowMs / 1000)} seconds.`,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    handler: (req: unknown, res: unknown) => {
      logger.warn(
        { ip: (req as { ip?: string }).ip, path: (req as { path?: string }).path, max: maxRequests },
        'Strict rate limit exceeded'
      );
      (res as { status: (code: number) => { json: (data: unknown) => void } })
        .status(429)
        .json({
          error: `Rate limit exceeded for this endpoint. Max ${maxRequests} requests per ${Math.ceil(windowMs / 1000)} seconds.`,
          retryAfter: Math.ceil(windowMs / 1000),
        });
    },
    ...(redisClient && {
      store: new RedisStore({
        sendCommand: async (...args: Parameters<typeof redisClient.call>) => {
          const result = await redisClient.call(...args);
          return result as never;
        },
      }),
    }),
  };

  return rateLimit(limiterConfig);
}
