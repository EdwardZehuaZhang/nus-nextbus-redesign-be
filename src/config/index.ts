import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim()),
  },
  nusNextBus: {
    apiUrl: process.env.NUS_NEXTBUS_API_URL || 'https://nnextbus.nus.edu.sg',
    username: process.env.NUS_NEXTBUS_USERNAME || '',
    password: process.env.NUS_NEXTBUS_PASSWORD || '',
    // SHA-256 fingerprints of expired leaf certs we still accept (NUS let its cert lapse on 23 Oct 2026).
    // Only used when the cert's sole problem is expiry; a valid cert is always accepted as normal.
    // Set to an empty string to turn the workaround off.
    pinnedExpiredCerts: (
      process.env.NUS_NEXTBUS_PINNED_EXPIRED_CERTS ??
      '28:EE:7C:20:C5:59:CE:BB:D0:E0:B9:89:0C:FA:BF:9B:23:0E:1E:65:AC:E6:C7:3E:AC:FC:80:91:09:5F:39:5D'
    )
      .split(',')
      .map(f => f.trim().toUpperCase())
      .filter(Boolean),
  },
  lta: {
    apiUrl: process.env.LTA_API_URL || 'https://datamall2.mytransport.sg/ltaodataservice',
    apiKey: process.env.LTA_API_KEY || '',
  },
  google: {
    routesApiUrl: process.env.GOOGLE_ROUTES_API_URL || 'https://routes.googleapis.com/directions/v2:computeRoutes',
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true',
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '2000', 10), // Very high limit - internal route finder makes 137+ requests per page load with duplicates
  },
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY === 'true',
  },
} as const;

// Validate critical config
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.nusNextBus.username) {
    errors.push('NUS_NEXTBUS_USERNAME is required');
  }
  if (!config.nusNextBus.password) {
    errors.push('NUS_NEXTBUS_PASSWORD is required');
  }
  if (!config.lta.apiKey) {
    errors.push('LTA_API_KEY is required');
  }
  if (!config.google.apiKey) {
    errors.push('GOOGLE_MAPS_API_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
