# NUS NextBus Gateway API

Production-ready backend gateway for the NUS NextBus mobile app redesign. This service proxies requests to upstream APIs (NUS NextBus, LTA DataMall, Google Routes) with security hardening, caching, rate limiting, and observability.

## Features

- **Security Hardening**: Server-side credential management, no API keys shipped to mobile clients
- **Intelligent Caching**: Redis-backed caching with configurable TTLs per endpoint (static vs live data)
- **Rate Limiting**: Per-IP throttling with Redis store to prevent abuse and quota exhaustion
- **Observability**: Structured logging with Pino, health checks, graceful shutdown
- **Production Ready**: Helmet security headers, CORS, compression, error handling

## Architecture

```
Mobile App → Gateway (this service) → Upstream APIs
                ↓
              Redis (cache + rate limiting)
```

### Upstream Integrations

1. **NUS NextBus API** - Internal shuttle bus real-time data (Basic Auth attached server-side)
2. **LTA DataMall API** - Singapore public bus data (API key attached server-side)
3. **Google Routes API** - Walking/transit directions (API key attached server-side)

### Cache Strategy

| Endpoint Type | TTL | Reasoning |
|--------------|-----|-----------|
| Static data (stops, checkpoints, route descriptions) | 24 hours | Rarely changes |
| Semi-static (pickup points, operating hours) | 1 hour | Infrequent updates |
| Live data (shuttle arrivals, active buses) | 2-5 seconds | Real-time |

### Rate Limits

- **Global**: 120 requests/minute per IP
- **Google Routes**: 30 requests/minute per IP (expensive API)
- Falls back to in-memory if Redis unavailable (not recommended for production)

## Quick Start

### Prerequisites

- Node.js 20+ 
- Redis (optional but strongly recommended for production)
- Valid API credentials for NUS NextBus, LTA DataMall, Google Maps

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Configuration

Set these required environment variables in `.env`:

```bash
# NUS NextBus API credentials
NUS_NEXTBUS_USERNAME=your-username
NUS_NEXTBUS_PASSWORD=your-password

# LTA DataMall API key
LTA_API_KEY=your-lta-api-key

# Google Maps API key (server-side only)
GOOGLE_MAPS_API_KEY=your-google-api-key

# Redis (recommended)
REDIS_URL=redis://localhost:6379
```

See `.env.example` for all available options.

### Development

```bash
# Run in development mode (with auto-reload)
npm run dev

# Run type checking
npm run type-check

# Build for production
npm run build

# Start production build
npm start
```

The server starts on `http://localhost:3000` by default.

## API Endpoints

### Health Check

```
GET /health
```

Returns server health status, uptime, and environment.

### NUS NextBus Proxies

All endpoints under `/api/bus/*` proxy to `https://nnextbus.nus.edu.sg`:

- `GET /api/bus/busstops` - All campus bus stops
- `GET /api/bus/pickuppoint?route_code=A1` - Stops for a route
- `GET /api/bus/shuttleservice?busstopname=YIH` - Real-time arrivals at a stop
- `GET /api/bus/activebus?route_code=A1` - Active buses on a route
- `GET /api/bus/buslocation?veh_plate=ABC1234` - Specific bus location
- `GET /api/bus/checkpoint?route_code=A1` - Route waypoints
- `GET /api/bus/announcements` - System announcements
- `GET /api/bus/tickertapes` - Ticker tape messages

### LTA DataMall Proxies

All endpoints under `/api/lta/*` proxy to LTA DataMall:

- `GET /api/lta/busstops?skip=0` - Public bus stops (paginated)
- `GET /api/lta/busroutes?serviceNo=95` - Public bus routes
- `GET /api/lta/busarrival?busStopCode=83139` - Real-time public bus arrivals

### Google Routes Proxy

- `POST /api/routes/compute` - Compute walking/transit routes (strict rate limiting)

Request body matches [Google Routes API ComputeRoutes](https://developers.google.com/maps/documentation/routes/compute_route_directions).

## Deployment

### Docker

```bash
# Build image
docker build -t nus-nextbus-gateway .

# Run container
docker run -p 3000:3000 --env-file .env nus-nextbus-gateway
```

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

1. Click "Deploy on Railway"
2. Set environment variables from `.env.example`
3. Add Redis plugin
4. Deploy

### Render

1. Create new Web Service
2. Connect repository
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables
6. Add Redis instance and link via `REDIS_URL`

### Vercel (Serverless)

Not recommended for this use case due to stateful Redis connections. Use Railway, Render, or traditional VPS instead.

## Monitoring

### Logs

Structured JSON logs via Pino. Set `LOG_PRETTY=true` in development for human-readable output.

```bash
# View logs
npm run dev

# Production JSON logs
NODE_ENV=production npm start
```

### Metrics

Monitor these in production:

- Response times (p50, p95, p99)
- Error rates by endpoint
- Cache hit ratios
- Rate limit violations
- Upstream API error rates

Recommended: Integrate with DataDog, New Relic, or Prometheus.

## Security Considerations

1. **Credential Rotation**: Rotate API keys and passwords regularly
2. **Redis Security**: Use TLS and password authentication for Redis in production
3. **CORS**: Configure `ALLOWED_ORIGINS` to restrict access to your mobile app domains
4. **Rate Limiting**: Tune limits based on your user base and upstream quotas
5. **API Key Restrictions**: 
   - Google Maps: Restrict by server IP and API scopes
   - LTA: Monitor usage; request higher quotas if needed

## Development

### Project Structure

```
src/
├── clients/          # Upstream API clients (NUS, LTA, Google)
├── config/           # Environment configuration
├── middleware/       # Express middleware (rate limiting, errors)
├── routes/           # API route handlers
├── services/         # Business logic (caching)
├── utils/            # Utilities (logger)
└── index.ts          # Server entry point
```

### Adding New Endpoints

1. Add route handler in `src/routes/`
2. Configure caching TTL based on data freshness
3. Add rate limiting if needed
4. Update this README

## Troubleshooting

### Redis Connection Issues

If Redis is unavailable, the service falls back to in-memory caching. Check logs:

```
Redis connection error
```

Verify `REDIS_URL` and network connectivity.

### Upstream API Errors

Check logs for upstream error details:

```json
{
  "level": "error",
  "msg": "NUS NextBus API error response",
  "status": 401
}
```

Verify credentials in `.env`.

### Rate Limit Too Strict

Increase limits in `.env`:

```bash
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_WINDOW_MS=60000
```

Or disable rate limiting (not recommended):

```bash
RATE_LIMIT_ENABLED=false
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Run `npm run type-check`
5. Submit a pull request

## License

MIT

## Support

For issues or questions, please open a GitHub issue.
