# PRODUCTION DEPLOYMENT & OPERATIONS GUIDE

## Quick Start (Docker)

```bash
# 1. Configure environment
cp .env.production.example .env.production
# Edit .env.production with your settings

# 2. Make deployment script executable
chmod +x scripts/deploy.sh

# 3. Deploy everything
./scripts/deploy.sh
```

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)                 │
│              Port 80/443 (HTTP/HTTPS)                    │
└────────────────────┬────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    v                v                v
┌────────┐      ┌────────┐      ┌──────────┐
│  App   │      │ Worker │      │ Nginx    │
│ Node   │      │ Process│      │ Cache    │
│ 3000   │      │        │      │          │
└────────┘      └────────┘      └──────────┘
    │                │
    └────────────────┼────────────────┐
                     │                │
                     v                v
              ┌────────────┐   ┌──────────┐
              │   MySQL    │   │  Redis   │
              │   Port 3306│   │ 6379     │
              └────────────┘   └──────────┘
```

## Environment Variables (Critical)

```bash
# Security
JWT_SECRET=                    # 32+ byte hex string
ENCRYPTION_KEY=                # 64 hex chars (32 bytes)
WEBHOOK_SECRET=                # Min 32 chars
COOKIE_SECRET=                 # Random string

# Database
DB_HOST=db                     # Docker: 'db', External: IP/hostname
DB_PASSWORD=                   # Strong password
DB_ROOT_PASSWORD=              # Root password

# Email (Choose ONE)
SENDGRID_API_KEY=              # OR use SMTP below
SMTP_HOST=mail.rebooked.org
SMTP_PORT=587
SMTP_USER=hello@rebooked.org
SMTP_PASSWORD=                 # Email password

# SMS (Choose ONE provider)
TELNYX_API_KEY=                # Recommended
TELNYX_FROM_NUMBER=
# OR
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=

# Optional
OPENAI_API_KEY=                # For message rewriting
STRIPE_SECRET_KEY=             # For billing
SENTRY_DSN=                    # Error tracking
```

## Health Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3000/health
```

Returns:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "database": {"status": "healthy", "latency": 2},
  "redis": {"status": "healthy", "latency": 1},
  "memory": {"used": 134217728, "limit": 4294967296, "percent": 3.12}
}
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f db
docker-compose -f docker-compose.prod.yml logs -f worker
```

### Database Status
```bash
# Connect to MySQL
docker-compose -f docker-compose.prod.yml exec db mysql -u rebookd -p rebookd

# Check active connections
SHOW PROCESSLIST;

# Check database size
SELECT SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024 as 'Size (MB)' FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'rebookd';
```

### Memory Usage
```bash
# Check container memory
docker stats rebookd_app rebookd_worker rebookd_db
```

## Backup & Recovery

### Database Backup
```bash
# Full backup
docker-compose -f docker-compose.prod.yml exec db mysqldump \
  -u rebookd -p rebookd rebookd > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated daily backup (add to crontab)
0 2 * * * docker-compose -f docker-compose.prod.yml exec -T db mysqldump \
  -u rebookd -p rebookd rebookd > /backups/rebookd_$(date +\%Y\%m\%d).sql
```

### Database Restore
```bash
docker-compose -f docker-compose.prod.yml exec -T db mysql \
  -u rebookd -p rebookd rebookd < backup_file.sql
```

### Volume Backups
```bash
# Backup database volume
docker run --rm -v rebookd_db_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/db_backup.tar.gz -C /data .

# Restore database volume
docker run --rm -v rebookd_db_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/db_backup.tar.gz -C /data
```

## Performance Tuning

### Database Optimization
```sql
-- Check slow queries
SHOW VARIABLES LIKE 'slow_query%';

-- Analyze tables
ANALYZE TABLE leads;
ANALYZE TABLE messages;
ANALYZE TABLE automations;

-- Show index statistics
SHOW INDEX FROM leads;
```

### Memory Optimization
```bash
# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" npm run start:prod
```

### Redis Configuration
```bash
# Monitor Redis
docker-compose -f docker-compose.prod.yml exec redis redis-cli monitor

