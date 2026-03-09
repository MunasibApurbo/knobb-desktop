INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-covers', 'profile-covers', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Profile covers are publicly readable'
  ) THEN
    CREATE POLICY "Profile covers are publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'profile-covers');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload their own profile covers'
  ) THEN
    CREATE POLICY "Users can upload their own profile covers"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'profile-covers'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update their own profile covers'
  ) THEN
    CREATE POLICY "Users can update their own profile covers"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'profile-covers'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'profile-covers'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete their own profile covers'
  ) THEN
    CREATE POLICY "Users can delete their own profile covers"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'profile-covers'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END
$$;
