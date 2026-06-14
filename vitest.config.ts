import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync, existsSync } from 'node:fs';

// Carrega .env / .env.local para expor credenciais do Supabase (URL/ANON/
// SERVICE_ROLE) aos testes de integração. Em CI as vars vêm do workflow, então
// arquivos ausentes são ignorados silenciosamente. Vars já no ambiente vencem.
function loadDotEnv(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const raw of readFileSync(file, 'utf-8').split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const m = raw.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

const env = {
  ...loadDotEnv(path.resolve(__dirname, '.env')),
  ...loadDotEnv(path.resolve(__dirname, '.env.local')),
};

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', '.aiox-core'],
    env,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
