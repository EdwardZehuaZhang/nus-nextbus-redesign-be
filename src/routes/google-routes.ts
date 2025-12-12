import { Router, type Request, type Response } from 'express';
import { googleRoutesClient } from '@/clients/google-routes.js';
import { cacheService } from '@/services/cache.js';
import { logger } from '@/utils/logger.js';
import { createStrictRateLimiter } from '@/middleware/rate-limiter.js';

const router = Router();

// Apply strict rate limiting to Google Routes API (expensive)
// 800 requests per minute per IP - handles internal route finder making 17+ compute calls per page load
// Each route search triggers many requests (transit, walking fallbacks, internal route variants with duplicates)
router.use(createStrictRateLimiter(800, 60000));

// Cache TTL for routes (in seconds)
const ROUTE_CACHE_TTL = 300; // 5 minutes

/**
 * POST /api/routes/compute
 * Compute routes using Google Maps Routes API
 * Body should match Google Routes API ComputeRoutes request format
 * Supports intermediateWaypoints for multi-stop routing
 */
router.post('/compute', async (req: Request, res: Response): Promise<void> => {
  const requestBody = req.body;

  if (!requestBody || !requestBody.origin || !requestBody.destination) {
    res.status(400).json({
      error: 'Invalid request body',
      message: 'origin and destination are required',
    });
    return;
  }

  // Normalize intermediate waypoints to Google's expected "intermediates" field
  // Supports FE sending either `intermediateWaypoints` or `intermediates`, and lat/lng or latitude/longitude
  const normalizeLatLng = (wp: any) => {
    if (!wp) return null;
    const src = wp.location?.latLng || wp.latLng || wp.location;
    const lat = src?.lat ?? src?.latitude;
    const lng = src?.lng ?? src?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return {
      location: { latLng: { latitude: lat, longitude: lng } },
      placeId: wp.placeId,
    };
  };

  const rawIntermediates = Array.isArray(requestBody.intermediates)
    ? requestBody.intermediates
    : Array.isArray(requestBody.intermediateWaypoints)
      ? requestBody.intermediateWaypoints
      : [];

  const intermediates = rawIntermediates
    .map(normalizeLatLng)
    .filter(Boolean);

  // Build a normalized request body for Google
  const cleanRequestBody = {
    ...requestBody,
    intermediates,
  };
  // Remove legacy field if present to avoid confusion
  delete (cleanRequestBody as any).intermediateWaypoints;

  // Create a cache key based on normalized request body
  const cacheKey = `routes:${JSON.stringify({
    origin: cleanRequestBody.origin,
    destination: cleanRequestBody.destination,
    intermediates: cleanRequestBody.intermediates,
    travelMode: cleanRequestBody.travelMode || 'DRIVE',
  })}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Routes cache hit');
      res.json(cached);
      return;
    }

    // Extract fieldMask from body or use default
    const fieldMask = requestBody.fieldMask || [
      // Route-level
      'routes.duration',
      'routes.distanceMeters',
      'routes.polyline.encodedPolyline',
      'routes.localizedValues',
      'routes.description',
      'routes.travelAdvisory.transitFare',
      // Leg-level (include duration/distance for frontend calculations)
      'routes.legs.duration',
      'routes.legs.distanceMeters',
      'routes.legs.polyline.encodedPolyline',
      'routes.legs.startLocation',
      'routes.legs.endLocation',
      'routes.legs.steps.distanceMeters',
      'routes.legs.steps.staticDuration',
      'routes.legs.steps.polyline',
      'routes.legs.steps.startLocation',
      'routes.legs.steps.endLocation',
      'routes.legs.steps.navigationInstruction',
      'routes.legs.steps.travelMode',
      'routes.legs.steps.transitDetails',
      'routes.legs.stepsOverview',
    ].join(',');

    // Remove fieldMask from request body if present (it goes in header, not body)
    const { fieldMask: _, ...bodyWithoutFieldMask } = cleanRequestBody as any;

    const data = await googleRoutesClient.post(
      '/directions/v2:computeRoutes',
      bodyWithoutFieldMask,
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
    res.status(500).json({ error: 'Failed to compute routes' });
  }
});

export default router;
