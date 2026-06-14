// Mensagens de erro em pt-BR para os tipos de erro de validação.
import type { UsernameError } from './username';

export function usernameErrorMessage(error: UsernameError): string {
  switch (error) {
    case 'too_short':
      return 'Username deve ter ao menos 3 caracteres';
    case 'too_long':
      return 'Username deve ter no máximo 30 caracteres';
    case 'invalid_format':
      return 'Use apenas letras minúsculas, números e _ (comece com letra)';
    case 'reserved':
      return 'Esse username é reservado';
  }
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
