-- Ensure liked songs table exists with RLS.
CREATE TABLE IF NOT EXISTS public.liked_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_data JSONB NOT NULL,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_liked_songs_user ON public.liked_songs(user_id, liked_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_liked_songs_user_track_id
  ON public.liked_songs(user_id, (track_data->>'id'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'liked_songs' AND policyname = 'Users can view their liked songs'
  ) THEN
    CREATE POLICY "Users can view their liked songs"
      ON public.liked_songs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'liked_songs' AND policyname = 'Users can insert their liked songs'
  ) THEN
    CREATE POLICY "Users can insert their liked songs"
      ON public.liked_songs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'liked_songs' AND policyname = 'Users can delete their liked songs'
  ) THEN
    CREATE POLICY "Users can delete their liked songs"
      ON public.liked_songs FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Favorite artists table for follow/favorite flow.
CREATE TABLE IF NOT EXISTS public.favorite_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id BIGINT NOT NULL,
  artist_name TEXT NOT NULL,
  artist_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, artist_id)
);

ALTER TABLE public.favorite_artists ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_favorite_artists_user ON public.favorite_artists(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favorite_artists' AND policyname = 'Users can view their favorite artists'
  ) THEN
    CREATE POLICY "Users can view their favorite artists"
      ON public.favorite_artists FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favorite_artists' AND policyname = 'Users can insert their favorite artists'
  ) THEN
    CREATE POLICY "Users can insert their favorite artists"
      ON public.favorite_artists FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favorite_artists' AND policyname = 'Users can delete their favorite artists'
  ) THEN
    CREATE POLICY "Users can delete their favorite artists"
      ON public.favorite_artists FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;
