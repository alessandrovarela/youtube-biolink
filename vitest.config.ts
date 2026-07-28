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
    // Sem `include` aqui DE PROPÓSITO: quem define o que roda são os dois projetos
    // abaixo. Um `include` neste nível é herdado por ambos e faz cada arquivo ser
    // coletado duas vezes (sintoma: a suíte "dobra" de 333 para ~686 testes).
    exclude: ['node_modules', '.next', '.aiox-core'],
    env,

    // ══════════════════════════════════════════════════════════════════════════
    // DOIS PERFIS DE TIMEOUT — unitário estrito, integração realista.
    // ══════════════════════════════════════════════════════════════════════════
    // PROBLEMA OBSERVADO: a suíte de integração apresentava falhas intermitentes de
    // "Test timed out in 5000ms" que desapareciam na re-execução, agravadas quando
    // vários arquivos rodavam em paralelo.
    //
    // DIAGNÓSTICO (medido, não suposto): o `testTimeout` estava no default de 5000 ms
    // para TODA a suíte, e os testes de integração fazem dezenas de round-trips de rede
    // sequenciais contra o Supabase `development` REMOTO. Durações reais observadas numa
    // execução VERDE:
    //
    //   rate-limit.test.ts       › "61 chamadas DIRETAS à RPC"            10.709 ms
    //   rate-limit-app-path.ts   › "o bucket track chaveia por (ip,link)"  9.242 ms
    //   rate-limit.test.ts       › "cada bucket da allowlist é aceito"      2.225 ms
    //   rate-limit.test.ts       › "(a) SUPRESSÃO DE ANALYTICS fechada"     2.067 ms
    //
    // Ou seja: testes de 2 a 10 segundos contra um teto de 5 segundos. Não era margem,
    // era sorteio — qualquer jitter de rede ou disputa de CPU entre workers paralelos
    // virava vermelho. Isso NÃO é regressão do Epic 6; é fragilidade que sempre esteve
    // lá e que só ficou visível quando o epic triplicou o número de testes de rede.
    //
    // Um único `testTimeout` global não resolve: subir para 30 s afrouxaria também os
    // testes unitários, onde 5 s continua sendo o limite certo (nada unitário deve
    // chegar perto disso, e um unitário lento É um defeito que queremos ver).
    //
    // Daí os dois perfis abaixo. `extends: true` faz cada projeto herdar plugins,
    // `resolve.alias`, `env` e `setupFiles` definidos acima — sem duplicação.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/*.test.{ts,tsx}'],
          // Inalterado de propósito: unitário não toca rede. Se um deles levar 5 s,
          // é bug do teste, e queremos que quebre.
          testTimeout: 5_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.{ts,tsx}'],
          // ~3× o pior caso observado (10,7 s). Folga para jitter de rede e para a
          // disputa entre workers, sem esconder um travamento de verdade.
          testTimeout: 30_000,
          // Os hooks (beforeAll/beforeEach) também falam com o banco — criam perfis,
          // links e limpam contadores. O default de 10 s é apertado pelo mesmo motivo,
          // e um hook estourado derruba o arquivo INTEIRO, não só um teste.
          hookTimeout: 30_000,
          // ⚠️ SEM `retry` AQUI, E A DECISÃO É DELIBERADA — foi testada e revertida.
          //
          // `retry: 1` foi avaliado como cobertura para flake de rede e se mostrou
          // ATIVAMENTE NOCIVO nesta suíte. Estes testes NÃO são idempotentes: eles
          // asseguram valores EXATOS de contadores persistentes no banco
          // (`expect(await totalHits('login', subject)).toBe(1)`) e a própria ação
          // testada incrementa esse contador. Uma segunda tentativa roda contra o
          // estado que a primeira deixou — `toBe(1)` passa a ver 2 — então o retry
          // converte uma falha transitória em falha GARANTIDA, e nunca resgata nada.
          // Observado na prática: o teste do vetor (b) falhou nas DUAS tentativas.
          //
          // A cura correta para instabilidade aqui é ISOLAMENTO (chaves únicas por
          // execução — ver `freshIp()` e o pepper aleatório em
          // rate-limit-app-path.test.ts), não repetição. Retry sobre estado
          // compartilhado esconde defeito de isolamento em vez de corrigi-lo.
        },
      },
    ],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
