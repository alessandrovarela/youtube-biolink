// Epic 6 — trava de regressão do open redirect em /auth/callback (gate Wave 4, issue #6).
//
// O defeito original (Story 2.5): a validação era feita sobre a STRING CRUA
// (`startsWith('/') && !startsWith('//')`), enquanto quem decide o destino é o PARSER de
// URL. O parser do WHATWG trata `\` como `/` em URLs http/https, então `/\evil.com`
// passava nos dois testes de string e resolvia para `http://evil.com/`.
//
// Estes testes travam a classe INTEIRA de truques de normalização, não só o caso
// reportado — é o que diferencia uma trava de regressão de um teste de anedota.
import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/app/auth/callback/route';

const ORIGIN = 'http://localhost:3000';

describe('safeNextPath — proteção contra open redirect', () => {
  describe('recusa destinos externos', () => {
    // O caso que a validação original JÁ pegava.
    it('recusa `//evil.com` (protocol-relative clássico)', () => {
      expect(safeNextPath('//evil.com', ORIGIN)).toBeNull();
    });

    // ── O caso que a validação original DEIXAVA PASSAR ────────────────────────
    it('recusa `/\\evil.com` (backslash normaliza para protocol-relative)', () => {
      expect(safeNextPath('/\\evil.com', ORIGIN)).toBeNull();
    });

    it('recusa `/\\/evil.com` (backslash + barra)', () => {
      expect(safeNextPath('/\\/evil.com', ORIGIN)).toBeNull();
    });

    it('recusa `/\\\\evil.com` (backslash duplo)', () => {
      expect(safeNextPath('/\\\\evil.com', ORIGIN)).toBeNull();
    });

    it('recusa URL absoluta `https://evil.com`', () => {
      expect(safeNextPath('https://evil.com', ORIGIN)).toBeNull();
    });

    it('recusa URL absoluta no MESMO esquema do app', () => {
      expect(safeNextPath('http://evil.com/dashboard', ORIGIN)).toBeNull();
    });

    it('recusa esquemas não-http (`javascript:`, `mailto:`, `data:`)', () => {
      expect(safeNextPath('javascript:alert(1)', ORIGIN)).toBeNull();
      expect(safeNextPath('mailto:a@b.c', ORIGIN)).toBeNull();
      expect(safeNextPath('data:text/html,<script>alert(1)</script>', ORIGIN)).toBeNull();
    });

    it('recusa path relativo (não começa com `/`)', () => {
      expect(safeNextPath('dashboard', ORIGIN)).toBeNull();
      expect(safeNextPath('../dashboard', ORIGIN)).toBeNull();
    });

    it('recusa `next` ausente ou vazio', () => {
      expect(safeNextPath(null, ORIGIN)).toBeNull();
      expect(safeNextPath('', ORIGIN)).toBeNull();
    });
  });

  describe('aceita destinos locais legítimos', () => {
    it('aceita `/dashboard`', () => {
      expect(safeNextPath('/dashboard', ORIGIN)).toBe('/dashboard');
    });

    it('aceita `/reset-password/confirm` (o caso de uso real da Story 2.5)', () => {
      expect(safeNextPath('/reset-password/confirm', ORIGIN)).toBe('/reset-password/confirm');
    });

    it('preserva query string e hash', () => {
      expect(safeNextPath('/dashboard/links?tab=1#top', ORIGIN)).toBe('/dashboard/links?tab=1#top');
    });

    it('normaliza path traversal para dentro do próprio origin', () => {
      // `/dashboard/../login` resolve para `/login` — local, então é aceito, mas
      // devolvido JÁ NORMALIZADO. Nunca devolvemos a string crua: o valor usado no
      // redirect é exatamente o que foi validado.
      expect(safeNextPath('/dashboard/../login', ORIGIN)).toBe('/login');
    });
  });

  describe('a garantia vale para qualquer origin', () => {
    it.each([
      'https://youtube-biolink.vercel.app',
      'https://exemplo.com.br',
      'http://127.0.0.1:3000',
    ])('recusa externos e aceita locais com origin=%s', (origin) => {
      expect(safeNextPath('/\\evil.com', origin)).toBeNull();
      expect(safeNextPath('//evil.com', origin)).toBeNull();
      expect(safeNextPath('https://evil.com', origin)).toBeNull();
      expect(safeNextPath('/dashboard', origin)).toBe('/dashboard');
    });
  });
});
