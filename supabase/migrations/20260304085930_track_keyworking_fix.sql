-- Fix casing mismatch from the compatibility shim so the later legacy migration can reference the column.

ALTER TABLE public.liked_songs
  ADD COLUMN IF NOT EXISTS track_keyworking TEXT
  GENERATED ALWAYS AS (public.track_identity(track_data)) STORED;

ALTER TABLE public.liked_songs
  DROP COLUMN IF EXISTS "track_keyWorking";
