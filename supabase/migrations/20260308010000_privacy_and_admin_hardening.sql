-- Privacy hardening defaults + admin-read support compatibility cleanup.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT,
  ADD COLUMN IF NOT EXISTS live_status_visibility TEXT;

UPDATE public.profiles
SET
  profile_visibility = COALESCE(profile_visibility, 'private'),
  live_status_visibility = COALESCE(live_status_visibility, 'private');

ALTER TABLE public.profiles
  ALTER COLUMN profile_visibility SET DEFAULT 'private',
  ALTER COLUMN profile_visibility SET NOT NULL,
  ALTER COLUMN live_status_visibility SET DEFAULT 'private',
  ALTER COLUMN live_status_visibility SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_profile_visibility_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_profile_visibility_check
      CHECK (profile_visibility IN ('private', 'shared'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_live_status_visibility_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_live_status_visibility_check
      CHECK (live_status_visibility IN ('private', 'shared'));
  END IF;
END
$$;

DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Authenticated users can view shared profiles'
  ) THEN
    CREATE POLICY "Authenticated users can view shared profiles"
      ON public.profiles FOR SELECT
      USING (
        auth.role() = 'authenticated'
        AND profile_visibility = 'shared'
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.can_view_live_status(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID;
  visibility_value TEXT;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN
    RETURN FALSE;
  END IF;

  IF caller = target_user_id THEN
    RETURN TRUE;
  END IF;

  SELECT p.live_status_visibility
  INTO visibility_value
  FROM public.profiles p
  WHERE p.user_id = target_user_id
  LIMIT 1;

  RETURN visibility_value = 'shared';
END;
$$;

DROP POLICY IF EXISTS "Authenticated users can view all statuses" ON public.current_status;
DROP POLICY IF EXISTS "Users can view allowed statuses" ON public.current_status;

CREATE POLICY "Users can view allowed statuses"
  ON public.current_status FOR SELECT
  USING (public.can_view_live_status(user_id));

ALTER TABLE public.liked_songs
  DROP COLUMN IF EXISTS "track_keyWorking";

CREATE OR REPLACE FUNCTION public.get_playlist_collaborators(
  target_playlist_id UUID
)
RETURNS TABLE (
  user_id UUID,
  role TEXT,
  display_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID;
  owner_id UUID;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.user_id
  INTO owner_id
  FROM public.playlists p
  WHERE p.id = target_playlist_id;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Playlist not found';
  END IF;

  IF owner_id <> caller AND NOT EXISTS (
    SELECT 1
    FROM public.playlist_collaborators pc
    WHERE pc.playlist_id = target_playlist_id
      AND pc.user_id = caller
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id AS user_id,
    'owner'::TEXT AS role,
    CASE
      WHEN p.user_id = caller OR COALESCE(pr.profile_visibility, 'private') = 'shared'
        THEN pr.display_name
      ELSE NULL
    END AS display_name,
    CASE
      WHEN p.user_id = caller OR COALESCE(pr.profile_visibility, 'private') = 'shared'
        THEN pr.avatar_url
      ELSE NULL
    END AS avatar_url
  FROM public.playlists p
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.id = target_playlist_id

  UNION ALL

  SELECT
    pc.user_id,
    pc.role,
    CASE
      WHEN pc.user_id = caller OR COALESCE(pr.profile_visibility, 'private') = 'shared'
        THEN pr.display_name
      ELSE NULL
    END AS display_name,
    CASE
      WHEN pc.user_id = caller OR COALESCE(pr.profile_visibility, 'private') = 'shared'
        THEN pr.avatar_url
      ELSE NULL
    END AS avatar_url
  FROM public.playlist_collaborators pc
  LEFT JOIN public.profiles pr ON pr.user_id = pc.user_id
  WHERE pc.playlist_id = target_playlist_id
  ORDER BY role DESC;
END;
$$;
