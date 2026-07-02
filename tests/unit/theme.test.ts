// Story 4.3 — testes do helper puro de tema (reutilizado na 4.4).
import { describe, it, expect } from 'vitest';
import { isTheme, resolveTheme, resolveThemeClass, THEMES } from '@/lib/theme';

describe('THEMES', () => {
  it('expõe os três temas suportados', () => {
    expect(THEMES).toEqual(['light', 'dark', 'accent']);
  });
});

describe('isTheme', () => {
  it('aceita os temas válidos', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('accent')).toBe(true);
  });

  it('rejeita valores inválidos', () => {
    expect(isTheme('neon')).toBe(false);
    expect(isTheme('')).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(123)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('mantém temas válidos', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('accent')).toBe('accent');
    expect(resolveTheme('light')).toBe('light');
  });

  it('faz fallback para light em valor inválido/ausente', () => {
    expect(resolveTheme('garbage')).toBe('light');
    expect(resolveTheme(undefined)).toBe('light');
    expect(resolveTheme(null)).toBe('light');
    expect(resolveTheme('')).toBe('light');
  });
});

describe('resolveThemeClass', () => {
  it('light retorna string vazia (usa :root)', () => {
    expect(resolveThemeClass('light')).toBe('');
  });

  it('dark retorna theme-dark', () => {
    expect(resolveThemeClass('dark')).toBe('theme-dark');
  });

  it('accent retorna theme-accent', () => {
    expect(resolveThemeClass('accent')).toBe('theme-accent');
  });

  it('valor inválido/ausente cai em light (string vazia)', () => {
    expect(resolveThemeClass('neon')).toBe('');
    expect(resolveThemeClass(undefined)).toBe('');
    expect(resolveThemeClass(null)).toBe('');
    expect(resolveThemeClass('')).toBe('');
  });
});