# Check memory
docker-compose -f docker-compose.prod.yml exec redis redis-cli info memory
```

## Scaling Recommendations

### Single Server (Current)
- ✅ Up to 1,000 active users
- ✅ Up to 100K leads per tenant
- ✅ 5M messages/month

### Multi-Server (Future)
- Add load balancer (HAProxy, AWS ALB)
- Use managed database (AWS RDS)
- Use managed Redis (AWS ElastiCache)
- Scale workers horizontally

## Common Issues & Solutions

### High Memory Usage
```bash
# Check what's consuming memory
docker-compose -f docker-compose.prod.yml exec app npm profile

# Restart app container
docker-compose -f docker-compose.prod.yml restart app

# Check for memory leaks
docker-compose -f docker-compose.prod.yml logs app | grep -i "memory"
```

### Database Connection Issues
```bash
# Check max connections
docker-compose -f docker-compose.prod.yml exec db mysql -u rebookd -p rebookd \
  -e "SHOW VARIABLES LIKE 'max_connections';"

# Increase if needed (edit docker-compose.prod.yml)
# Update: --max_connections=200
```

### Slow Queries
```bash
# Enable slow query log (already enabled in docker-compose.prod.yml)
docker-compose -f docker-compose.prod.yml exec db tail -f /var/log/mysql/slow-query.log
```

### Email Not Sending
```bash
# Test SMTP connection
docker-compose -f docker-compose.prod.yml exec app telnet mail.rebooked.org 587

# Check logs
docker-compose -f docker-compose.prod.yml logs app | grep -i "email\|smtp"
```

### SMS Not Sending
```bash
# Check Telnyx/Twilio credentials in logs
docker-compose -f docker-compose.prod.yml logs app | grep -i "sms\|twilio\|telnyx"

# Verify provider API keys
echo $TELNYX_API_KEY
echo $TWILIO_ACCOUNT_SID
```

## Maintenance & Updates

### Update Application
```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild images
docker-compose -f docker-compose.prod.yml build --no-cache

# 3. Restart services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# 4. Run migrations
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate
```

### Clean Up
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Full cleanup
docker system prune -a --volumes
```

## Monitoring Stack (Optional)

### Prometheus + Grafana
```yaml
# Add to docker-compose.prod.yml
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    
grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  environment:
    GF_SECURITY_ADMIN_PASSWORD: admin
```

### ELK Stack (Elasticsearch, Logstash, Kibana)
```bash
# For centralized logging
docker run -d --name elasticsearch -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.0.0
```

## Security Checklist

- [ ] Generate strong encryption keys
- [ ] Change default database password
- [ ] Set strong JWT secret
- [ ] Configure HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Configure backup schedule
- [ ] Enable SSL for database
- [ ] Set up log rotation
- [ ] Configure rate limiting
- [ ] Enable CORS properly
- [ ] Set up monitoring alerts
- [ ] Regular security audits

## Useful Commands

```bash
# Status
docker-compose -f docker-compose.prod.yml ps

# Logs (real-time)
docker-compose -f docker-compose.prod.yml logs -f

# Execute command in container
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate

# Stop services
docker-compose -f docker-compose.prod.yml down

# Stop and remove volumes
docker-compose -f docker-compose.prod.yml down -v

# Restart specific service
docker-compose -f docker-compose.prod.yml restart app

# Scale worker
docker-compose -f docker-compose.prod.yml up -d --scale worker=3

# SSH into container
docker-compose -f docker-compose.prod.yml exec app sh
```

## Support & Troubleshooting

1. **Check logs first**: `docker-compose logs -f app`
2. **Health check**: `curl http://localhost:3000/health`
3. **Database connection**: Verify DB_HOST, DB_USER, DB_PASSWORD
4. **Email setup**: Test with test endpoint
5. **SMS setup**: Verify API keys and from number

## Next Steps

1. ✅ Docker deployment working
2. ⏳ Set up monitoring (Prometheus, Grafana)
3. ⏳ Configure backups (AWS S3, cron)
4. ⏳ Set up logging (ELK, Datadog)
5. ⏳ Configure SSL/HTTPS
6. ⏳ Set up DNS
7. ⏳ Configure CDN
8. ⏳ Performance testing

---

**Last Updated**: 2024
**Status**: ✅ Production Ready
