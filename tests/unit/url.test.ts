import { describe, it, expect } from 'vitest';
import { sanitizeLinkUrl } from '@/lib/validation/url';

describe('sanitizeLinkUrl', () => {
  describe('happy path', () => {
    it('aceita http:// e retorna a URL canônica', () => {
      expect(sanitizeLinkUrl('http://example.com')).toEqual({
        ok: true,
        value: 'http://example.com/',
      });
    });

    it('aceita https://', () => {
      expect(sanitizeLinkUrl('https://example.com')).toEqual({
        ok: true,
        value: 'https://example.com/',
      });
    });

    it('faz trim de espaços em volta e aceita', () => {
      expect(sanitizeLinkUrl('  https://example.com/  ')).toEqual({
        ok: true,
        value: 'https://example.com/',
      });
    });

    it('preserva query (search)', () => {
      const r = sanitizeLinkUrl('https://example.com/path?a=1&b=2');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe('https://example.com/path?a=1&b=2');
    });

    it('preserva fragment (hash)', () => {
      const r = sanitizeLinkUrl('https://example.com/path#section');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe('https://example.com/path#section');
    });

    it('preserva query + fragment juntos', () => {
      const r = sanitizeLinkUrl('https://example.com/p?q=x#frag');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe('https://example.com/p?q=x#frag');
    });

    it('scheme case-insensitive: HTTPS:// é aceito', () => {
      const r = sanitizeLinkUrl('HTTPS://Example.com');
      expect(r.ok).toBe(true);
    });
  });

  describe('rejeição de schemes perigosos', () => {
    it('rejeita javascript:', () => {
      expect(sanitizeLinkUrl('javascript:alert(1)')).toEqual({
        ok: false,
        error: 'unsupported_scheme',
      });
    });

    it('rejeita JaVaScRiPt: (casing misto / obfuscation)', () => {
      expect(sanitizeLinkUrl('JaVaScRiPt:alert(1)')).toEqual({
        ok: false,
        error: 'unsupported_scheme',
      });
    });

    it('rejeita " javascript:" com espaço inicial (obfuscation)', () => {
      expect(sanitizeLinkUrl(' javascript:alert(1)')).toEqual({
        ok: false,
        error: 'unsupported_scheme',
      });
    });

    it('rejeita "\\tjavascript:" com tab inicial (obfuscation)', () => {
      expect(sanitizeLinkUrl('\tjavascript:alert(1)')).toEqual({
        ok: false,
        error: 'unsupported_scheme',
      });
    });

    it('rejeita data:', () => {
      expect(sanitizeLinkUrl('data:text/html,<script>alert(1)</script>')).toEqual({
        ok: false,
        error: 'unsupported_scheme',
      });
    });

    it('rejeita vbscript:', () => {
      expect(sanitizeLinkUrl('vbscript:msgbox(1)')).toEqual({
        ok: false,
        error: 'unsupported_scheme',
      });
    });

    it('rejeita file:', () => {
      expect(sanitizeLinkUrl('file:///etc/passwd')).toEqual({
        ok: false,
        error: 'unsupported_scheme',
      });
    });
  });

  describe('rejeição de entradas inválidas', () => {
    it('rejeita string vazia', () => {
      expect(sanitizeLinkUrl('')).toEqual({ ok: false, error: 'empty' });
    });

    it('rejeita string só com espaços', () => {
      expect(sanitizeLinkUrl('   ')).toEqual({ ok: false, error: 'empty' });
    });

    it('rejeita URL sem scheme (example.com)', () => {
      expect(sanitizeLinkUrl('example.com')).toEqual({
        ok: false,
        error: 'no_scheme',
      });
    });

    it('rejeita URL malformada (scheme presente mas parse falha)', () => {
      expect(sanitizeLinkUrl('http://')).toEqual({
        ok: false,
        error: 'malformed',
      });
    });
  });
});
