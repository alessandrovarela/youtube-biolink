// Story 3.4 — integração: reordenação de links persiste a nova ordem + isolamento
// cross-user no reorder. Requer SERVICE_ROLE_KEY (criar usuários/profiles +
// cleanup sem rate-limit); sem o secret o bloco é skipado (mesmo padrão de
// links-crud.test.ts).
//
// As Server Actions (lib/actions/links.ts) dependem de cookies/getUser, então
// aqui reproduzimos a MESMA forma de query que reorderLinks executa (update em
// lote de `position` filtrando por id + profile_id, após validar ownership dos
// ids) para provar, contra o banco de dev, que a reordenação persiste com 20+
// links e que o filtro app-layer impede reordenar links de outro usuário (sem
// RLS no MVP — architecture.md § 9.3).
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn(
    '[links-reorder.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de integração de reordenação de links skipado.'
  );
}

suite('Story 3.4 — reordenação de links (integração)', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const anon = hasServiceRole() ? createAnonClient() : null;
  const createdUserIds: string[] = [];

  async function createUserWithProfile(): Promise<string> {
    const u = uniqueTestUser();
    const { data, error } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    expect(error).toBeNull();
    const userId = data.user!.id;
    createdUserIds.push(userId);
    return userId;
  }

  /** Reproduz reorderLinks: valida ownership dos ids e faz update em lote de position. */
  async function reorder(profileId: string, ids: string[]): Promise<boolean> {
    // Ownership: todos os ids devem pertencer ao usuário.
    const { data: owned } = await admin!.from('links').select('id').eq('profile_id', profileId);
    const ownedIds = new Set((owned ?? []).map((r) => r.id as string));
    if (ids.some((id) => !ownedIds.has(id))) return false;

    for (let position = 0; position < ids.length; position++) {
      await admin!
        .from('links')
        .update({ position })
        .eq('id', ids[position])
        .eq('profile_id', profileId);
    }
    return true;
  }

  afterAll(async () => {
    if (admin && createdUserIds.length) {
      await deleteTestUsers(admin, createdUserIds);
    }
  });

  it('reordena 20+ links e persiste a nova ordem (position = índice)', async () => {
    const profile = await createUserWithProfile();
    const COUNT = 22;

    // Cria COUNT links em ordem 0..COUNT-1.
    const rows = Array.from({ length: COUNT }, (_, i) => ({
      profile_id: profile,
      title: `Link ${i}`,
      url: `https://exemplo.com/${i}`,
      position: i,
    }));
    const { error: insertErr } = await admin!.from('links').insert(rows);
    expect(insertErr).toBeNull();

    // Lê ordenado por position para obter os ids na ordem original (0..COUNT-1).
    const { data: inserted } = await admin!
      .from('links')
      .select('id')
      .eq('profile_id', profile)
      .order('position', { ascending: true });
    expect(inserted).toHaveLength(COUNT);

    const originalIds = inserted!.map((r) => r.id as string);
    // Nova ordem: inverte a lista.
    const reversed = [...originalIds].reverse();
    const ok = await reorder(profile, reversed);
    expect(ok).toBe(true);

    // Lê ordenado por position: deve refletir exatamente a ordem invertida.
    const { data: after } = await admin!
      .from('links')
      .select('id, position')
      .eq('profile_id', profile)
      .order('position', { ascending: true });
    expect(after!.map((r) => r.id)).toEqual(reversed);
    // position contígua 0..COUNT-1.
    expect(after!.map((r) => r.position)).toEqual(Array.from({ length: COUNT }, (_, i) => i));
  }, 30000); // 20+ updates sequenciais contra o dev remoto — timeout generoso

  it('reordenação rejeita ids de outro usuário (ownership) e não altera as positions de B', async () => {
    const profileA = await createUserWithProfile();
    const profileB = await createUserWithProfile();

    await admin!.from('links').insert([
      { profile_id: profileB, title: 'B0', url: 'https://b.com/0', position: 0 },
      { profile_id: profileB, title: 'B1', url: 'https://b.com/1', position: 1 },
    ]);
    const { data: linksB } = await admin!
      .from('links')
      .select('id')
      .eq('profile_id', profileB)
      .order('position', { ascending: true });
    const idsB = linksB!.map((r) => r.id as string);

    // A tenta reordenar (inverter) os links de B: ownership de A não casa → rejeitado.
    const ok = await reorder(profileA, [...idsB].reverse());
    expect(ok).toBe(false);

    // Reforço app-layer: mesmo que o guard de ownership fosse burlado, o update
    // filtrado por profile_id = A sobre um link de B afeta 0 linhas (sem RLS,
    // o filtro é a barreira). Reproduz o acesso público via anon.
    const { data: touched } = await anon!
      .from('links')
      .update({ position: 99 })
      .eq('id', idsB[0])
      .eq('profile_id', profileA)
      .select('id');
    expect(touched ?? []).toHaveLength(0);

    // As positions de B permanecem intactas (0, 1).
    const { data: afterB } = await admin!
      .from('links')
      .select('id, position')
      .eq('profile_id', profileB)
      .order('position', { ascending: true });
    expect(afterB!.map((r) => r.id)).toEqual(idsB);
    expect(afterB!.map((r) => r.position)).toEqual([0, 1]);
  });
});
