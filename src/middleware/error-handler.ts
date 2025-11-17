import type { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error(
    {
      err,
      method: req.method,
      url: req.url,
      ip: req.ip,
    },
    'Unhandled error'
  );

  // Axios errors
  if ('isAxiosError' in err && err.isAxiosError) {
    const axiosError = err as {
      response?: { status: number; data: unknown };
      code?: string;
    };

    if (axiosError.response) {
      // Upstream API returned an error
      const status = axiosError.response.status;
      const isClientError = status >= 400 && status < 500;

      res.status(isClientError ? status : 502).json({
        error: 'Upstream API error',
        message: isClientError ? 'Invalid request to upstream service' : 'Upstream service unavailable',
        statusCode: status,
      });
      return;
    } else if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      res.status(504).json({
        error: 'Gateway timeout',
        message: 'Upstream service took too long to respond',
      });
      return;
    } else {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'Could not reach upstream service',
      });
      return;
    }
  }

  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.url} not found`,
  });
}
