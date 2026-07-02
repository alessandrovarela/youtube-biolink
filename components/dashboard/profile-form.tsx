'use client';

// Story 2.10 — form de perfil. Story 4.2 — migrado para os primitivos do
// design system (Input, Textarea, Avatar, Button, Toast).
import { useActionState, useState } from 'react';
import { updateProfile } from '@/lib/actions/profile';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Toast } from '@/components/ui/Toast';

export type ProfileData = {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

const MAX_BIO = 160;

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [showToast, setShowToast] = useState(false);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : null;

  // Contador de bio: vira feedback de erro (vermelho + aria-invalid) ao passar
  // do limite — preserva o comportamento ao vivo do Epic 2 após a migração 4.2.
  const bioOverLimit = bio.length > MAX_BIO;
  const bioCounter = `${bio.length}/${MAX_BIO}`;

  // Dispara o toast quando um novo resultado de sucesso chega (ajuste de estado
  // durante o render em vez de effect — padrão recomendado pelo React).
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) setShowToast(true);
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar
          src={avatarUrl || null}
          displayName={profile.display_name || profile.username}
          size={64}
        />
        <div className="text-sm text-muted-fg">
          @{profile.username}
          <span className="ml-2 opacity-70">(username não editável no MVP)</span>
        </div>
      </div>

      <Input
        label="Nome de exibição"
        name="display_name"
        defaultValue={profile.display_name ?? ''}
        error={fieldErrors.display_name}
      />

      <Textarea
        label="Bio"
        name="bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={3}
        error={fieldErrors.bio ?? (bioOverLimit ? bioCounter : undefined)}
        hint={bioOverLimit ? undefined : bioCounter}
      />

      <Input
        label="URL do avatar"
        name="avatar_url"
        type="url"
        value={avatarUrl}
        onChange={(e) => setAvatarUrl(e.target.value)}
        error={fieldErrors.avatar_url}
      />

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <Button type="submit" loading={pending} className="self-start">
        Salvar perfil
      </Button>

      {showToast && (
        <Toast message="Perfil atualizado!" variant="success" onDismiss={() => setShowToast(false)} />
      )}
    </form>
  );
}
