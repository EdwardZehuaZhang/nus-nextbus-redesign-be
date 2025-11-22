# Deployment Guide

## Overview

This guide covers deploying the NUS NextBus Gateway to various platforms with production-grade Redis caching and monitoring.

## Platform Comparisons

| Platform | Pros | Cons | Best For |
|----------|------|------|----------|
| **Railway** | Easy setup, Redis plugin, auto-scaling | Paid only | Quick production deployment |
| **Render** | Free tier, Redis included, simple config | Slower cold starts | Free hosting + testing |
| **Docker/VPS** | Full control, cheapest at scale | Manual setup, maintenance | Large-scale production |
| **Fly.io** | Global edge, low latency | More complex setup | Global user base |

## Railway (Recommended)

### Setup

1. Install Railway CLI:
```bash
npm i -g @railway/cli
railway login
```

2. Initialize project:
```bash
cd nus-nextbus-redesign-be
railway init
```

3. Add Redis:
```bash
railway add -d redis
```

4. Set environment variables:
```bash
railway variables set NUS_NEXTBUS_USERNAME=your-username
railway variables set NUS_NEXTBUS_PASSWORD=your-password
railway variables set LTA_API_KEY=your-lta-key
railway variables set GOOGLE_MAPS_API_KEY=your-google-key
railway variables set ALLOWED_ORIGINS=https://yourapp.com
```

5. Deploy:
```bash
railway up
```

### Post-Deployment

- **Domain**: Get URL from Railway dashboard or add custom domain
- **Monitoring**: Enable Railway metrics and logs
- **Scaling**: Adjust resources in dashboard (RAM, replicas)

## Render

### Setup

1. Create new Web Service on [Render](https://render.com)

2. Connect your repository

3. Configure build settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: `Node`

4. Add environment variables (from `.env.example`)

5. Add Redis:
   - Create new Redis instance
   - Copy internal connection string
   - Set as `REDIS_URL` in web service

6. Deploy

### Post-Deployment

- **Health Checks**: Render auto-configures via `/health`
- **Custom Domain**: Add in dashboard settings
- **Monitoring**: View logs and metrics in Render dashboard

## Docker + VPS (DigitalOcean, Linode, etc.)

### Prerequisites

- VPS with Docker installed
- Domain pointed to VPS IP

### Setup

1. Clone repository on VPS:
```bash
git clone https://github.com/your-username/nus-nextbus-redesign-be.git
cd nus-nextbus-redesign-be
```

2. Create `.env` file:
```bash
cp .env.example .env
nano .env
# Fill in all credentials
```

3. Build and run with Docker Compose:
```bash
docker-compose up -d
```

4. Set up Nginx reverse proxy:

```nginx
# /etc/nginx/sites-available/nextbus-gateway
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

5. Enable site and get SSL:
```bash
sudo ln -s /etc/nginx/sites-available/nextbus-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.com
```

### Post-Deployment

- **Logs**: `docker-compose logs -f gateway`
- **Restart**: `docker-compose restart gateway`
- **Updates**: `git pull && docker-compose up -d --build`

## Environment Variables Reference

### Required

```bash
NUS_NEXTBUS_USERNAME=      # From NUS NextBus API
NUS_NEXTBUS_PASSWORD=      # From NUS NextBus API
LTA_API_KEY=               # From https://datamall.lta.gov.sg
GOOGLE_MAPS_API_KEY=       # From Google Cloud Console
```

### Optional (with defaults)

```bash
PORT=3000                  # Server port
NODE_ENV=production        # Environment
ALLOWED_ORIGINS=*          # CORS origins (comma-separated)
REDIS_URL=                 # Redis connection string
RATE_LIMIT_ENABLED=true    # Enable rate limiting
RATE_LIMIT_MAX_REQUESTS=120 # Max requests per window
RATE_LIMIT_WINDOW_MS=60000  # Rate limit window (ms)
CACHE_ENABLED=true         # Enable caching
CACHE_DEFAULT_TTL=300      # Default cache TTL (seconds)
LOG_LEVEL=info             # Log level
LOG_PRETTY=false           # Pretty print logs (dev only)
```

## Production Checklist

### Before Launch

- [ ] All API credentials set and validated
- [ ] Redis configured and connected
- [ ] CORS `ALLOWED_ORIGINS` restricted to your app domains
- [ ] Health check endpoint returns 200
- [ ] Rate limiting tested and tuned
- [ ] Logs structured and readable
- [ ] Domain/SSL configured
- [ ] Monitoring/alerting set up

### API Key Security

1. **Google Maps API Key**:
   - Restrict by server IP in Google Cloud Console
   - Limit to Routes API only
   - Set daily quota caps
   - Enable billing alerts

2. **LTA DataMall Key**:
   - Monitor usage via LTA dashboard
   - Request quota increase if needed
   - Rotate key quarterly

3. **NUS NextBus Credentials**:
   - Store in secrets manager (Railway/Render secrets, AWS Secrets Manager)
   - Never commit to git
   - Rotate if compromised

### Monitoring

Set up alerts for:

- **Error Rate** > 5%
- **Response Time** p95 > 2s
- **Cache Miss Rate** > 50%
- **Rate Limit Violations** > 10/min
- **Upstream API Errors** (401, 429, 5xx)
- **Memory/CPU** > 80%

### Scaling

- **Vertical**: Increase RAM/CPU in platform dashboard
- **Horizontal**: Add replicas (Railway/Render auto-scaling)
- **Caching**: Increase Redis memory, tune TTLs
- **Rate Limits**: Adjust per-IP limits based on user count

## Troubleshooting

### Gateway Returns 502

Check upstream API credentials:
```bash
railway logs
# Look for "401 Unauthorized" or "NUS NextBus API error"
```

Verify env vars are set:
```bash
railway variables
```

### Redis Connection Errors

Verify `REDIS_URL` is correct:
```bash
railway variables get REDIS_URL
```

Check Redis health:
```bash
railway run redis-cli ping
# Should return: PONG
```

### High Response Times

Check cache hit ratio in logs. If low:
- Increase Redis memory
- Verify Redis is reachable
- Check TTL configuration

### Rate Limit Too Aggressive

Increase limits or disable temporarily:
```bash
railway variables set RATE_LIMIT_MAX_REQUESTS=200
railway variables set RATE_LIMIT_ENABLED=false  # Not recommended
```

## Rollback

### Railway
```bash
railway rollback
```

### Render
- Go to dashboard → Deploys → Rollback to previous version

### Docker
```bash
git checkout previous-commit
docker-compose up -d --build
```

## Support

For deployment issues, check:
- Platform status pages (Railway/Render)
- Gateway logs: `railway logs` or Render dashboard
- Redis connectivity: `REDIS_URL` env var
- API credential validity: Test with curl/Postman

---

**Next Steps After Deployment:**

1. Update mobile app `API_URL` to your gateway URL
2. Remove hardcoded upstream credentials from mobile app
3. Test all endpoints via Postman/curl
4. Monitor logs for errors
5. Set up uptime monitoring (UptimeRobot, Pingdom)
