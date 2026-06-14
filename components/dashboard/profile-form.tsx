'use client';

import { useActionState, useState } from 'react';
import { updateProfile } from '@/lib/actions/profile';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';

export type ProfileData = {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

const MAX_BIO = 160;

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const [state, action] = useActionState(updateProfile, null);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [avatarError, setAvatarError] = useState(false);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : null;
  const initials = (profile.display_name || profile.username).slice(0, 2).toUpperCase();

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {avatarUrl && !avatarError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-16 w-16 rounded-full object-cover"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 font-medium">
            {initials}
          </div>
        )}
        <div className="text-sm text-gray-600">
          @{profile.username}
          <span className="ml-2 text-gray-400">(username não editável no MVP)</span>
        </div>
      </div>

      <Field
        label="Nome de exibição"
        name="display_name"
        defaultValue={profile.display_name ?? ''}
        error={fieldErrors.display_name}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="bio" className="text-sm font-medium">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          aria-invalid={fieldErrors.bio ? true : undefined}
          className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
        <span className={`text-xs ${bio.length > MAX_BIO ? 'text-red-600' : 'text-gray-500'}`}>
          {bio.length}/{MAX_BIO}
        </span>
        {fieldErrors.bio && (
          <span role="alert" className="text-sm text-red-600">
            {fieldErrors.bio}
          </span>
        )}
      </div>

      <Field
        label="URL do avatar"
        name="avatar_url"
        type="url"
        value={avatarUrl}
        onChange={(e) => {
          setAvatarUrl(e.target.value);
          setAvatarError(false);
        }}
        error={fieldErrors.avatar_url}
      />

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}
      {state?.ok && <p className="text-sm text-green-700">Perfil atualizado!</p>}

      <SubmitButton>Salvar perfil</SubmitButton>
    </form>
  );
}
