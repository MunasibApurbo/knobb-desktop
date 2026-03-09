-- Phase 4: Listening intelligence pipeline.
-- Canonicalizes play events and records normalized listening telemetry.

ALTER TABLE public.play_history
  ADD COLUMN IF NOT EXISTS track_key TEXT,
  ADD COLUMN IF NOT EXISTS listened_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'progress',
  ADD COLUMN IF NOT EXISTS context_type TEXT,
  ADD COLUMN IF NOT EXISTS context_id TEXT;

-- Backfill duration/listened/track keys for legacy rows.
UPDATE public.play_history
SET
  duration_seconds = CASE
    WHEN COALESCE(track_data ->> 'duration', '') ~ '^[0-9]+$'
      THEN GREATEST(0, (track_data ->> 'duration')::INTEGER)
    ELSE 0
  END
WHERE COALESCE(duration_seconds, 0) = 0;

UPDATE public.play_history
SET
  listened_seconds = CASE
    WHEN COALESCE(track_data ->> 'listenedSeconds', '') ~ '^[0-9]+$'
      THEN GREATEST(0, (track_data ->> 'listenedSeconds')::INTEGER)
    WHEN duration_seconds > 0
      THEN LEAST(30, duration_seconds)
    ELSE 30
  END
WHERE COALESCE(listened_seconds, 0) = 0;

UPDATE public.play_history
SET
  listened_seconds = LEAST(
    GREATEST(COALESCE(listened_seconds, 0), 0),
    CASE
      WHEN COALESCE(duration_seconds, 0) > 0 THEN duration_seconds
      ELSE GREATEST(COALESCE(listened_seconds, 0), 0)
    END
  );

UPDATE public.play_history
SET
  track_key = CASE
    WHEN COALESCE(track_data ->> 'tidalId', '') ~ '^[0-9]+$'
      THEN 'tidal:' || (track_data ->> 'tidalId')
    WHEN NULLIF(BTRIM(COALESCE(track_data ->> 'id', '')), '') IS NOT NULL
      THEN 'id:' || LOWER(BTRIM(track_data ->> 'id'))
    ELSE
      'fallback:' ||
      LOWER(BTRIM(COALESCE(track_data ->> 'title', 'unknown'))) || '::' ||
      LOWER(BTRIM(COALESCE(track_data ->> 'artist', 'unknown')))
  END
WHERE track_key IS NULL OR BTRIM(track_key) = '';

UPDATE public.play_history
SET
  event_type = CASE
    WHEN listened_seconds >= (
      CASE
        WHEN duration_seconds > 0
          THEN LEAST(duration_seconds, GREATEST(30, CEIL(duration_seconds * 0.5)::INTEGER))
        ELSE 30
      END
    ) THEN 'complete'
    WHEN listened_seconds <= 5 THEN 'skip'
    ELSE 'progress'
  END
WHERE event_type IS NULL
   OR event_type NOT IN ('start', 'progress', 'complete', 'skip', 'repeat');

