-- Reset relaunch data while preserving the app schema, then harden
-- profile banner uploads with explicit storage constraints.

TRUNCATE TABLE
  public.client_events,
  public.current_status,
  public.favorite_artists,
  public.favorite_playlists,
  public.liked_songs,
  public.notifications,
  public.play_history,
  public.playback_sessions,
  public.playlist_collaborators,
  public.playlist_tracks,
  public.playlists,
  public.profiles,
  public.saved_albums
RESTART IDENTITY CASCADE;

DELETE FROM auth.users;

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'profile-covers';
