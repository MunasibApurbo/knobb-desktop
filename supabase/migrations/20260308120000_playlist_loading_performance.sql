-- Reduce playlist bootstrap cost by returning summaries first and tracks on demand.

CREATE OR REPLACE FUNCTION public.get_user_playlist_summaries()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ,
  user_id UUID,
  visibility TEXT,
  share_token UUID,
  access_role TEXT,
  track_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH accessible_playlists AS (
    SELECT
      p.id,
      'owner'::TEXT AS access_role
    FROM public.playlists p
    WHERE p.user_id = auth.uid()

    UNION ALL

    SELECT
      pc.playlist_id AS id,
      CASE
        WHEN pc.role = 'editor' THEN 'editor'
        ELSE 'viewer'
      END AS access_role
    FROM public.playlist_collaborators pc
    WHERE pc.user_id = auth.uid()
  ),
  deduped_access AS (
    SELECT DISTINCT ON (ap.id)
      ap.id,
      ap.access_role
    FROM accessible_playlists ap
    ORDER BY
      ap.id,
      CASE ap.access_role
        WHEN 'owner' THEN 0
        WHEN 'editor' THEN 1
        ELSE 2
      END
  )
  SELECT
    p.id,
    p.name,
    COALESCE(p.description, '') AS description,
    p.cover_url,
    p.created_at,
    p.user_id,
    COALESCE(p.visibility, 'private') AS visibility,
    p.share_token,
    da.access_role,
    COALESCE(COUNT(pt.id), 0)::INTEGER AS track_count
  FROM deduped_access da
  JOIN public.playlists p
    ON p.id = da.id
  LEFT JOIN public.playlist_tracks pt
    ON pt.playlist_id = p.id
  GROUP BY
    p.id,
    p.name,
    p.description,
    p.cover_url,
    p.created_at,
    p.user_id,
    p.visibility,
    p.share_token,
    da.access_role
  ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_playlist_tracks(target_playlist_id UUID)
RETURNS TABLE (
  "position" INTEGER,
  added_at TIMESTAMPTZ,
  track_data JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    pt.position AS "position",
    pt.added_at,
    pt.track_data
  FROM public.playlist_tracks pt
  WHERE pt.playlist_id = target_playlist_id
    AND (
      public.is_playlist_owner(target_playlist_id)
      OR public.is_playlist_collaborator(target_playlist_id)
    )
  ORDER BY pt.position ASC;
$$;

REVOKE ALL ON FUNCTION public.get_user_playlist_summaries() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_playlist_tracks(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_user_playlist_summaries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_playlist_tracks(UUID) TO authenticated;
