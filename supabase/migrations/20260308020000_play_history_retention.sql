CREATE OR REPLACE FUNCTION public.prune_play_history_to_last_month()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.play_history
  WHERE user_id = NEW.user_id
    AND played_at < now() - INTERVAL '1 month';

  RETURN NEW;
END;
$$;

DELETE FROM public.play_history
WHERE played_at < now() - INTERVAL '1 month';

DROP TRIGGER IF EXISTS prune_play_history_to_last_month_trigger ON public.play_history;

CREATE TRIGGER prune_play_history_to_last_month_trigger
AFTER INSERT ON public.play_history
FOR EACH ROW
EXECUTE FUNCTION public.prune_play_history_to_last_month();
