import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

// Flat config (ESLint 9). El lint corre como aviso vía `npm run lint`; no
// bloquea el build (ver eslint.ignoreDuringBuilds en next.config.mjs).
const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: ['.next/**', 'node_modules/**', 'legacy/**', 'playwright-report/**', 'test-results/**'],
  },
];

export default eslintConfig;
