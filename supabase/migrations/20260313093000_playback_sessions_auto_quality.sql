ALTER TABLE public.playback_sessions
DROP CONSTRAINT IF EXISTS playback_sessions_quality_check;

ALTER TABLE public.playback_sessions
ADD CONSTRAINT playback_sessions_quality_check
CHECK (quality IN ('AUTO', 'LOW', 'MEDIUM', 'HIGH', 'LOSSLESS', 'MAX'));
