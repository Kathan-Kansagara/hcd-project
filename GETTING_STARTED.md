# Getting Started – Management Portal

This folder contains only the **management portal** (API + Web app). No public website or sensitive data is included.

## Prerequisites

- **Node.js** 20+ (22 recommended)
- **pnpm** 10+
- **Docker** and **Docker Compose** v2

## Quick start

### 1. Create environment files (no secrets – use your own values)

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit **`apps/api/.env`**:

- `DATABASE_URL="postgresql://zenon:zenon_dev_password@localhost:5434/zenon_croptrial?schema=public"`
- `JWT_SECRET="your-own-long-random-string-at-least-32-chars"`
- `ALLOWED_ORIGINS="http://localhost:5173"`

Edit **`apps/web/.env`**:

- `VITE_API_BASE_URL=http://localhost:3000/api/v1`

### 2. Start the database

```bash
docker compose up -d
```

PostgreSQL (with PostGIS) will run on port **5434**.

### 3. Install dependencies and run migrations

```bash
pnpm install
cd packages/database && pnpm exec prisma migrate deploy && cd ../..
```

### 4. Start the API and the web app

**Terminal 1 – API:**

```bash
pnpm --filter @zenon/api dev
```

**Terminal 2 – Web:**

```bash
pnpm --filter @zenon/web dev
```

- **API:** http://localhost:3000  
- **Management portal:** http://localhost:5173  

### 5. (Optional) Seed the database

```bash
pnpm --filter @zenon/database exec prisma db seed
```

---

For more detail (what’s included/excluded, production-style setup), see **MANAGEMENT_PORTAL_SHARE.md**.
