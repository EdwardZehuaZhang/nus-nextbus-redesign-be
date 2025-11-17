import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { config, validateConfig } from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { createRateLimiter } from '@/middleware/rate-limiter.js';
import { errorHandler, notFoundHandler } from '@/middleware/error-handler.js';
import { cacheService } from '@/services/cache.js';
import busRoutes from '@/routes/bus.js';
import ltaRoutes from '@/routes/lta.js';
import googleRoutesRoutes from '@/routes/google-routes.js';

// Validate configuration on startup
try {
  validateConfig();
  logger.info('Configuration validated successfully');
} catch (error) {
  logger.fatal({ err: error }, 'Configuration validation failed');
  process.exit(1);
}

const app: Express = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (config.server.allowedOrigins.includes('*') || config.server.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} completed with ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} failed with ${res.statusCode}: ${err.message}`;
    },
  })
);

// Global rate limiting
app.use(createRateLimiter());

// Health check endpoint (no auth, no rate limiting)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.nodeEnv,
  });
});

// API routes
app.use('/api/bus', busRoutes);
app.use('/api/lta', ltaRoutes);
app.use('/api/routes', googleRoutesRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close cache connection
      await cacheService.close();
      logger.info('Cache service closed');

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(
    {
      port: config.server.port,
      env: config.server.nodeEnv,
      cacheEnabled: config.cache.enabled,
      rateLimitEnabled: config.rateLimit.enabled,
    },
    'NUS NextBus Gateway started'
  );
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error: Error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

export default app;
