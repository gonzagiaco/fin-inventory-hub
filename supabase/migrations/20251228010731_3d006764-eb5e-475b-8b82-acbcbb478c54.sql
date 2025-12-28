-- Create bucket for profile logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-logos', 'profile-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: authenticated users can upload to their own folder
CREATE POLICY "Users can upload their own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: anyone can view profile logos (public bucket)
CREATE POLICY "Anyone can view profile logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-logos');

-- Policy: users can update their own logos
CREATE POLICY "Users can update their own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: users can delete their own logos
CREATE POLICY "Users can delete their own logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);