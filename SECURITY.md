# Security Best Practices

## Overview

This document outlines security measures implemented in the NUS NextBus Gateway and recommendations for production deployment.

## Implemented Security Measures

### 1. Credential Isolation

**Problem**: Mobile apps bundle credentials → easily extracted → quota abuse

**Solution**: Server-side credential management
- NUS NextBus Basic Auth attached in `src/clients/nus-nextbus.ts`
- LTA API key attached in `src/clients/lta.ts`
- Google Maps API key attached in `src/clients/google-routes.ts`
- Mobile app only knows gateway URL, never upstream credentials

### 2. Rate Limiting

**Problem**: Single shared API key + many users = quota exhaustion

**Solution**: Multi-tier rate limiting
- **Global**: 120 req/min per IP (configurable)
- **Endpoint-specific**: 30 req/min for expensive Google Routes API
- **Store**: Redis-backed for distributed rate limiting across replicas
- **Fallback**: In-memory store if Redis unavailable

Implementation: `src/middleware/rate-limiter.ts`

### 3. Caching Strategy

**Problem**: Every app request hits upstream APIs → quotas, latency, costs

**Solution**: Intelligent caching by data type
- **Static data** (bus stops, routes): 24 hours
- **Semi-static** (schedules, announcements): 1 hour
- **Live data** (arrivals, bus locations): 2-5 seconds

This reduces upstream API calls by ~90% while maintaining data freshness.

Implementation: `src/services/cache.ts`

### 4. Security Headers

Helmet.js applied for:
- `X-Frame-Options`: Prevent clickjacking
- `X-Content-Type-Options`: Prevent MIME sniffing
- `X-DNS-Prefetch-Control`: Reduce info leakage
- `Strict-Transport-Security`: Enforce HTTPS

### 5. CORS Protection

Configurable origin whitelist via `ALLOWED_ORIGINS`:
```bash
ALLOWED_ORIGINS=https://yourapp.com,exp://192.168.1.100:8081
```

Set to `*` for development only. In production, restrict to:
- Your mobile app's deep link scheme
- Web dashboard domain (if any)

### 6. Input Validation

All query parameters validated before proxying:
- Required params checked (returns 400 if missing)
- No SQL injection risk (using axios params)
- Request body size limited to 1MB

### 7. Error Handling

Generic error messages to clients, detailed logs server-side:
- Don't leak upstream API error details to clients
- Log full error context for debugging
- Map upstream errors to appropriate HTTP status codes

Implementation: `src/middleware/error-handler.ts`

## Recommended Production Hardening

### 1. API Key Restrictions

**Google Maps API Key**:
```
1. Go to Google Cloud Console → Credentials
2. Edit your API key
3. Application restrictions:
   - Server: Restrict by IP (your gateway server IP)
4. API restrictions:
   - Routes API only
5. Set quota limits:
   - Daily: 10,000 requests (adjust based on usage)
   - Per user: 100 requests/day
6. Enable billing alerts at 50%, 80%, 100%
```

**LTA DataMall Key**:
```
1. Monitor usage at https://datamall.lta.gov.sg
2. Request quota increase if needed (default: 5,000 req/day)
3. Rotate key quarterly
4. Set up email alerts for quota approaching
```

**NUS NextBus Credentials**:
- Store in platform secrets (Railway Variables, Render Env Vars)
- Never commit to git, even in private repos
- Rotate if exposed or quarterly
- Use different credentials per environment (dev/staging/prod)

### 2. Redis Security

Production Redis should have:
```bash
# Enable password auth
REDIS_PASSWORD=strong-random-password

# Enable TLS
REDIS_TLS=true
REDIS_URL=rediss://user:password@host:6380

# Railway/Render handle this automatically
```

For self-hosted Redis:
```bash
# redis.conf
requirepass your-strong-password
bind 127.0.0.1  # Only local access
protected-mode yes
```

### 3. Rate Limit Tuning

Adjust based on your user base:

**Small app (<1000 users)**:
```bash
RATE_LIMIT_MAX_REQUESTS=120  # per minute
```

**Medium app (1k-10k users)**:
```bash
RATE_LIMIT_MAX_REQUESTS=200
# Add per-route limits for expensive endpoints
```

**Large app (>10k users)**:
```bash
RATE_LIMIT_MAX_REQUESTS=300
# Scale horizontally (multiple gateway instances)
# Add CDN layer (Cloudflare) for static data
```

