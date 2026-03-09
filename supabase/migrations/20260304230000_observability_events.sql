-- Basic observability events table for client-side telemetry and errors.

CREATE TABLE IF NOT EXISTS public.client_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info',
  event_name TEXT NOT NULL,
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_events_created_at
  ON public.client_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_events_user_created
  ON public.client_events(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_events_level_check'
      AND conrelid = 'public.client_events'::regclass
  ) THEN
    ALTER TABLE public.client_events
      ADD CONSTRAINT client_events_level_check
      CHECK (level IN ('info', 'warn', 'error'));
  END IF;
END
$$;

ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_events' AND policyname = 'Users can view their own client events'
  ) THEN
    CREATE POLICY "Users can view their own client events"
      ON public.client_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.log_client_event(
  level_input TEXT,
  event_name_input TEXT,
  message_input TEXT DEFAULT NULL,
  payload_input JSONB DEFAULT '{}'::jsonb,
  source_input TEXT DEFAULT 'web'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
  created_id UUID;
  normalized_level TEXT;
BEGIN
  uid := auth.uid();
  normalized_level := LOWER(COALESCE(NULLIF(BTRIM(level_input), ''), 'info'));
  IF normalized_level NOT IN ('info', 'warn', 'error') THEN
    normalized_level := 'info';
  END IF;

  INSERT INTO public.client_events (
    user_id,
    level,
    event_name,
    message,
    payload,
    source
  )
  VALUES (
    uid,
    normalized_level,
    COALESCE(NULLIF(BTRIM(event_name_input), ''), 'unknown_event'),
    NULLIF(BTRIM(message_input), ''),
    COALESCE(payload_input, '{}'::jsonb),
    COALESCE(NULLIF(BTRIM(source_input), ''), 'web')
  )
  RETURNING id INTO created_id;

  RETURN created_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_client_event(TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;
