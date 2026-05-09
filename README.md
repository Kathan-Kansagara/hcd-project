# 🌿 Zenon CropTrial

Crop Trial Observation System for Zenon Bioscience - A modern web-based platform for recording, comparing, and analyzing agricultural crop trial data.

## 📋 Project Overview

This system helps field agents digitize crop trial observations, compare before/after treatment results with photo evidence, and generate analytical insights through comprehensive dashboards.

## 🏗 Project Structure

```
zenon-croptrial/
├── apps/
│   ├── web/          # React frontend (Vite + TypeScript + Tailwind + ShadCN)
│   └── api/          # Express backend (Node.js + TypeScript)
├── packages/
│   ├── shared/       # Shared types, constants, and utilities
│   ├── validators/   # Zod validation schemas
│   ├── ui/           # Shared UI components (future)
│   └── database/     # Prisma client wrapper
├── specs.md          # Technical specification & progress tracking
└── turbo.json        # Turborepo configuration
```

## 🛠 Tech Stack

### Frontend
- **React 19** + TypeScript
- **Vite** - Build tool
- **Tailwind CSS** + **ShadCN UI** - Styling & components
- **TanStack Query** - Data fetching (to be added)
- **React Router** - Routing (to be added)
- **React Hook Form** + **Zod** - Form validation

### Backend
- **Node.js 22** + **Express** + TypeScript
- **PostgreSQL** + **PostGIS** - Database with geospatial support
- **Prisma** - ORM
- **JWT** + **Passport** - Authentication
- **Multer** + **Sharp** - File uploads & image processing

### Development Tools
- **pnpm** - Package manager
- **Turborepo** - Monorepo build system
- **ESLint** + **Prettier** - Code quality
- **Vitest** - Unit testing (to be added)
- **Playwright** - E2E testing (to be added)

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ (currently using v22.17.0)
- pnpm 10+ (installed via Volta)
- PostgreSQL 16+ with PostGIS extension

### Installation

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Setup environment variables**
   ```bash
   # Backend
   cp apps/api/.env.example apps/api/.env
   # Edit apps/api/.env with your database credentials
   ```

3. **Start development servers**
   ```bash
   # Start all apps
   pnpm dev

   # Or start individually
   pnpm --filter @zenon/web dev    # Frontend: http://localhost:5173
   pnpm --filter @zenon/api dev    # Backend: http://localhost:3000
   ```

### Available Commands

```bash
pnpm dev          # Start all apps in development mode
pnpm build        # Build all apps for production
pnpm lint         # Lint all packages
pnpm type-check   # TypeScript type checking
pnpm test         # Run tests (when implemented)
```

## 📦 Packages

### @zenon/shared
Shared utilities, types, and constants used across frontend and backend.

### @zenon/validators
Zod validation schemas for:
- Farmers
- Trials
- Applications
- Users
- Comments

### @zenon/database
Prisma client wrapper for database operations (to be configured).

## 🗄 Database Setup (Coming Next)

The database will be configured with:
- PostgreSQL 16+ with PostGIS extension
- 8 main tables: users, farmers, products, trials, applications, photos, comments, audit_logs
- Prisma migrations for version control

## 📝 Progress Tracking

See `specs.md` for the complete technical specification and implementation checklist.

**Phase 1: Project Setup** ✅ COMPLETED
- [x] Monorepo initialization
- [x] Frontend setup (React + Vite + Tailwind + ShadCN)
- [x] Backend setup (Express + TypeScript)
- [x] Shared packages
- [x] Code quality tools (ESLint, Prettier)

**Next: Phase 2 - Database & Backend Core**

## 🤝 Contributing

1. Follow the existing code style (ESLint + Prettier configured)
2. Use conventional commit messages
3. Update specs.md checklist as you complete tasks
4. Write tests for new features

## 📄 License

ISC

## 👥 Author

Zenon Bioscience

---

For detailed technical specification, API documentation, and implementation details, see [specs.md](./specs.md).
