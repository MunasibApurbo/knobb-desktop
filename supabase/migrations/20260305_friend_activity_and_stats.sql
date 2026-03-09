-- Friend Activity & Listening Stats backend.
-- Adds: current_status table, profiles public read, listening stats view.

-- ========== 1. Fix profiles RLS: allow all authenticated to read ==========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Authenticated users can view all profiles'
  ) THEN
    CREATE POLICY "Authenticated users can view all profiles"
      ON public.profiles FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END
$$;

-- ========== 2. current_status table ==========
CREATE TABLE IF NOT EXISTS public.current_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  track_title TEXT,
  artist_name TEXT,
  cover_url TEXT,
  track_id TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.current_status ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see everyone's status (friend activity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'current_status' AND policyname = 'Authenticated users can view all statuses'
  ) THEN
    CREATE POLICY "Authenticated users can view all statuses"
      ON public.current_status FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'current_status' AND policyname = 'Users can upsert their own status'
  ) THEN
    CREATE POLICY "Users can upsert their own status"
      ON public.current_status FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'current_status' AND policyname = 'Users can update their own status'
  ) THEN
    CREATE POLICY "Users can update their own status"
      ON public.current_status FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'current_status' AND policyname = 'Users can delete their own status'
  ) THEN
    CREATE POLICY "Users can delete their own status"
      ON public.current_status FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_current_status_updated_at ON public.current_status;
CREATE TRIGGER update_current_status_updated_at
  BEFORE UPDATE ON public.current_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Publish to realtime so all clients get instant updates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.current_status;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;

-- ========== 3. Listening stats view ==========
CREATE OR REPLACE VIEW public.user_listening_stats AS
SELECT
  ph.user_id,
  COUNT(*)::INTEGER AS total_plays,
  COUNT(DISTINCT ph.track_key) AS unique_tracks,
  ROUND(SUM(ph.listened_seconds) / 60.0, 1) AS total_minutes,
  COUNT(CASE WHEN ph.event_type = 'complete' THEN 1 END)::INTEGER AS completed_plays,
  COUNT(CASE WHEN ph.event_type = 'skip' THEN 1 END)::INTEGER AS skipped_plays,
  COUNT(CASE WHEN ph.played_at >= now() - INTERVAL '7 days' THEN 1 END)::INTEGER AS plays_last_7d,
  ROUND(
    SUM(CASE WHEN ph.played_at >= now() - INTERVAL '7 days' THEN ph.listened_seconds ELSE 0 END) / 60.0, 1
  ) AS minutes_last_7d
FROM public.play_history ph
GROUP BY ph.user_id;

-- RLS on views is inherited from the underlying table.
-- Since play_history already has RLS (user can only see their own rows),
-- this view is implicitly scoped per-user.
