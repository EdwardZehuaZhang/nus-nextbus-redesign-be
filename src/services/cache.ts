import Redis from 'ioredis';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

class CacheService {
  private redis: Redis | null = null;
  private memoryCache: Map<string, { value: string; expiresAt: number }> = new Map();

  constructor() {
    if (config.redis.url) {
      try {
        this.redis = new Redis(config.redis.url, {
          password: config.redis.password || undefined,
          tls: config.redis.tls ? {} : undefined,
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          reconnectOnError: (err: Error) => {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
              return true;
            }
            return false;
          },
        });

        this.redis.on('connect', () => {
          logger.info('Redis connected');
        });

        this.redis.on('error', (err: Error) => {
          logger.error({ err }, 'Redis connection error');
        });

        this.redis.on('close', () => {
          logger.warn('Redis connection closed');
        });
      } catch (error) {
        logger.error({ err: error }, 'Failed to initialize Redis, falling back to memory cache');
        this.redis = null;
      }
    } else {
      logger.warn('No Redis URL provided, using in-memory cache (not recommended for production)');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!config.cache.enabled) {
      return null;
    }

    try {
      if (this.redis) {
        const value = await this.redis.get(key);
        if (value) {
          logger.debug({ key }, 'Cache hit (Redis)');
          return JSON.parse(value) as T;
        }
      } else {
        // Memory cache
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          logger.debug({ key }, 'Cache hit (memory)');
          return JSON.parse(cached.value) as T;
        } else if (cached) {
          // Expired
          this.memoryCache.delete(key);
        }
      }

      logger.debug({ key }, 'Cache miss');
      return null;
    } catch (error) {
      logger.error({ err: error, key }, 'Cache get error');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!config.cache.enabled) {
      return;
    }

    const ttl = ttlSeconds ?? config.cache.defaultTTL;

    try {
      const serialized = JSON.stringify(value);

      if (this.redis) {
        await this.redis.set(key, serialized, 'EX', ttl);
        logger.debug({ key, ttl }, 'Cache set (Redis)');
      } else {
        // Memory cache
        this.memoryCache.set(key, {
          value: serialized,
          expiresAt: Date.now() + ttl * 1000,
        });
        logger.debug({ key, ttl }, 'Cache set (memory)');
      }
    } catch (error) {
      logger.error({ err: error, key }, 'Cache set error');
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(key);
      } else {
        this.memoryCache.delete(key);
      }
      logger.debug({ key }, 'Cache key deleted');
    } catch (error) {
      logger.error({ err: error, key }, 'Cache delete error');
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      if (this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          logger.debug({ pattern, count: keys.length }, 'Cache keys deleted by pattern');
        }
      } else {
        // Memory cache - simple prefix match
        const keysToDelete: string[] = [];
        const prefix = pattern.replace('*', '');
        for (const key of this.memoryCache.keys()) {
          if (key.startsWith(prefix)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach((k) => this.memoryCache.delete(k));
        logger.debug({ pattern, count: keysToDelete.length }, 'Cache keys deleted by pattern (memory)');
      }
    } catch (error) {
      logger.error({ err: error, pattern }, 'Cache delete pattern error');
    }
  }

  getRedisClient(): Redis | null {
    return this.redis;
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      logger.info('Redis connection closed');
    }
    this.memoryCache.clear();
  }
}

export const cacheService = new CacheService();
