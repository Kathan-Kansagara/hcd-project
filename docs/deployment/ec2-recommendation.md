# EC2 Instance Recommendation — Zenon Management Portal

## Project Stack Analysis

Your project runs **3 Docker containers** via `docker-compose.prod.yml`:

| Container | Image / Build | Role | Resource Profile |
|---|---|---|---|
| **PostgreSQL + PostGIS** | `postgis/postgis:16-3.4` | Database with geospatial extensions | Memory-heavy (~200–400 MB) |
| **API Server** | Custom `Dockerfile` (Node 22 + Express + Prisma) | REST API backend | CPU + Memory (~150–300 MB) |
| **Nginx** | `nginx:1.27-alpine` | Reverse proxy + serves Vite/React SPA | Lightweight (~30–50 MB) |

---

## ✅ Recommended: `t3.small`

| Spec | Value | Cost (Approx) |
|---|---|---|
| **vCPUs** | 2 | $15/month |
| **RAM** | 2 GB | (On-Demand) |
| **Disk** | 30 GB gp3 | $2.40/month |

### Deployment Steps (Summary)
1. **Launch t3.small** with Ubuntu 24.04.
2. **Setup Swap Space** (Essential for 2GB RAM builds):
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```
3. **Install Docker** and clone repo.
4. **Deploy** using `./deploy.sh first-run`.

---

> [!IMPORTANT]
> Ensure [`.env.production`](file:///c:/zenon-management-portal/zenon-management-portal/.env.production) is configured with secure passwords before running the deploy script.
