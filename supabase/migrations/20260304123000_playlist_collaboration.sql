-- Playlist collaboration + shared access controls.

-- ---------- Collaborators table ----------
CREATE TABLE IF NOT EXISTS public.playlist_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, user_id)
);

ALTER TABLE public.playlist_collaborators ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_playlist_collaborators_playlist
  ON public.playlist_collaborators(playlist_id);

CREATE INDEX IF NOT EXISTS idx_playlist_collaborators_user
  ON public.playlist_collaborators(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlist_collaborators' AND policyname = 'Owners and collaborators can view collaborator rows'
  ) THEN
    CREATE POLICY "Owners and collaborators can view collaborator rows"
      ON public.playlist_collaborators FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.playlists p
          WHERE p.id = playlist_collaborators.playlist_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlist_collaborators' AND policyname = 'Owners can add collaborators'
  ) THEN
    CREATE POLICY "Owners can add collaborators"
      ON public.playlist_collaborators FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.playlists p
          WHERE p.id = playlist_collaborators.playlist_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlist_collaborators' AND policyname = 'Owners can update collaborator roles'
  ) THEN
    CREATE POLICY "Owners can update collaborator roles"
      ON public.playlist_collaborators FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.playlists p
          WHERE p.id = playlist_collaborators.playlist_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlist_collaborators' AND policyname = 'Owners or self can remove collaborator rows'
  ) THEN
    CREATE POLICY "Owners or self can remove collaborator rows"
      ON public.playlist_collaborators FOR DELETE
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.playlists p
          WHERE p.id = playlist_collaborators.playlist_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ---------- Expand playlist access for collaborators ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlists' AND policyname = 'Collaborators can view shared playlists'
  ) THEN
    CREATE POLICY "Collaborators can view shared playlists"
      ON public.playlists FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.playlist_collaborators pc
          WHERE pc.playlist_id = playlists.id
            AND pc.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlists' AND policyname = 'Editors can update shared playlists'
  ) THEN
    CREATE POLICY "Editors can update shared playlists"
      ON public.playlists FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.playlist_collaborators pc
          WHERE pc.playlist_id = playlists.id
            AND pc.user_id = auth.uid()
            AND pc.role = 'editor'
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlist_tracks' AND policyname = 'Collaborators can view tracks in shared playlists'
  ) THEN
    CREATE POLICY "Collaborators can view tracks in shared playlists"
      ON public.playlist_tracks FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.playlist_collaborators pc
          WHERE pc.playlist_id = playlist_tracks.playlist_id
            AND pc.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlist_tracks' AND policyname = 'Editors can add tracks to shared playlists'
  ) THEN
    CREATE POLICY "Editors can add tracks to shared playlists"
      ON public.playlist_tracks FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.playlist_collaborators pc
          WHERE pc.playlist_id = playlist_tracks.playlist_id
            AND pc.user_id = auth.uid()
            AND pc.role = 'editor'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlist_tracks' AND policyname = 'Editors can update tracks in shared playlists'
  ) THEN
    CREATE POLICY "Editors can update tracks in shared playlists"
      ON public.playlist_tracks FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.playlist_collaborators pc
          WHERE pc.playlist_id = playlist_tracks.playlist_id
            AND pc.user_id = auth.uid()
            AND pc.role = 'editor'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlist_tracks' AND policyname = 'Editors can delete tracks in shared playlists'
  ) THEN
    CREATE POLICY "Editors can delete tracks in shared playlists"
      ON public.playlist_tracks FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.playlist_collaborators pc
          WHERE pc.playlist_id = playlist_tracks.playlist_id
            AND pc.user_id = auth.uid()
            AND pc.role = 'editor'
        )
      );
  END IF;
END
$$;

-- ---------- RPC: Invite collaborator by email ----------
CREATE OR REPLACE FUNCTION public.invite_playlist_collaborator(
  target_playlist_id UUID,
  target_email TEXT,
  target_role TEXT DEFAULT 'viewer'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID;
  owner_id UUID;
  invitee UUID;
  normalized_role TEXT;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  normalized_role := lower(trim(target_role));
  IF normalized_role NOT IN ('viewer', 'editor') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT p.user_id
  INTO owner_id
  FROM public.playlists p
  WHERE p.id = target_playlist_id;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Playlist not found';
  END IF;

  IF owner_id <> caller THEN
    RAISE EXCEPTION 'Only playlist owner can invite collaborators';
  END IF;

  SELECT u.id
  INTO invitee
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(target_email))
  LIMIT 1;

  IF invitee IS NULL THEN
    RAISE EXCEPTION 'No account found for email %', target_email;
  END IF;

  IF invitee = owner_id THEN
    RAISE EXCEPTION 'Owner cannot be invited as collaborator';
  END IF;

  INSERT INTO public.playlist_collaborators (playlist_id, user_id, role, invited_by)
  VALUES (target_playlist_id, invitee, normalized_role, caller)
  ON CONFLICT (playlist_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    invited_by = EXCLUDED.invited_by;

  RETURN invitee;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_playlist_collaborator(UUID, TEXT, TEXT) TO authenticated;

-- ---------- RPC: List collaborators with profile context ----------
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
    pr.display_name,
    pr.avatar_url
  FROM public.playlists p
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.id = target_playlist_id

  UNION ALL

  SELECT
    pc.user_id,
    pc.role,
    pr.display_name,
    pr.avatar_url
  FROM public.playlist_collaborators pc
  LEFT JOIN public.profiles pr ON pr.user_id = pc.user_id
  WHERE pc.playlist_id = target_playlist_id
  ORDER BY role DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_playlist_collaborators(UUID) TO authenticated;

-- ---------- Realtime publication ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_collaborators;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;
