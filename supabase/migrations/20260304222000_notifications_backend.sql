-- Notifications backend: account-scoped inbox + playlist invite events.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications"
      ON public.notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications"
      ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can delete their own notifications'
  ) THEN
    CREATE POLICY "Users can delete their own notifications"
      ON public.notifications FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  target_user_id UUID,
  notification_type TEXT,
  notification_title TEXT,
  notification_body TEXT DEFAULT NULL,
  notification_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_id UUID;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    target_user_id,
    COALESCE(NULLIF(notification_type, ''), 'system'),
    COALESCE(NULLIF(notification_title, ''), 'Notification'),
    notification_body,
    COALESCE(notification_data, '{}'::jsonb)
  )
  RETURNING id INTO created_id;
  RETURN created_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_playlist_collaborator_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  playlist_name TEXT;
  inviter_name TEXT;
BEGIN
  SELECT p.name INTO playlist_name FROM public.playlists p WHERE p.id = NEW.playlist_id;

  SELECT COALESCE(pr.display_name, au.email, 'A collaborator')
    INTO inviter_name
  FROM auth.users au
  LEFT JOIN public.profiles pr ON pr.user_id = au.id
  WHERE au.id = NEW.invited_by;

  PERFORM public.enqueue_notification(
    NEW.user_id,
    'playlist_invite',
    'Playlist collaboration invite',
    COALESCE(inviter_name, 'A collaborator') || ' invited you to "' || COALESCE(playlist_name, 'playlist') || '".',
    jsonb_build_object(
      'playlist_id', NEW.playlist_id,
      'role', NEW.role,
      'invited_by', NEW.invited_by
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_playlist_collaborator_invite ON public.playlist_collaborators;
CREATE TRIGGER trg_notify_playlist_collaborator_invite
AFTER INSERT ON public.playlist_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.notify_playlist_collaborator_invite();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;
