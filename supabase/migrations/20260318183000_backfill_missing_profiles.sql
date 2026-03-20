-- Recreate missing profile rows for existing auth users without touching any
-- account-scoped library data.

INSERT INTO public.profiles (user_id, display_name)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1))
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL;
