import { Router, type Request, type Response } from 'express';
import { googlePlacesClient } from '@/clients/google-places.js';
import { cacheService } from '@/services/cache.js';
import { logger } from '@/utils/logger.js';
import { createStrictRateLimiter } from '@/middleware/rate-limiter.js';

const router = Router();

// Apply rate limiting to Google Places API (expensive)
// 60 requests per minute per IP
router.use(createStrictRateLimiter(60, 60000));

// Cache TTL for places (in seconds)
const CACHE_TTL = {
  AUTOCOMPLETE: 300, // 5 minutes - search results
  DETAILS: 3600, // 1 hour - place details are more static
};

/**
 * GET /api/google/places/autocomplete
 * Get place autocomplete suggestions
 * Query params:
 *   - input: Search query (required)
 *   - sessiontoken: Session token for billing optimization (optional)
 *   - location: Lat,lng to bias results (optional)
 *   - radius: Radius in meters (optional)
 */
router.get('/autocomplete', async (req: Request, res: Response): Promise<void> => {
  const { input, sessiontoken, location, radius } = req.query;

  if (!input || typeof input !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'input query parameter is required',
    });
    return;
  }

  const cacheKey = `places:autocomplete:${input}:${location || ''}:${radius || ''}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Places autocomplete cache hit');
      res.json(cached);
      return;
    }

    const data = await googlePlacesClient.autocomplete({
      input,
      sessiontoken: sessiontoken as string | undefined,
      location: location as string | undefined,
      radius: radius ? parseInt(radius as string, 10) : undefined,
    });

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.error({ status: data.status, error_message: data.error_message }, 'Places autocomplete error');
      res.status(400).json({
        error: 'Places API error',
        message: data.error_message || `API returned status: ${data.status}`,
      });
      return;
    }

    await cacheService.set(cacheKey, data, CACHE_TTL.AUTOCOMPLETE);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, input }, 'Error fetching place autocomplete');
    res.status(500).json({ error: 'Failed to fetch place autocomplete' });
  }
});

/**
 * GET /api/google/places/details
 * Get detailed information about a place
 * Query params:
 *   - place_id: Google Place ID (required)
 *   - fields: Comma-separated fields to return (optional)
 */
router.get('/details', async (req: Request, res: Response): Promise<void> => {
  const { place_id, fields } = req.query;

  if (!place_id || typeof place_id !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'place_id query parameter is required',
    });
    return;
  }

  const cacheKey = `places:details:${place_id}:${fields || 'default'}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Places details cache hit');
      res.json(cached);
      return;
    }

    const data = await googlePlacesClient.details({
      place_id,
      fields: fields as string | undefined,
    });

    if (data.status !== 'OK') {
      logger.error({ status: data.status, error_message: data.error_message }, 'Places details error');
      res.status(400).json({
        error: 'Places API error',
        message: data.error_message || `API returned status: ${data.status}`,
      });
      return;
    }

    await cacheService.set(cacheKey, data, CACHE_TTL.DETAILS);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, place_id }, 'Error fetching place details');
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

/**
 * GET /api/google/places/findplace
 * Find a place from a text query
 * Query params:
 *   - input: Text query (required)
 *   - inputtype: Type of input (textquery or phonenumber) (optional, defaults to textquery)
 *   - fields: Comma-separated fields to return (optional)
 *   - locationbias: Location bias (optional, e.g., "point:lat,lng")
 */
router.get('/findplace', async (req: Request, res: Response): Promise<void> => {
  const { input, inputtype, fields, locationbias } = req.query;

  if (!input || typeof input !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'input query parameter is required',
    });
    return;
  }

  const cacheKey = `places:findplace:${input}:${inputtype || 'textquery'}:${fields || 'default'}:${locationbias || ''}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Places findplace cache hit');
      res.json(cached);
      return;
    }

    const data = await googlePlacesClient.findPlaceFromQuery({
      input,
      inputtype: (inputtype as 'textquery' | 'phonenumber') || 'textquery',
      fields: fields as string | undefined,
      locationbias: locationbias as string | undefined,
    });

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.error({ status: data.status }, 'Places findplace error');
      res.status(400).json({
        error: 'Places API error',
        message: `API returned status: ${data.status}`,
      });
      return;
    }

    await cacheService.set(cacheKey, data, CACHE_TTL.DETAILS);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, input }, 'Error finding place from query');
    res.status(500).json({ error: 'Failed to find place' });
  }
});

export default router;
