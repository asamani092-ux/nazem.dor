# AGENTS.md

## Cursor Cloud specific instructions

Full-stack app "ناظم الصغار" (Arabic RTL). Two services in this repo:

| Service | Path | Dev command | Port | Notes |
|---|---|---|---|---|
| Backend API + served UI | `backend/` | `npm run dev` (`tsx watch src/index.ts`) | 4000 | Fastify + Prisma + PostgreSQL. Serves `/api/*`, `/uploads/*`, and (if built) the frontend from `FRONTEND_DIST`. Health: `GET /api/health`. |
| Frontend | `frontend/` | `npm run dev` (Vite) | 5173 | Proxies `/api` and `/uploads` to `127.0.0.1:4000`. Lint: `npm run lint` (oxlint, warnings only). Build: `npm run build`. |

### Database (required, non-obvious)
- The app needs a local **PostgreSQL 16** cluster. It is NOT run via Docker in the cloud VM — the backend connects to a system cluster at `127.0.0.1:5432` using `DATABASE_URL` from `backend/.env` (copied from `backend/.env.example`): role `nazem` / password `nazem_secret` / db `nazem`.
- Start the cluster before the API: `sudo pg_ctlcluster 16 main start` (idempotent; `scripts/start.sh` and the `.cursor/environment.json` install step already do this).
- Schema is managed by Prisma migrations: `cd backend && npx prisma migrate deploy`. Seed the SUPER_MASTER admin + curriculum with `npm run seed` (idempotent upserts). These are run during environment install, not on every boot.

### Login / auth (non-obvious)
- Login is **phone-only, no password**. Seeded SUPER_MASTER admin phone: `0555143246`.
- Phones must be valid Saudi mobiles (`05XXXXXXXX`). New Dar/manager/teacher accounts log in with their own registered phone.

### Running & testing
- For dev, run backend (`4000`) and frontend (`5173`) separately and use the Vite server at `5173`. Alternatively `scripts/start.sh` builds the frontend and serves everything from the API on `4000`.
- Prisma client is generated into `node_modules`; after changing `schema.prisma` run `npx prisma generate` (a plain `npm install` alone does not regenerate it).