### 4. Monitoring & Alerting

Set up alerts for security events:

**Rate Limit Violations**:
```
Alert if > 10 violations/min from same IP
Action: Review logs, potentially block IP at firewall level
```

**Upstream API Errors**:
```
Alert if 401/403 errors (credential issues)
Alert if 429 errors (quota exceeded)
Action: Rotate keys, increase quotas, investigate abuse
```

**Suspicious Patterns**:
```
Alert if single IP makes >1000 req/min (DDoS attempt)
Alert if error rate >10% (potential attack)
Action: Enable Cloudflare DDoS protection, tighten rate limits
```

### 5. DDoS Protection

For production, add Cloudflare (free tier):

```
1. Add domain to Cloudflare
2. Enable "Under Attack Mode" if needed
3. Configure:
   - Rate limiting (Cloudflare layer)
   - Bot fight mode
   - Challenge passage
4. Point DNS to gateway
```

This adds edge-level protection before requests hit your gateway.

### 6. Secret Rotation

Automate key rotation:

```bash
# Quarterly rotation schedule
NUS_NEXTBUS: Every 3 months
LTA_API_KEY: Every 3 months
GOOGLE_MAPS_API_KEY: Every 6 months

# Emergency rotation (if leaked)
1. Generate new key
2. Update env vars in platform
3. Invalidate old key
4. Deploy (zero downtime if using Railway/Render)
```

### 7. Audit Logging

Log security events to external service:

```typescript
// Example: Log rate limit violations to DataDog
if (rateLimitExceeded) {
  datadogLogger.warn({
    event: 'rate_limit_exceeded',
    ip: req.ip,
    path: req.path,
    timestamp: new Date().toISOString()
  });
}
```

Recommended logging services:
- DataDog
- Loggly
- Papertrail
- CloudWatch (AWS)

## Vulnerability Disclosure

### If You Find a Security Issue

**DO NOT** open a public GitHub issue.

Instead:
1. Email: security@yourdomain.com
2. Include:
   - Vulnerability description
   - Steps to reproduce
   - Impact assessment
   - Suggested fix (optional)
3. Allow 90 days for fix before public disclosure

### Regular Security Audits

Schedule:
- **Monthly**: Dependency updates (`npm audit`, `npm update`)
- **Quarterly**: API key rotation
- **Annually**: Penetration testing (if high-value app)

## Compliance

### Data Privacy

This gateway does not:
- Store user PII
- Track user locations (beyond IP for rate limiting)
- Log sensitive request bodies

Cached data:
- No personal information
- Only public transit schedules/locations
- Stored in Redis with TTL (auto-expires)

### GDPR/Privacy

If serving EU users:
- Add privacy policy link to mobile app
- Disclose data shared with Google (Routes API)
- Provide data deletion mechanism (clear Redis cache)

## Emergency Procedures

### API Key Compromised

1. **Immediate**:
   ```bash
   # Disable old key in provider dashboard
   # Generate new key
   # Update env var
   railway variables set GOOGLE_MAPS_API_KEY=new-key
   ```

2. **Within 1 hour**:
   - Review logs for unusual activity
   - Check quotas for spike in usage
   - Notify users if service was disrupted

3. **Post-mortem**:
   - Document how key was leaked
   - Implement additional safeguards
   - Update security training

### DDoS Attack

1. **Immediate**:
   ```bash
   # Enable Cloudflare "Under Attack Mode"
   # Tighten rate limits
   railway variables set RATE_LIMIT_MAX_REQUESTS=50
   ```

2. **Within 30 minutes**:
   - Review logs for attack pattern
   - Block offending IPs at firewall level
   - Scale up if legitimate traffic

3. **Recovery**:
   - Gradually restore normal rate limits
   - Add permanent firewall rules
   - Consider upgrading infrastructure

### Upstream API Outage

Gateway handles gracefully:
- Returns 503 to mobile app
- Logs error but doesn't crash
- Serves stale cache if available

No action needed unless prolonged (>1 hour):
- Post status update to users
- Contact upstream provider
- Consider failover to backup API (if available)

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
- [Redis Security Guide](https://redis.io/docs/management/security/)

---

**Questions or concerns?** Open a GitHub issue (non-security) or email security@yourdomain.com (security issues).
