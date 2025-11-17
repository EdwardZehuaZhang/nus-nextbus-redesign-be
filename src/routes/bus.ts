import { Router, type Request, type Response } from 'express';
import { nusNextBusClient } from '@/clients/nus-nextbus.js';
import { cacheService } from '@/services/cache.js';
import { logger } from '@/utils/logger.js';

const router = Router();

// Cache TTLs (in seconds)
const TTL = {
  STATIC: 86400, // 24 hours - for stops, checkpoints, route descriptions
  SEMI_STATIC: 3600, // 1 hour - for pickup points, route min/max times
  LIVE: 5, // 5 seconds - for shuttle services, active buses
  VERY_LIVE: 2, // 2 seconds - for bus locations
};

/**
 * GET /api/bus/publicity
 * Get publicity information including banners and display frequency
 */
router.get('/publicity', async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'bus:publicity';

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;      return;
    }

    const data = await nusNextBusClient.get('/publicity');
    await cacheService.set(cacheKey, data, TTL.SEMI_STATIC);

    res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching publicity');
    throw error;
  }
});

/**
 * GET /api/bus/busstops
 * Get information about all bus stops on campus
 */
router.get('/busstops', async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'bus:busstops';

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await nusNextBusClient.get('/BusStops');
    await cacheService.set(cacheKey, data, TTL.STATIC);

    res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching bus stops');
    throw error;
  }
});

/**
 * GET /api/bus/pickuppoint?route_code=A1
 * Get all pickup points (stops) for a specified route
 */
router.get('/pickuppoint', async (req: Request, res: Response): Promise<void> => {
  const routeCode = req.query.route_code as string;

  if (!routeCode) {
    res.status(400).json({ error: 'route_code query parameter is required' });
  }

  const cacheKey = `bus:pickuppoint:${routeCode}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await nusNextBusClient.get('/PickupPoint', {
      params: { route_code: routeCode },
    });
    await cacheService.set(cacheKey, data, TTL.STATIC);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, routeCode }, 'Error fetching pickup points');
    throw error;
  }
});

/**
 * GET /api/bus/shuttleservice?busstopname=YIH
 * Get all oncoming shuttle bus services at a specified stop
 */
router.get('/shuttleservice', async (req: Request, res: Response): Promise<void> => {
  const busStopName = req.query.busstopname as string;

  if (!busStopName) {
    res.status(400).json({ error: 'busstopname query parameter is required' });
  }

  const cacheKey = `bus:shuttleservice:${busStopName}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await nusNextBusClient.get('/ShuttleService', {
      params: { busstopname: busStopName },
    });
    await cacheService.set(cacheKey, data, TTL.LIVE);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, busStopName }, 'Error fetching shuttle service');
    throw error;
  }
});

/**
 * GET /api/bus/activebus?route_code=A1
 * Get all active buses on a specified route with their current positions
 */
router.get('/activebus', async (req: Request, res: Response): Promise<void> => {
  const routeCode = req.query.route_code as string;

  if (!routeCode) {
    res.status(400).json({ error: 'route_code query parameter is required' });
  }

  const cacheKey = `bus:activebus:${routeCode}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await nusNextBusClient.get('/ActiveBus', {
      params: { route_code: routeCode },
    });
    await cacheService.set(cacheKey, data, TTL.LIVE);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, routeCode }, 'Error fetching active buses');
    throw error;
  }
});

/**
 * GET /api/bus/buslocation?veh_plate=ABC1234
 * Get location information about a specific bus by vehicle plate
 */
router.get('/buslocation', async (req: Request, res: Response): Promise<void> => {
  const vehPlate = req.query.veh_plate as string;

  if (!vehPlate) {
    res.status(400).json({ error: 'veh_plate query parameter is required' });
  }

  const cacheKey = `bus:buslocation:${vehPlate}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await nusNextBusClient.get('/BusLocation', {
      params: { veh_plate: vehPlate },
    });
    await cacheService.set(cacheKey, data, TTL.VERY_LIVE);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, vehPlate }, 'Error fetching bus location');
    throw error;
  }
});

/**
 * GET /api/bus/routeminmaxtime?route_code=A1
 * Get the minimum and maximum operating time of a route
 */
router.get('/routeminmaxtime', async (req: Request, res: Response): Promise<void> => {
  const routeCode = req.query.route_code as string;

  if (!routeCode) {
    res.status(400).json({ error: 'route_code query parameter is required' });
  }

  const cacheKey = `bus:routeminmaxtime:${routeCode}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await nusNextBusClient.get('/RouteMinMaxTime', {
      params: { route_code: routeCode },
    });
    await cacheService.set(cacheKey, data, TTL.SEMI_STATIC);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, routeCode }, 'Error fetching route min/max time');
    throw error;
  }
});

/**
 * GET /api/bus/servicedescription
 * Get brief path descriptions for all routes
 */
router.get('/servicedescription', async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'bus:servicedescription';

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await nusNextBusClient.get('/ServiceDescription');
    await cacheService.set(cacheKey, data, TTL.STATIC);

    res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching service description');
    throw error;
  }
});

/**
 * GET /api/bus/announcements
 * Get all system announcements
 */
router.get('/announcements', async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'bus:announcements';

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await nusNextBusClient.get('/Announcements');
    await cacheService.set(cacheKey, data, TTL.SEMI_STATIC);

    res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching announcements');
    throw error;
  }
});

/**
 * GET /api/bus/tickertapes
 * Get all ticker tape messages
 */
router.get('/tickertapes', async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'bus:tickertapes';

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await nusNextBusClient.get('/TickerTapes');
    await cacheService.set(cacheKey, data, TTL.SEMI_STATIC);

    res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching ticker tapes');
    throw error;
  }
});

/**
 * GET /api/bus/checkpoint?route_code=A1
 * Get all checkpoints (waypoints) of a specified route
 */
router.get('/checkpoint', async (req: Request, res: Response): Promise<void> => {
  const routeCode = req.query.route_code as string;

  if (!routeCode) {
    res.status(400).json({ error: 'route_code query parameter is required' });
  }

  const cacheKey = `bus:checkpoint:${routeCode}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
    return;    }

    const data = await nusNextBusClient.get('/CheckPoint', {
      params: { route_code: routeCode },
    });
    await cacheService.set(cacheKey, data, TTL.STATIC);

    res.json(data);
  } catch (error) {
    logger.error({ err: error, routeCode }, 'Error fetching checkpoints');
    throw error;
  }
});

export default router;
