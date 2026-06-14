// Gera dados de usuário de teste únicos por execução.
// E-mail: test-{hex}@youtube-biolink.test  |  username: test_{hex} (formato válido)
import { randomUUID } from 'node:crypto';

export interface TestUser {
  email: string;
  password: string;
  username: string;
}

export function uniqueTestUser(): TestUser {
  const hex = randomUUID().replace(/-/g, '').slice(0, 12);
  return {
    email: `test-${hex}@youtube-biolink.test`,
    password: 'Test1234!secure',
    username: `test_${hex}`, // começa com letra, [a-z0-9_], 17 chars → formato válido
  };
}
