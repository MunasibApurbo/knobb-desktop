-- Preserve account/library data while hardening profile banner uploads with
-- explicit storage constraints. The earlier relaunch reset behavior here was
-- destructive: it truncated every account-scoped table and deleted auth users,
-- which makes existing accounts appear "signed in but empty". Keep this
-- migration non-destructive so deploys do not wipe user data.

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'profile-covers';
