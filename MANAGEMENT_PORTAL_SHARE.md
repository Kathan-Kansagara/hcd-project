# Sharing the Management Portal (No Website, No Secrets)

Use this guide when sharing the project with someone who should run **only the management portal** (API + Web app) via Docker, without the public website or any sensitive information.

---

## What to Share (Include)

Share the **entire repo** except the items listed in **What NOT to Share**. The recipient needs:

### Required for management portal + Docker

| Path | Purpose |
|------|--------|
| `apps/api/` | Backend API |
| `apps/web/` | Management portal frontend |
| `packages/database/` | Prisma schema, client, migrations |
| `packages/shared/` | Shared types/utils |
| `packages/validators/` | Zod schemas |
| `docker/` | Postgres init scripts |
| `docker-compose.yml` | Run Postgres (and optional Redis) in Docker |
| `pnpm-workspace.yaml` | Monorepo workspace |
| `package.json` | Root scripts and Volta/pnpm config |
| `pnpm-lock.yaml` | Lockfile |
| `turbo.json` | Turborepo config |
| `apps/api/.env.example` | API env template |
| `apps/web/.env.example` | Web env template |
| `.env.example` | Root env template (Postgres for Docker) |
| `DOCKER.md` | Docker usage (dev section only; see below) |
| `README.md` | Overview (optional; you may trim deployment sections) |

### Optional but useful

- `Dockerfile` – if they will run the API in Docker later  
- `docker-compose.prod.yml` – if they want production-style Postgres only  
- `.editorconfig`, `.prettierrc` – code style  
- `packages/database/prisma/` – migrations and schema (required for DB)

---

## What NOT to Share (Exclude)

Remove or **do not copy** these so the recipient never sees secrets or the public website:

### 1. Public website (entire app)

- **`apps/website/`** – entire directory (marketing/public website)

### 2. Environment and secrets (never share real values)

- **`.env`** – any root `.env`
- **`.env.docker`** – contains real Postgres password
- **`.env.prod`** – production env
- **`.env.production`** – production env
- **`apps/api/.env`** – real API secrets (DB, JWT, etc.)
- **`apps/web/.env`** – real API URL / keys

**Do share:**  
- `.env.example`, `apps/api/.env.example`, `apps/web/.env.example`  
- `.env.production.example` (optional, for reference only)

### 3. Deployment and server-specific files

- **`deploy.sh`** – server deploy script (repo URL, paths, Nginx)
- **`deploy-prod.sh`** – production deploy (repo URL, domains, generated secrets)
- **`nginx/`** – Nginx configs (often contain your domain names)
- **`NGINX_SETUP.md`**, **`NGINX_SETUP_HOST.md`** – reference your real domains (e.g. `management.zenonbioscience.com`)
- **`DEPLOYMENT.md`**, **`SIMPLE_DEPLOY.md`** – if they reference your live URLs or secrets

You can share a **sanitized** short “Docker + env only” version of deployment steps (like the “Steps for the recipient” below) instead of these files.

### 4. Data and generated content

- **`postgres-data/`** – local DB data
- **`backups/`** – DB backups
- **`apps/api/uploads/`** – uploaded files (keep `apps/api/uploads/.gitkeep` if you share the repo)
- **`logs/`** – log files

### 5. Other (optional to exclude)

- **`.cursor/`** – Cursor/IDE rules (optional; no secrets usually)
- **`agent-transcripts/`** – if present and you don’t want to share chat history

---

## How the recipient runs it (Docker + env only)

Give them these steps so they can run the management portal with **only** Docker and env setup (no website).

### 1. Prerequisites

- Node.js 20+ (or 22), pnpm 10+
- Docker and Docker Compose v2

### 2. Get the code

- **Option A:** Clone the repo, then delete `apps/website/` and any sensitive files listed in “What NOT to Share.”
- **Option B:** Create a zip/tarball that excludes `apps/website/`, `deploy.sh`, `deploy-prod.sh`, `nginx/`, real `.env` files, and the other excluded paths above.

They should end up with a tree that has `apps/api/`, `apps/web/`, `packages/`, `docker/`, `docker-compose.yml`, and the `.env.example` files, but **no** `apps/website/`.

### 3. Environment from examples (no secrets)

**Root `.env` is optional:** The repo’s `docker-compose.yml` (dev) uses fixed defaults (port 5434, password `zenon_dev_password`) and does **not** read a root `.env`. So the recipient only needs to create env files for the API and the web app.

```bash
# API (required)
cp apps/api/.env.example apps/api/.env

# Web (required)
cp apps/web/.env.example apps/web/.env
```

They should edit **`apps/api/.env`** and **`apps/web/.env`** as below. No root `.env` is needed for `docker compose up -d` with the default `docker-compose.yml`.

**Example `apps/api/.env` for local Docker Postgres:**

- `DATABASE_URL="postgresql://zenon:zenon_dev_password@localhost:5434/zenon_croptrial?schema=public"`  
  (matches default `docker-compose.yml`: port 5434, user `zenon`, password `zenon_dev_password`)
- `JWT_SECRET="any-long-random-string-at-least-32-chars"`
- `ALLOWED_ORIGINS="http://localhost:5173"`
- `PORT=3000`

**Example `apps/web/.env`:**

- `VITE_API_BASE_URL=http://localhost:3000/api/v1`

### 4. Start Postgres with Docker

```bash
docker compose up -d
```

This starts Postgres (port 5434 on host). No root `.env` is required for this step when using the default `docker-compose.yml`.

### 5. Install deps, migrate, run portal only (no website)

```bash
pnpm install
cd packages/database && pnpm prisma migrate deploy && cd ../..
```

Then start **only** the management portal (API + Web), not the website:

```bash
pnpm --filter @zenon/api dev &
pnpm --filter @zenon/web dev
```

Or in two terminals:

- Terminal 1: `pnpm --filter @zenon/api dev`
- Terminal 2: `pnpm --filter @zenon/web dev`

- API: http://localhost:3000  
- Management portal: http://localhost:5173  

They **should not** run `pnpm dev` at the root if the repo still contains `apps/website/`, because that would start the website too. If you’ve removed `apps/website/`, `pnpm dev` is fine and will only run API + web.

### 6. Optional: seed DB

If you want them to have sample data:

```bash
pnpm --filter @zenon/database exec prisma db seed
```

(Only if seed is configured in `packages/database/package.json` and safe for sharing.)

---

## One-line summary

**Share:** Repo minus `apps/website/`, minus all real `.env` and deploy/nginx/sensitive docs; **include** `apps/api`, `apps/web`, `packages/*`, `docker-compose.yml`, `docker/`, and all `.env.example` files.  
**They run:** Copy env from examples → `docker compose up -d` → `pnpm install` → `prisma migrate deploy` → `pnpm --filter @zenon/api dev` + `pnpm --filter @zenon/web dev`.
