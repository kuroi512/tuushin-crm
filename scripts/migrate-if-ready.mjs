#!/usr/bin/env node
import { spawn } from 'node:child_process';

// Prefer DATABASE_URL, but support Vercel Postgres envs out of the box
const resolvedDbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

const isPostgres = /^postgres(ql)?:\/\//i.test(resolvedDbUrl);

if (!isPostgres) {
  console.log('[skip] prisma migrate deploy: no postgres URL found in DATABASE_URL/POSTGRES_* envs');
  process.exit(0);
}

// For Prisma directUrl, prefer a non-pooled URL when available
const resolvedDirectUrl =
  process.env.DIRECT_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || resolvedDbUrl;

const child = spawn('pnpm', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    DATABASE_URL: resolvedDbUrl,
    DIRECT_URL: resolvedDirectUrl,
  },
});
child.on('exit', (code) => process.exit(code ?? 0));
