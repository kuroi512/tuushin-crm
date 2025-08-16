#!/usr/bin/env node
import { spawn } from 'node:child_process';

const url = process.env.DATABASE_URL || '';
const isPostgres = /^postgres(ql)?:\/\//i.test(url);

if (!isPostgres) {
  console.log('[skip] prisma migrate deploy: DATABASE_URL is missing or not a postgres URL');
  process.exit(0);
}

const child = spawn('pnpm', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', shell: false });
child.on('exit', (code) => process.exit(code ?? 0));
