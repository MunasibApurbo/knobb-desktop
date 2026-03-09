-- Compatibility shim for the later realtime library migration typo.
-- This keeps fresh installs working without rewriting previously shipped migration history.

CREATE OR REPLACE FUNCTION public.track_identity(track JSONB)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(track->>'tidalId', ''),
    NULLIF(track->>'id', ''),
    md5(
      COALESCE(track->>'title', '') || '|' ||
      COALESCE(track->>'artist', '') || '|' ||
      COALESCE(track->>'album', '') || '|' ||
      COALESCE(track->>'duration', '')
    )
  );
$$;

ALTER TABLE public.liked_songs
  ADD COLUMN IF NOT EXISTS track_keyworking TEXT
  GENERATED ALWAYS AS (public.track_identity(track_data)) STORED;
