// Limpeza de usuários de teste. Deletar o auth.user remove o profile em cascata
// (FK ON DELETE CASCADE — Story 2.1). Requer service role.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function deleteTestUser(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId);
}

export async function deleteTestUsers(admin: SupabaseClient, userIds: string[]): Promise<void> {
  for (const id of userIds) {
    await deleteTestUser(admin, id);
  }
}
