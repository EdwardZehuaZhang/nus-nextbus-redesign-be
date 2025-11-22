import { Router, type Request, type Response } from 'express';
import { googleDirectionsClient } from '@/clients/google-directions.js';
import { cacheService } from '@/services/cache.js';
import { logger } from '@/utils/logger.js';
import { createStrictRateLimiter } from '@/middleware/rate-limiter.js';

const router = Router();

// Apply rate limiting to Google Directions API (expensive)
// 30 requests per minute per IP
router.use(createStrictRateLimiter(30, 60000));

// Cache TTL for directions (in seconds)
const DIRECTIONS_CACHE_TTL = 300; // 5 minutes

/**
 * GET /api/google/directions
 * Get directions between two locations
 * Query params:
 *   - origin: Starting location (lat,lng or address) (required)
 *   - destination: Ending location (lat,lng or address) (required)
 *   - mode: Travel mode (driving, walking, bicycling, transit) (optional)
 *   - departure_time: Departure time in seconds since epoch (optional)
 *   - arrival_time: Desired arrival time in seconds since epoch (optional)
 *   - alternatives: Whether to return alternative routes (optional)
 *   - avoid: Features to avoid (tolls, highways, ferries) (optional)
 *   - units: Unit system (metric, imperial) (optional)
 *   - region: Region code (optional)
 *   - language: Language code (optional)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const {
    origin,
    destination,
    mode,
    departure_time,
    arrival_time,
    alternatives,
    avoid,
    units,
    region,
    language,
  } = req.query;

  if (!origin || typeof origin !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'origin query parameter is required',
    });
    return;
  }

  if (!destination || typeof destination !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'destination query parameter is required',
    });
    return;
  }

  // Create cache key based on main parameters
  const cacheKey = `directions:${origin}:${destination}:${mode || 'driving'}:${departure_time || ''}:${arrival_time || ''}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Directions cache hit');
      res.json(cached);
      return;
    }

    const data = await googleDirectionsClient.getDirections({
      origin,
      destination,
      mode: mode as string | undefined,
      departure_time: departure_time as string | undefined,
      arrival_time: arrival_time as string | undefined,
      alternatives: alternatives === 'true',
      avoid: avoid as string | undefined,
      units: units as string | undefined,
      region: region as string | undefined,
      language: language as string | undefined,
    });

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.error({ status: data.status, error_message: data.error_message }, 'Directions API error');
      res.status(400).json({
        error: 'Directions API error',
        message: data.error_message || `API returned status: ${data.status}`,
      });
      return;
    }

    await cacheService.set(cacheKey, data, DIRECTIONS_CACHE_TTL);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, origin, destination }, 'Error fetching directions');
    res.status(500).json({ error: 'Failed to fetch directions' });
  }
});

export default router;
