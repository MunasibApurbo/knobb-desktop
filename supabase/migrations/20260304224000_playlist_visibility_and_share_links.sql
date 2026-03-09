-- Playlist visibility and share-link model.

ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();

UPDATE public.playlists
SET share_token = gen_random_uuid()
WHERE share_token IS NULL;

ALTER TABLE public.playlists
  ALTER COLUMN share_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'playlists_visibility_check'
      AND conrelid = 'public.playlists'::regclass
  ) THEN
    ALTER TABLE public.playlists
      ADD CONSTRAINT playlists_visibility_check
      CHECK (visibility IN ('private', 'shared', 'public'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_share_token
  ON public.playlists(share_token);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlists' AND policyname = 'Public playlists can be viewed by everyone'
  ) THEN
    CREATE POLICY "Public playlists can be viewed by everyone"
      ON public.playlists FOR SELECT
      USING (visibility = 'public');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_shared_playlist_by_token(target_token UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_id UUID,
  visibility TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID;
BEGIN
  caller := auth.uid();

  RETURN QUERY
  SELECT p.id, p.name, p.description, p.cover_url, p.created_at, p.updated_at, p.user_id, p.visibility
  FROM public.playlists p
  WHERE p.share_token = target_token
    AND (
      p.visibility = 'public'
      OR (p.visibility = 'shared' AND caller IS NOT NULL)
      OR p.user_id = caller
      OR EXISTS (
        SELECT 1 FROM public.playlist_collaborators pc
        WHERE pc.playlist_id = p.id
          AND pc.user_id = caller
      )
    )
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_playlist_by_token(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_playlist_tracks_by_token(target_token UUID)
RETURNS TABLE (
  "position" INTEGER,
  track_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  playlist_id_value UUID;
BEGIN
  SELECT s.id INTO playlist_id_value
  FROM public.get_shared_playlist_by_token(target_token) s
  LIMIT 1;

  IF playlist_id_value IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pt.position, pt.track_data
  FROM public.playlist_tracks pt
  WHERE pt.playlist_id = playlist_id_value
  ORDER BY pt.position ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_playlist_tracks_by_token(UUID) TO anon, authenticated;