ALTER TABLE public.play_history
  ALTER COLUMN track_key SET NOT NULL,
  ALTER COLUMN listened_seconds SET NOT NULL,
  ALTER COLUMN duration_seconds SET NOT NULL,
  ALTER COLUMN event_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'play_history_event_type_check'
      AND conrelid = 'public.play_history'::regclass
  ) THEN
    ALTER TABLE public.play_history
      ADD CONSTRAINT play_history_event_type_check
      CHECK (event_type IN ('start', 'progress', 'complete', 'skip', 'repeat'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_play_history_user_track_key_played
  ON public.play_history(user_id, track_key, played_at DESC);

CREATE INDEX IF NOT EXISTS idx_play_history_user_event_played
  ON public.play_history(user_id, event_type, played_at DESC);

-- Canonical ingestion endpoint for play events.
CREATE OR REPLACE FUNCTION public.record_play_event(
  target_track_data JSONB,
  listened_seconds_input INTEGER DEFAULT NULL,
  scrobble_percent_input INTEGER DEFAULT 50,
  context_type_input TEXT DEFAULT NULL,
  context_id_input TEXT DEFAULT NULL
)
RETURNS TABLE (
  event_id UUID,
  event_type TEXT,
  inserted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
  normalized_duration INTEGER;
  normalized_listened INTEGER;
  scrobble_percent INTEGER;
  threshold_seconds INTEGER;
  computed_track_key TEXT;
  computed_event_type TEXT;
  last_event public.play_history%ROWTYPE;
  elapsed_seconds DOUBLE PRECISION;
  merged_track_data JSONB;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_track_data IS NULL THEN
    RAISE EXCEPTION 'Track payload is required';
  END IF;

  normalized_duration := CASE
    WHEN COALESCE(target_track_data ->> 'duration', '') ~ '^[0-9]+$'
      THEN GREATEST(0, (target_track_data ->> 'duration')::INTEGER)
    ELSE 0
  END;

  normalized_listened := COALESCE(
    listened_seconds_input,
    CASE
      WHEN COALESCE(target_track_data ->> 'listenedSeconds', '') ~ '^[0-9]+$'
        THEN (target_track_data ->> 'listenedSeconds')::INTEGER
      WHEN normalized_duration > 0
        THEN LEAST(30, normalized_duration)
      ELSE 30
    END
  );

  normalized_listened := GREATEST(0, normalized_listened);
  IF normalized_duration > 0 THEN
    normalized_listened := LEAST(normalized_listened, normalized_duration);
  END IF;

  scrobble_percent := LEAST(95, GREATEST(5, COALESCE(scrobble_percent_input, 50)));
  threshold_seconds := CASE
    WHEN normalized_duration > 0
      THEN LEAST(
        normalized_duration,
        GREATEST(30, CEIL(normalized_duration * (scrobble_percent / 100.0))::INTEGER)
      )
    ELSE 30
  END;

  computed_track_key := CASE
    WHEN COALESCE(target_track_data ->> 'tidalId', '') ~ '^[0-9]+$'
      THEN 'tidal:' || (target_track_data ->> 'tidalId')
    WHEN NULLIF(BTRIM(COALESCE(target_track_data ->> 'id', '')), '') IS NOT NULL
      THEN 'id:' || LOWER(BTRIM(target_track_data ->> 'id'))
    ELSE
      'fallback:' ||
      LOWER(BTRIM(COALESCE(target_track_data ->> 'title', 'unknown'))) || '::' ||
      LOWER(BTRIM(COALESCE(target_track_data ->> 'artist', 'unknown')))
  END;

  IF normalized_listened >= threshold_seconds THEN
    computed_event_type := 'complete';
  ELSIF normalized_listened <= 5 THEN
    computed_event_type := 'skip';
  ELSE
    computed_event_type := 'progress';
  END IF;

  SELECT *
  INTO last_event
  FROM public.play_history ph
  WHERE ph.user_id = uid
    AND ph.track_key = computed_track_key
  ORDER BY ph.played_at DESC
  LIMIT 1;

  IF FOUND THEN
    elapsed_seconds := EXTRACT(EPOCH FROM (now() - last_event.played_at));

    -- Prevent duplicate writes from near-simultaneous flush paths.
    IF elapsed_seconds <= 8
       AND ABS(COALESCE(last_event.listened_seconds, 0) - normalized_listened) <= 2 THEN
      RETURN QUERY SELECT last_event.id, last_event.event_type, FALSE;
      RETURN;
    END IF;

    -- Consecutive complete listens are treated as repeats.
    IF computed_event_type = 'complete'
       AND last_event.event_type IN ('complete', 'repeat')
       AND elapsed_seconds <= 86400 THEN
      computed_event_type := 'repeat';
    END IF;
  END IF;

  merged_track_data := COALESCE(target_track_data, '{}'::JSONB) ||
    jsonb_build_object(
      'listenedSeconds', normalized_listened,
      'eventType', computed_event_type
    );

  INSERT INTO public.play_history (
    user_id,
    track_data,
    track_key,
    listened_seconds,
    duration_seconds,
    event_type,
    context_type,
    context_id
  )
  VALUES (
    uid,
    merged_track_data,
    computed_track_key,
    normalized_listened,
    normalized_duration,
    computed_event_type,
    context_type_input,
    context_id_input
  )
  RETURNING id INTO event_id;

  event_type := computed_event_type;
  inserted := TRUE;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_play_event(JSONB, INTEGER, INTEGER, TEXT, TEXT) TO authenticated;
