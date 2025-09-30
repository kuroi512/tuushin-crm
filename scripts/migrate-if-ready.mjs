#!/usr/bin/env node
import { spawn } from 'node:child_process';

function prefer(...vars) {
  for (const v of vars) {
    if (v) return v;
  }
  return '';
}

function normalizePgUrl(url) {
  if (!url) return url;
  // Prisma expects postgresql://; accept common aliases and normalize
  return url.replace(/^psql:\/\//i, 'postgresql://').replace(/^postgres:\/\//i, 'postgresql://');
}

// Prefer provider-specific Prisma URL if present, then DATABASE_URL, then generic
const rawDbUrl = prefer(
  process.env.POSTGRES_PRISMA_URL,
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.POSTGRES_URL_NON_POOLING,
);
const resolvedDbUrl = normalizePgUrl(rawDbUrl);

const isPostgres = /^postgresql:\/\//i.test(resolvedDbUrl);

if (!isPostgres) {
  console.log('[skip] prisma migrate deploy: no valid Postgres URL configured');
  process.exit(0);
}

// For Prisma directUrl, prefer a non-pooled URL when available
const rawDirectUrl = prefer(
  process.env.DIRECT_URL,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.POSTGRES_URL,
  resolvedDbUrl,
);
const resolvedDirectUrl = normalizePgUrl(rawDirectUrl);

// Safe debug (do not print secrets)
const src =
  rawDbUrl === process.env.POSTGRES_PRISMA_URL
    ? 'POSTGRES_PRISMA_URL'
    : rawDbUrl === process.env.DATABASE_URL
      ? 'DATABASE_URL'
      : rawDbUrl === process.env.POSTGRES_URL
        ? 'POSTGRES_URL'
        : rawDbUrl === process.env.POSTGRES_URL_NON_POOLING
          ? 'POSTGRES_URL_NON_POOLING'
          : 'unknown';
console.log(`[prisma:migrate] Using ${src} with scheme postgresql://`);

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
