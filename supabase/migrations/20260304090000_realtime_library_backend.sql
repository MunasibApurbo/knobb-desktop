-- Account-linked library persistence and realtime-ready schema upgrades.

-- ---------- Saved albums ----------
CREATE TABLE IF NOT EXISTS public.saved_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id BIGINT NOT NULL,
  album_title TEXT NOT NULL,
  album_artist TEXT NOT NULL,
  album_cover_url TEXT,
  album_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, album_id)
);

ALTER TABLE public.saved_albums ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saved_albums_user_created
  ON public.saved_albums(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_albums' AND policyname = 'Users can view their saved albums'
  ) THEN
    CREATE POLICY "Users can view their saved albums"
      ON public.saved_albums FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_albums' AND policyname = 'Users can insert their saved albums'
  ) THEN
    CREATE POLICY "Users can insert their saved albums"
      ON public.saved_albums FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_albums' AND policyname = 'Users can update their saved albums'
  ) THEN
    CREATE POLICY "Users can update their saved albums"
      ON public.saved_albums FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_albums' AND policyname = 'Users can delete their saved albums'
  ) THEN
    CREATE POLICY "Users can delete their saved albums"
      ON public.saved_albums FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- ---------- Favorite playlists ----------
CREATE TABLE IF NOT EXISTS public.favorite_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'tidal',
  playlist_id TEXT NOT NULL,
  playlist_title TEXT NOT NULL,
  playlist_cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, playlist_id)
);

ALTER TABLE public.favorite_playlists ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_favorite_playlists_user_created
  ON public.favorite_playlists(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favorite_playlists' AND policyname = 'Users can view their favorite playlists'
  ) THEN
    CREATE POLICY "Users can view their favorite playlists"
      ON public.favorite_playlists FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favorite_playlists' AND policyname = 'Users can insert their favorite playlists'
  ) THEN
    CREATE POLICY "Users can insert their favorite playlists"
      ON public.favorite_playlists FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favorite_playlists' AND policyname = 'Users can delete their favorite playlists'
  ) THEN
    CREATE POLICY "Users can delete their favorite playlists"
      ON public.favorite_playlists FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- ---------- Stable track identity ----------
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

-- ---------- liked_songs de-dup + key ----------
ALTER TABLE public.liked_songs
  ADD COLUMN IF NOT EXISTS track_key TEXT;

UPDATE public.liked_songs
SET track_key = public.track_identity(track_data)
WHERE track_key IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, track_keyWorking
      
      ORDER BY liked_at DESC, id DESC
    ) AS rn
  FROM public.liked_songs
)
DELETE FROM public.liked_songs ls
USING ranked r
WHERE ls.id = r.id
  AND r.rn > 1;

ALTER TABLE public.liked_songs
  ALTER COLUMN track_key SET NOT NULL;

DROP INDEX IF EXISTS idx_liked_songs_user_track_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_liked_songs_user_track_key
  ON public.liked_songs(user_id, track_key);

-- ---------- playlist_tracks de-dup + key ----------
ALTER TABLE public.playlist_tracks
  ADD COLUMN IF NOT EXISTS track_key TEXT;

UPDATE public.playlist_tracks
SET track_key = public.track_identity(track_data)
WHERE track_key IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY playlist_id, track_key
      ORDER BY position ASC, added_at ASC, id ASC
    ) AS rn
  FROM public.playlist_tracks
)
DELETE FROM public.playlist_tracks pt
USING ranked r
WHERE pt.id = r.id
  AND r.rn > 1;

WITH reindexed AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY playlist_id
      ORDER BY position ASC, added_at ASC, id ASC
    ) - 1 AS new_position
  FROM public.playlist_tracks
)
UPDATE public.playlist_tracks pt
SET position = r.new_position
FROM reindexed r
WHERE pt.id = r.id
  AND pt.position IS DISTINCT FROM r.new_position;

ALTER TABLE public.playlist_tracks
  ALTER COLUMN track_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_track_key
  ON public.playlist_tracks(playlist_id, track_key);

-- ---------- Realtime publication ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_tracks;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.liked_songs;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_albums;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.favorite_artists;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.favorite_playlists;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;
