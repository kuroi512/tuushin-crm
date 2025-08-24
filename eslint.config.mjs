import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import eslintConfigPrettier from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Next.js recommended + TypeScript
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // Turn off rules that might conflict with Prettier formatting
  eslintConfigPrettier,
  {
    ignores: [
      'node_modules',
      '.next',
      'dist',
      'build',
      'coverage',
      '.turbo',
      'public',
      '**/*.min.js',
    ],
  },
];

export default eslintConfig;
