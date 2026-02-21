# Chat App — Local Docker Setup

## Quick Start
1. `docker compose up --build`
2. Seed demo data:
   - `docker compose exec api npm run seed`
3. Smoke test:
   - `./scripts/smoke.sh`
4. E2E tests:
   - `cd api && npm run test:e2e`
5. Load test:
   - `cd api && npm run load:test`
6. Index audit (report-only):
   - `cd api && npm run index:audit`

## Ports
1. Web: `http://localhost:3000`
1. API: `http://localhost:3001`
1. Mongo: `mongodb://localhost:27017`
1. Redis: `localhost:6379`

## Seed Credentials
1. `userA@example.com` / `Password123!`
1. `userB@example.com` / `Password123!`

## Environment
1. API env example: `api/.env.example`
1. Web env example: `web/.env.example`
1. Compose env example: `.env.example`

## Notes
1. Attachment URLs are served from `http://localhost:3001/uploads/...`
1. For Next.js public env changes, rebuild the web image (`docker compose build web`).

## Production Notes
1. Build:
   - `docker compose build`
2. Required env vars (API):
   - `MONGO_URI`, `REDIS_HOST`, `REDIS_PORT`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`
3. Required env vars (Web):
   - `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` (build-time)
4. Upload persistence:
   - Ensure `/app/uploads` is backed by a volume or persistent disk.
5. Reverse proxy:
   - Terminate TLS at Nginx/Caddy.
   - Proxy `/` to web container and `/` (API) to api container, preserve websockets.
6. Rate limiting:
   - Defaults are in `api/.env.example`; tune per environment.
