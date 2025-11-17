import { Router, type Request, type Response } from 'express';
import { ltaClient } from '@/clients/lta.js';
import { cacheService } from '@/services/cache.js';
import { logger } from '@/utils/logger.js';

const router = Router();

// Cache TTLs (in seconds)
const TTL = {
  BUS_STOPS: 86400, // 24 hours - bus stop data rarely changes
  BUS_ROUTES: 86400, // 24 hours - route data rarely changes
  BUS_ARRIVAL: 10, // 10 seconds - real-time arrival data
};

/**
 * GET /api/lta/busstops?skip=0
 * Get all LTA bus stops (paginated, 500 per request)
 */
router.get('/busstops', async (req: Request, res: Response): Promise<void> => {
  const skip = parseInt((req.query.skip as string) || '0', 10);
  const cacheKey = `lta:busstops:${skip}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await ltaClient.get('/BusStops', {
      params: { $skip: skip },
    });
    await cacheService.set(cacheKey, data, TTL.BUS_STOPS);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, skip }, 'Error fetching LTA bus stops');
    throw error;
  }
});

/**
 * GET /api/lta/busroutes?serviceNo=95&direction=1
 * Get bus route details for a specific service
 */
router.get('/busroutes', async (req: Request, res: Response): Promise<void> => {
  const serviceNo = req.query.serviceNo as string;
  const direction = req.query.direction as string;

  const cacheKey = direction
    ? `lta:busroutes:${serviceNo}:${direction}`
    : `lta:busroutes:${serviceNo}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const params: Record<string, string> = {};
    if (serviceNo) params.ServiceNo = serviceNo;
    if (direction) params.Direction = direction;

    const data = await ltaClient.get('/BusRoutes', { params });
    await cacheService.set(cacheKey, data, TTL.BUS_ROUTES);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, serviceNo, direction }, 'Error fetching LTA bus routes');
    throw error;
  }
});

/**
 * GET /api/lta/busarrival?busStopCode=83139&serviceNo=95
 * Get real-time bus arrival information
 */
router.get('/busarrival', async (req: Request, res: Response): Promise<void> => {
  const busStopCode = req.query.busStopCode as string;
  const serviceNo = req.query.serviceNo as string;

  if (!busStopCode) {
    res.status(400).json({ error: 'busStopCode query parameter is required' });
  }

  const cacheKey = serviceNo
    ? `lta:busarrival:${busStopCode}:${serviceNo}`
    : `lta:busarrival:${busStopCode}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const params: Record<string, string> = {
      BusStopCode: busStopCode,
    };
    if (serviceNo) params.ServiceNo = serviceNo;

    const data = await ltaClient.get('/BusArrivalv2', { params });
    await cacheService.set(cacheKey, data, TTL.BUS_ARRIVAL);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, busStopCode, serviceNo }, 'Error fetching LTA bus arrival');
    throw error;
  }
});

export default router;
