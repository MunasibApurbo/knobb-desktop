-- Break recursive RLS dependencies between playlists and playlist collaborators.

CREATE OR REPLACE FUNCTION public.is_playlist_owner(
  target_playlist_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.playlists p
      WHERE p.id = target_playlist_id
        AND p.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_playlist_collaborator(
  target_playlist_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.playlist_collaborators pc
      WHERE pc.playlist_id = target_playlist_id
        AND pc.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_playlist_editor(
  target_playlist_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.playlist_collaborators pc
      WHERE pc.playlist_id = target_playlist_id
        AND pc.user_id = auth.uid()
        AND pc.role = 'editor'
    );
$$;

REVOKE ALL ON FUNCTION public.is_playlist_owner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_playlist_collaborator(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_playlist_editor(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_playlist_owner(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_playlist_collaborator(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_playlist_editor(UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "Owners and collaborators can view collaborator rows" ON public.playlist_collaborators;
CREATE POLICY "Owners and collaborators can view collaborator rows"
  ON public.playlist_collaborators FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_playlist_owner(playlist_collaborators.playlist_id)
  );

DROP POLICY IF EXISTS "Owners can add collaborators" ON public.playlist_collaborators;
CREATE POLICY "Owners can add collaborators"
  ON public.playlist_collaborators FOR INSERT
  WITH CHECK (public.is_playlist_owner(playlist_collaborators.playlist_id));

DROP POLICY IF EXISTS "Owners can update collaborator roles" ON public.playlist_collaborators;
CREATE POLICY "Owners can update collaborator roles"
  ON public.playlist_collaborators FOR UPDATE
  USING (public.is_playlist_owner(playlist_collaborators.playlist_id))
  WITH CHECK (public.is_playlist_owner(playlist_collaborators.playlist_id));

DROP POLICY IF EXISTS "Owners or self can remove collaborator rows" ON public.playlist_collaborators;
CREATE POLICY "Owners or self can remove collaborator rows"
  ON public.playlist_collaborators FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_playlist_owner(playlist_collaborators.playlist_id)
  );

DROP POLICY IF EXISTS "Collaborators can view shared playlists" ON public.playlists;
CREATE POLICY "Collaborators can view shared playlists"
  ON public.playlists FOR SELECT
  USING (public.is_playlist_collaborator(playlists.id));

DROP POLICY IF EXISTS "Editors can update shared playlists" ON public.playlists;
CREATE POLICY "Editors can update shared playlists"
  ON public.playlists FOR UPDATE
  USING (public.is_playlist_editor(playlists.id))
  WITH CHECK (public.is_playlist_editor(playlists.id));

DROP POLICY IF EXISTS "Users can view tracks in their playlists" ON public.playlist_tracks;
CREATE POLICY "Users can view tracks in their playlists"
  ON public.playlist_tracks FOR SELECT
  USING (public.is_playlist_owner(playlist_tracks.playlist_id));

DROP POLICY IF EXISTS "Users can add tracks to their playlists" ON public.playlist_tracks;
CREATE POLICY "Users can add tracks to their playlists"
  ON public.playlist_tracks FOR INSERT
  WITH CHECK (public.is_playlist_owner(playlist_tracks.playlist_id));

DROP POLICY IF EXISTS "Users can update tracks in their playlists" ON public.playlist_tracks;
CREATE POLICY "Users can update tracks in their playlists"
  ON public.playlist_tracks FOR UPDATE
  USING (public.is_playlist_owner(playlist_tracks.playlist_id))
  WITH CHECK (public.is_playlist_owner(playlist_tracks.playlist_id));

DROP POLICY IF EXISTS "Users can delete tracks from their playlists" ON public.playlist_tracks;
CREATE POLICY "Users can delete tracks from their playlists"
  ON public.playlist_tracks FOR DELETE
  USING (public.is_playlist_owner(playlist_tracks.playlist_id));

DROP POLICY IF EXISTS "Collaborators can view tracks in shared playlists" ON public.playlist_tracks;
CREATE POLICY "Collaborators can view tracks in shared playlists"
  ON public.playlist_tracks FOR SELECT
  USING (public.is_playlist_collaborator(playlist_tracks.playlist_id));

DROP POLICY IF EXISTS "Editors can add tracks to shared playlists" ON public.playlist_tracks;
CREATE POLICY "Editors can add tracks to shared playlists"
  ON public.playlist_tracks FOR INSERT
  WITH CHECK (public.is_playlist_editor(playlist_tracks.playlist_id));

DROP POLICY IF EXISTS "Editors can update tracks in shared playlists" ON public.playlist_tracks;
CREATE POLICY "Editors can update tracks in shared playlists"
  ON public.playlist_tracks FOR UPDATE
  USING (public.is_playlist_editor(playlist_tracks.playlist_id))
  WITH CHECK (public.is_playlist_editor(playlist_tracks.playlist_id));

DROP POLICY IF EXISTS "Editors can delete tracks in shared playlists" ON public.playlist_tracks;
CREATE POLICY "Editors can delete tracks in shared playlists"
  ON public.playlist_tracks FOR DELETE
  USING (public.is_playlist_editor(playlist_tracks.playlist_id));
