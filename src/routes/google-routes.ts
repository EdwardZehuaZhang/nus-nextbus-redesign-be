import { Router, type Request, type Response } from 'express';
import { googleRoutesClient } from '@/clients/google-routes.js';
import { cacheService } from '@/services/cache.js';
import { logger } from '@/utils/logger.js';
import { createStrictRateLimiter } from '@/middleware/rate-limiter.js';

const router = Router();

// Apply strict rate limiting to Google Routes API (expensive)
// 30 requests per minute per IP
router.use(createStrictRateLimiter(30, 60000));

// Cache TTL for routes (in seconds)
const ROUTE_CACHE_TTL = 300; // 5 minutes

/**
 * POST /api/routes/compute
 * Compute routes using Google Maps Routes API
 * Body should match Google Routes API ComputeRoutes request format
 */
router.post('/compute', async (req: Request, res: Response): Promise<void> => {
  const requestBody = req.body;

  if (!requestBody || !requestBody.origin || !requestBody.destination) {
    res.status(400).json({
      error: 'Invalid request body',
      message: 'origin and destination are required',
    });
  }

  // Create a cache key based on request body (normalized)
  const cacheKey = `routes:${JSON.stringify({
    origin: requestBody.origin,
    destination: requestBody.destination,
    travelMode: requestBody.travelMode || 'DRIVE',
  })}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Routes cache hit');
      res.json(cached);
    return;    }

    // Field mask to specify which fields to return
    const fieldMask = requestBody.fieldMask || [
      'routes.duration',
      'routes.distanceMeters',
      'routes.polyline.encodedPolyline',
      'routes.legs.steps.distanceMeters',
      'routes.legs.steps.staticDuration',
      'routes.legs.steps.polyline',
      'routes.legs.steps.startLocation',
      'routes.legs.steps.endLocation',
      'routes.legs.steps.navigationInstruction',
      'routes.legs.steps.travelMode',
      'routes.legs.steps.transitDetails',
      'routes.legs.stepsOverview',
      'routes.travelAdvisory.transitFare',
      'routes.localizedValues',
      'routes.description',
    ].join(',');

    const data = await googleRoutesClient.post(
      '/directions/v2:computeRoutes',
      requestBody,
      {
        headers: {
          'X-Goog-FieldMask': fieldMask,
        },
      }
    );

    await cacheService.set(cacheKey, data, ROUTE_CACHE_TTL);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, body: requestBody }, 'Error computing routes');
    throw error;
  }
});

export default router;
