import { describe, it, expect } from 'vitest';
import {
  validateUsername,
  normalizeUsername,
  RESERVED_USERNAMES,
} from '@/lib/validation/username';

describe('validateUsername', () => {
  describe('happy path', () => {
    it('aceita username válido simples', () => {
      expect(validateUsername('alessandro')).toEqual({ ok: true, value: undefined });
    });

    it('aceita letras, dígitos e underscore', () => {
      expect(validateUsername('dev_user_42')).toEqual({ ok: true, value: undefined });
    });

    it('aceita no limite mínimo (3) e máximo (30)', () => {
      expect(validateUsername('abc').ok).toBe(true);
      expect(validateUsername('a'.repeat(30)).ok).toBe(true);
    });
  });

  describe('normalização', () => {
    it('normaliza uppercase para lowercase e aceita', () => {
      expect(validateUsername('Alessandro')).toEqual({ ok: true, value: undefined });
    });

    it('faz trim de espaços antes de validar', () => {
      expect(validateUsername('  alessandro  ')).toEqual({ ok: true, value: undefined });
    });

    it('detecta reservado mesmo com case misto', () => {
      expect(validateUsername('AdMin')).toEqual({ ok: false, error: 'reserved' });
    });
  });

  describe('erros', () => {
    it('too_short: menos de 3 chars', () => {
      expect(validateUsername('ab')).toEqual({ ok: false, error: 'too_short' });
      expect(validateUsername('')).toEqual({ ok: false, error: 'too_short' });
    });

    it('too_long: mais de 30 chars', () => {
      expect(validateUsername('a'.repeat(31))).toEqual({ ok: false, error: 'too_long' });
    });

    it('invalid_format: começa com dígito', () => {
      expect(validateUsername('1abc')).toEqual({ ok: false, error: 'invalid_format' });
    });

    it('invalid_format: começa com underscore', () => {
      expect(validateUsername('_abc')).toEqual({ ok: false, error: 'invalid_format' });
    });

    it('invalid_format: contém hífen', () => {
      expect(validateUsername('ab-cd')).toEqual({ ok: false, error: 'invalid_format' });
    });

    it('invalid_format: contém caractere especial / espaço interno', () => {
      expect(validateUsername('ab cd')).toEqual({ ok: false, error: 'invalid_format' });
      expect(validateUsername('ab@cd')).toEqual({ ok: false, error: 'invalid_format' });
    });

    it('reserved: nomes de rota válidos no formato', () => {
      expect(validateUsername('admin')).toEqual({ ok: false, error: 'reserved' });
      expect(validateUsername('dashboard')).toEqual({ ok: false, error: 'reserved' });
      expect(validateUsername('login')).toEqual({ ok: false, error: 'reserved' });
      expect(validateUsername('health')).toEqual({ ok: false, error: 'reserved' });
    });
  });

  describe('precedência de erros', () => {
    it('comprimento é checado antes do formato', () => {
      // "1" começa com dígito (formato inválido) mas é curto demais primeiro
      expect(validateUsername('1')).toEqual({ ok: false, error: 'too_short' });
    });
  });
});

describe('normalizeUsername', () => {
  it('aplica trim e lowercase', () => {
    expect(normalizeUsername('  Alessandro ')).toBe('alessandro');
  });
});

describe('RESERVED_USERNAMES', () => {
  it('contém as rotas internas principais', () => {
    for (const name of ['admin', 'api', 'dashboard', 'login', 'signup', 'health']) {
      expect(RESERVED_USERNAMES.has(name)).toBe(true);
    }
  });
});
