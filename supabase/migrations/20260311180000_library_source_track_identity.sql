CREATE OR REPLACE FUNCTION public.track_identity(track JSONB)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(
    CASE
      WHEN COALESCE(track->>'source', '') <> '' AND COALESCE(track->>'sourceId', '') <> '' THEN
        lower(track->>'source') || ':' || lower(track->>'sourceId')
      ELSE
        NULL
    END,
    CASE
      WHEN COALESCE(track->>'tidalId', '') <> '' THEN
        'tidal:' || lower(track->>'tidalId')
      ELSE
        NULL
    END,
    CASE
      WHEN COALESCE(track->>'id', '') <> '' THEN
        'id:' || lower(track->>'id')
      ELSE
        NULL
    END,
    md5(
      COALESCE(track->>'title', '') || '|' ||
      COALESCE(track->>'artist', '') || '|' ||
      COALESCE(track->>'album', '') || '|' ||
      COALESCE(track->>'duration', '')
    )
  );
$$;

UPDATE public.liked_songs
SET track_key = public.track_identity(track_data)
WHERE track_key IS DISTINCT FROM public.track_identity(track_data);

UPDATE public.playlist_tracks
SET track_key = public.track_identity(track_data)
WHERE track_key IS DISTINCT FROM public.track_identity(track_data);

UPDATE public.play_history
SET track_key = public.track_identity(track_data)
WHERE track_key IS DISTINCT FROM public.track_identity(track_data);
