# 🐳 Docker Setup Guide

## Development Environment

### Prerequisites
- Docker Desktop or Docker Engine
- Docker Compose V2

### Services
- **PostgreSQL 16 + PostGIS 3.4** - Database (Port: 5434)
- **Redis 7** - Job queue and caching (Port: 6379)

### Quick Start

1. **Start all services**
   ```bash
   docker compose up -d
   ```

2. **Check service status**
   ```bash
   docker compose ps
   ```

3. **View logs**
   ```bash
   # All services
   docker compose logs -f

   # Specific service
   docker compose logs -f postgres
   docker compose logs -f redis
   ```

4. **Stop services**
   ```bash
   docker compose down
   ```

5. **Stop and remove volumes (WARNING: deletes all data)**
   ```bash
   docker compose down -v
   ```

### Database Connection

**Connection String:**
```
postgresql://zenon:zenon_dev_password@localhost:5434/zenon_croptrial
```

**Individual Parameters:**
- Host: `localhost`
- Port: `5434`
- Database: `zenon_croptrial`
- User: `zenon`
- Password: `zenon_dev_password`

### Connecting with psql

```bash
docker compose exec postgres psql -U zenon -d zenon_croptrial
```

### Database Management

**Run SQL file:**
```bash
docker compose exec -T postgres psql -U zenon -d zenon_croptrial < your-file.sql
```

**Create backup:**
```bash
docker compose exec postgres pg_dump -U zenon zenon_croptrial > backup-$(date +%Y%m%d).sql
```

**Restore backup:**
```bash
docker compose exec -T postgres psql -U zenon -d zenon_croptrial < backup.sql
```

---

## Production Deployment (EC2)

### Prerequisites
- EC2 instance (Ubuntu 22.04 LTS recommended)
- Docker and Docker Compose installed
- Domain name (optional, for SSL)

### 1. Prepare Environment

**On EC2:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Setup Project

```bash
# Clone repository
git clone https://github.com/Natsvora/zenon-croptrial.git
cd zenon-croptrial

# Create production environment file
cp .env.production.example .env.production

# Edit with your secure values
nano .env.production
```

**Required values in `.env.production`:**
```env
POSTGRES_PASSWORD=<strong-random-password>
REDIS_PASSWORD=<strong-random-password>
JWT_SECRET=<min-32-character-random-string>
```

### 3. Build and Deploy

```bash
# Build frontend
cd apps/web
pnpm install
pnpm build
cd ../..

# Start production services
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 4. Setup SSL (Optional)

**Install Certbot:**
```bash
sudo apt install certbot
```

**Obtain SSL certificate:**
```bash
sudo certbot certonly --standalone -d your-domain.com
```

**Copy certificates:**
```bash
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/
```

**Enable HTTPS in nginx config:**
Edit `docker/nginx/conf.d/default.conf` and uncomment the HTTPS server block.

**Restart nginx:**
```bash
docker compose -f docker-compose.prod.yml restart nginx
```

### 5. Database Migrations

```bash
# Run Prisma migrations
docker compose -f docker-compose.prod.yml exec api pnpm --filter @zenon/database prisma migrate deploy
```

### 6. Backup Strategy

**Automated daily backups (cron):**
```bash
# Create backup script
cat > /home/ubuntu/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker compose -f /home/ubuntu/zenon-croptrial/docker-compose.prod.yml \
  exec -T postgres pg_dump -U zenon zenon_croptrial | \
  gzip > $BACKUP_DIR/zenon_backup_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "zenon_backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /home/ubuntu/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/ubuntu/backup-db.sh
```

### 7. Monitoring

**View resource usage:**
```bash
docker stats
```

**Health checks:**
```bash
# API health
curl http://localhost:3000/health

# PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U zenon

# Redis
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
```

### 8. Updating

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Run migrations
docker compose -f docker-compose.prod.yml exec api pnpm --filter @zenon/database prisma migrate deploy
```

---

## Troubleshooting

### Port Already in Use
If you get "port already allocated" error:
```bash
# Check what's using the port
lsof -i :5434  # or your port number

# Stop conflicting service or change port in docker-compose.yml
```

### Container Won't Start
```bash
# View detailed logs
docker compose logs postgres

# Check container inspect
docker inspect zenon-postgres
```

### Database Connection Fails
```bash
# Check if PostgreSQL is healthy
docker compose ps

# Test connection inside container
docker compose exec postgres psql -U zenon -d zenon_croptrial -c "SELECT version();"
```

### Out of Disk Space
```bash
# Clean unused images and volumes
docker system prune -a --volumes

# Check disk usage
docker system df
```

---

## Architecture

### Development (docker-compose.yml)
```
┌─────────────────┐
│   PostgreSQL    │  Port: 5434
│   + PostGIS     │  Data: postgres_data volume
└─────────────────┘
        │
        │ zenon-network
        │
┌─────────────────┐
│     Redis       │  Port: 6379
│   (No Auth)     │  Data: redis_data volume
└─────────────────┘
```

### Production (docker-compose.prod.yml)
```
┌─────────────────┐
│     Nginx       │  Ports: 80, 443
│   (Reverse      │  - Serves frontend
│    Proxy)       │  - Proxies /api to backend
└────────┬────────┘  - Serves /uploads
         │
┌────────▼────────┐
│   API Server    │  Port: 3000 (internal)
│   (Express +    │  - Uploads: ./uploads volume
│    TypeScript)  │  - Logs: api_logs volume
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼───┐  ┌──▼──────┐
│Postgres│  │  Redis  │
│+PostGIS│  │(Pw Auth)│
└────────┘  └─────────┘
```

---

## Performance Tuning (Production)

### PostgreSQL
Edit `docker-compose.prod.yml` to add performance parameters:
```yaml
postgres:
  command:
    - "postgres"
    - "-c"
    - "max_connections=200"
    - "-c"
    - "shared_buffers=256MB"
    - "-c"
    - "effective_cache_size=1GB"
    - "-c"
    - "work_mem=16MB"
```

### Redis
For persistence:
```yaml
redis:
  command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
```

---

## Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Use strong Redis password
- [ ] Generate secure JWT_SECRET (min 32 characters)
- [ ] Enable firewall (ufw) and only allow necessary ports
- [ ] Use SSL/TLS in production
- [ ] Regular security updates (apt update && apt upgrade)
- [ ] Setup automated backups
- [ ] Use non-root user for application
- [ ] Implement rate limiting
- [ ] Monitor logs for suspicious activity

---

For more information, see the main [README.md](./README.md) and [specs.md](./specs.md).
