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

// Run migrate deploy and handle failed migrations
async function runMigrations() {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['prisma', 'migrate', 'deploy'], {
      stdio: 'pipe',
      shell: false,
      env: {
        ...process.env,
        DATABASE_URL: resolvedDbUrl,
        DIRECT_URL: resolvedDirectUrl,
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('exit', async (code) => {
      if (code === 0) {
        resolve(0);
        return;
      }

      // Check if the error is about failed migrations (P3009)
      const output = stdout + stderr;
      if (output.includes('P3009') || output.includes('failed migrations')) {
        console.log('[prisma:migrate] Detected failed migrations, attempting to resolve...');

        // Extract migration name from error message (format: The `20251103131112_go` migration started...)
        const migrationMatch = output.match(/`([^`]+)`\s+migration\s+started/);
        if (migrationMatch) {
          const failedMigration = migrationMatch[1];
          console.log(
            `[prisma:migrate] Attempting to mark migration "${failedMigration}" as rolled back...`,
          );

          // Mark the failed migration as rolled back
          const resolveChild = spawn(
            'pnpm',
            ['prisma', 'migrate', 'resolve', '--rolled-back', failedMigration],
            {
              stdio: 'inherit',
              shell: false,
              env: {
                ...process.env,
                DATABASE_URL: resolvedDbUrl,
                DIRECT_URL: resolvedDirectUrl,
              },
            },
          );

          resolveChild.on('exit', async (resolveCode) => {
            if (resolveCode === 0) {
              console.log('[prisma:migrate] Failed migration resolved, retrying migrate deploy...');
              // Retry the migration
              const retryChild = spawn('pnpm', ['prisma', 'migrate', 'deploy'], {
                stdio: 'inherit',
                shell: false,
                env: {
                  ...process.env,
                  DATABASE_URL: resolvedDbUrl,
                  DIRECT_URL: resolvedDirectUrl,
                },
              });
              retryChild.on('exit', (retryCode) => {
                if (retryCode === 0) {
                  resolve(0);
                } else {
                  reject(new Error(`Migration retry failed with code ${retryCode}`));
                }
              });
            } else {
              reject(new Error(`Failed to resolve migration: ${failedMigration}`));
            }
          });
        } else {
          reject(new Error('Failed migrations detected but could not extract migration name'));
        }
      } else {
        reject(new Error(`Migration failed with code ${code}`));
      }
    });
  });
}

// Run migrations with error handling
runMigrations()
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    console.error('[prisma:migrate] Error:', error.message);
    process.exit(1);
  });
