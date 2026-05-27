import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Framework core (CommonJS — not subject to Next.js ESLint rules)
    '.aiox-core/**',
    // Claude Code hooks (CommonJS — not production app code)
    '.claude/**',
    // Design prototypes and docs (not production app code)
    'docs/**',
  ]),
  // Must be last — disables ESLint rules that conflict with Prettier formatting.
  prettierConfig,
]);

export default eslintConfig;
