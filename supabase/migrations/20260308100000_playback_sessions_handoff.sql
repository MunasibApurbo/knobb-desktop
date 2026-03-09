CREATE TABLE IF NOT EXISTS public.playback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  current_track_data JSONB,
  queue_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_time DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration DOUBLE PRECISION NOT NULL DEFAULT 0,
  quality TEXT NOT NULL DEFAULT 'HIGH',
  is_playing BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT playback_sessions_quality_check CHECK (quality IN ('LOW', 'MEDIUM', 'HIGH', 'LOSSLESS', 'MAX')),
  CONSTRAINT playback_sessions_user_device_unique UNIQUE (user_id, device_id)
);

ALTER TABLE public.playback_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playback_sessions' AND policyname = 'Users can view their own playback sessions'
  ) THEN
    CREATE POLICY "Users can view their own playback sessions"
      ON public.playback_sessions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playback_sessions' AND policyname = 'Users can insert their own playback sessions'
  ) THEN
    CREATE POLICY "Users can insert their own playback sessions"
      ON public.playback_sessions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playback_sessions' AND policyname = 'Users can update their own playback sessions'
  ) THEN
    CREATE POLICY "Users can update their own playback sessions"
      ON public.playback_sessions FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playback_sessions' AND policyname = 'Users can delete their own playback sessions'
  ) THEN
    CREATE POLICY "Users can delete their own playback sessions"
      ON public.playback_sessions FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_playback_sessions_updated_at ON public.playback_sessions;
CREATE TRIGGER update_playback_sessions_updated_at
  BEFORE UPDATE ON public.playback_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_playback_sessions_user_last_seen
  ON public.playback_sessions(user_id, last_seen_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.playback_sessions;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;
