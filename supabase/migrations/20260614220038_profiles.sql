-- Story 2.1 — Schema profiles e trigger de sincronização auth.users → profiles
-- Fonte: docs/architecture.md § 9.2
-- Depende da baseline (pgcrypto, citext, set_updated_at) — Story 1.4.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username citext UNIQUE NOT NULL,
  display_name text,
  bio text CHECK (bio IS NULL OR char_length(bio) <= 160),
  avatar_url text,
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'accent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT username_format CHECK (
    char_length(username) BETWEEN 3 AND 30
    AND username ~ '^[a-z][a-z0-9_]*$'
  )
);

-- Trigger updated_at (reusa função da baseline)
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger de sincronização auth.users → profiles.
-- SECURITY DEFINER: insere em profiles no caminho do signup sem depender de RLS
-- (que não existe no MVP). SET search_path previne hijack.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
