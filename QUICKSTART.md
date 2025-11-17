# Quick Start Guide

## Prerequisites

- Node.js 20+ installed
- Redis installed locally OR access to cloud Redis (Railway/Render auto-provision)
- API credentials (see below)

## Local Development Setup

### 1. Install Dependencies

```bash
cd nus-nextbus-redesign-be
npm install
```

### 2. Get API Credentials

#### NUS NextBus API
- **Username**: `NUSnextbus`
- **Password**: Contact NUS or extract from existing app (currently: `13dL?zY,3feWR^"T`)
- **Base URL**: `https://nnextbus.nus.edu.sg`

#### LTA DataMall API
1. Register at https://datamall.lta.gov.sg/content/datamall/en.html
2. Request API access
3. Copy your Account Key from dashboard

#### Google Maps Routes API
1. Go to https://console.cloud.google.com
2. Create new project or select existing
3. Enable "Routes API"
4. Create API key
5. Restrict key:
   - **Application restrictions**: IP addresses (add your server IP)
   - **API restrictions**: Routes API only

### 3. Configure Environment

```bash
cp .env.example .env
nano .env  # or use your favorite editor
```

Fill in all required credentials:

```bash
# Required
NUS_NEXTBUS_USERNAME=NUSnextbus
NUS_NEXTBUS_PASSWORD=your-password-here
LTA_API_KEY=your-lta-key
GOOGLE_MAPS_API_KEY=your-google-key

# Optional (defaults shown)
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=*
REDIS_URL=redis://localhost:6379
LOG_PRETTY=true  # Pretty logs for development
```

### 4. Start Redis (if running locally)

#### macOS (Homebrew):
```bash
brew install redis
brew services start redis
```

#### Ubuntu/Debian:
```bash
sudo apt install redis-server
sudo systemctl start redis
```

#### Docker:
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

Verify Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

### 5. Run Development Server

```bash
npm run dev
```

Server starts at http://localhost:3000

### 6. Test Endpoints

#### Health Check:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-17T12:00:00.000Z",
  "uptime": 42.5,
  "environment": "development"
}
```

#### Bus Stops:
```bash
curl http://localhost:3000/api/bus/busstops
```

#### Shuttle Service (arrivals at YIH):
```bash
curl "http://localhost:3000/api/bus/shuttleservice?busstopname=YIH"
```

#### Google Routes (walking):
```bash
curl -X POST http://localhost:3000/api/routes/compute \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {
      "location": {
        "latLng": {"latitude": 1.2966, "longitude": 103.7764}
      }
    },
    "destination": {
      "location": {
        "latLng": {"latitude": 1.3048, "longitude": 103.7744}
      }
    },
    "travelMode": "WALK"
  }'
```

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Railway deployment (1-click)
- Render deployment
- Docker + VPS setup
- Environment variable management
- Monitoring setup

## Troubleshooting

### Redis Connection Failed

**Error**: `Redis connection error: ECONNREFUSED`

**Solutions**:
1. Verify Redis is running: `redis-cli ping`
2. Check `REDIS_URL` in `.env`
3. Fallback: Remove `REDIS_URL` to use in-memory cache (dev only)

### Upstream API 401 Errors

**Error**: `NUS NextBus API error response: 401`

**Solutions**:
1. Verify `NUS_NEXTBUS_USERNAME` and `NUS_NEXTBUS_PASSWORD`
2. Check if credentials changed
3. Test manually:
   ```bash
   curl -u "username:password" https://nnextbus.nus.edu.sg/BusStops
   ```

### Google Maps Quota Exceeded

**Error**: `Google Routes API error response: 429`

**Solutions**:
1. Check quota in Google Cloud Console
2. Increase daily limit or enable billing
3. Reduce cache TTL to cache more aggressively
4. Add per-user rate limiting

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solutions**:
1. Change port in `.env`: `PORT=3001`
2. Kill existing process:
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

## Development Workflow

### Making Changes

1. Edit code in `src/`
2. TypeScript auto-reloads (tsx watch)
3. Check logs for errors
4. Test endpoint with curl/Postman

### Adding New Endpoints

1. Add route handler in `src/routes/`
2. Configure cache TTL
3. Add to README API docs
4. Test locally
5. Commit

### Before Committing

```bash
npm run type-check  # Verify TypeScript
npm run lint        # Check code style (if configured)
```

## VS Code Setup (Optional)

Recommended extensions:
- ESLint
- Prettier
- Thunder Client (API testing)

### `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Next Steps

1. **Deploy**: Follow [DEPLOYMENT.md](./DEPLOYMENT.md) to deploy to Railway/Render
2. **Update Mobile App**: Point `API_URL` to your deployed gateway
3. **Monitor**: Set up logging and alerts (see [SECURITY.md](./SECURITY.md))
4. **Scale**: Add more replicas or tune cache/rate limits as needed

## Support

- **Issues**: https://github.com/your-username/nus-nextbus-redesign-be/issues
- **Security**: security@yourdomain.com
- **Docs**: See README.md, DEPLOYMENT.md, SECURITY.md
