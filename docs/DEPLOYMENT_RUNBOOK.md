# Tuushin CRM Deployment Runbook

This runbook describes a safe deployment process for this repository using Docker and PostgreSQL.

## 1) Deployment prerequisites

- Docker and Docker Compose installed
- PostgreSQL credentials decided and stored securely
- Production values for all required environment variables
- Network access from app runtime to the external CRM API (if sync jobs are used)

## 2) Required environment variables

At minimum:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET` (or `AUTH_SECRET`, keep one canonical secret policy)

Strongly recommended:

- `MASTER_SYNC_API_KEY`
- `EXTERNAL_SHIPMENT_CRON_SECRET`
- `POSTGRES_PASSWORD` (if DB is in Compose)

Do not keep fallback defaults like `change-me` or `postgres` in production.

## 3) Build and run strategy in this repo

- Build command (`package.json`): `pnpm build`
- Build internally runs: `node scripts/migrate-if-ready.mjs && next build`
- Container start command (`Dockerfile`) runs migrations again, then `next start`

Operational implication:

- Migrations may run at build/start time when DB vars are present.
- Keep one deployment path (not mixed ad-hoc paths) to avoid migration race conditions.

## 4) Local/preview environment using Docker Compose

The repository includes:

- `docker-compose.yml` (app + db)
- `docker-compose.db.yml` (db only)
- `docker-compose.prod.yml` (production-oriented defaults)

Example (preview/local):

```bash
docker compose up --build -d
docker compose logs -f web
```

## 5) Production deployment procedure

1. Prepare env file/secrets in your platform.
2. Ensure DB is reachable from app runtime.
3. Build image from current commit.
4. Run one controlled migration execution.
5. Start app container(s).
6. Verify health and authentication.
7. Verify key business endpoints and sync jobs.

Minimal post-deploy checks:

- App UI loads and login works.
- `GET /api/health/db` reports DB connectivity.
- Core listing endpoints (`quotations`, dashboard metrics) return expected data.
- Cron/sync endpoints are inaccessible without secrets.

## 6) Rollback procedure

If deployment fails:

1. Stop new app rollout.
2. Roll back app image to previous stable version.
3. If schema migration already ran, validate backward compatibility before traffic restore.
4. Restore DB backup only when required and approved.

Important:

- Always create DB backups before high-risk schema changes.
- Practice rollback in staging at least once before client takeover.

## 7) CI/CD hardening recommendations

Current workflow only checks formatting. Add CI stages:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test:run`
5. `pnpm build`
6. Docker image build smoke test

## 8) Security checklist before client handover

- Set production secrets (`NEXTAUTH_SECRET`, DB password, sync secrets)
- Disable unauthenticated sync access (enforce API keys/secrets)
- Remove or lock down emergency admin reset paths
- Ensure transport security (HTTPS) and trusted host config
- Restrict DB exposure to private network if possible

## 9) Responsibility split during handover

- Client dev team: app feature maintenance
- Client ops team: infrastructure, secrets, monitoring, backups
- Final sign-off: successful staging deployment and runbook rehearsal
