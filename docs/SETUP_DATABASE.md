# Free managed Postgres setup

Pick one of the free options below and connect it to this app via `DATABASE_URL`.

## Option A: Prisma Postgres (free dev DB)

- Best if you’re already using Prisma and want a quick, integrated DB.
- Requires Prisma account sign-in.

Steps:

1. Sign in when prompted by the editor (or via Prisma Data Platform).
2. Create database: Tuushin CRM Dev DB in a nearby region.
3. Copy the connection string into `.env` as `DATABASE_URL`.
4. Migrate and seed:
   - pnpm prisma migrate deploy
   - pnpm seed (optional if you want sample data)

## Option B: Neon (free tier)

- Serverless Postgres with generous free tier and project dashboards.

Steps:

1. https://neon.tech → New Project → Postgres 16+.
2. In Connection Details: copy the “Direct” connection string (not pooled) and set in `.env` as `DATABASE_URL`.
3. Optional: if Neon provides both pooled and direct, you can set `DIRECT_URL` to the direct one as well.
4. Run:
   - pnpm prisma migrate deploy
   - pnpm seed (optional)

## Option C: Supabase (free tier)

- Includes Postgres, GUI tables, auth, and storage.

Steps:

1. https://supabase.com → New project → pick free plan.
2. Settings → Database → Connection string (Node.js driver style) → set in `.env` as `DATABASE_URL`.
3. Run:
   - pnpm prisma migrate deploy
   - pnpm seed (optional)

## After connecting any provider

- Verify Prisma Client: pnpm postinstall (or reinstall deps)
- Local run: pnpm dev
- Ensure admin user exists (optional): POST /api/users/ensure-admin
- Deploy: add the same `DATABASE_URL` in your hosting provider (e.g., Vercel) → redeploy.

## Troubleshooting

- SSL: If your provider requires SSL, append `&sslmode=require` or use their provided query params.
- Migrations not applied: Ensure the database is empty or run `prisma migrate deploy` against it.
- Slow cold-start (Neon): first query can be slower on free tier. Consider keeping a small ping.
