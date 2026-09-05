-- 1. Create the storage bucket for avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, '{image/jpeg,image/png,image/webp,image/gif}')
ON CONFLICT (id) DO NOTHING;

-- 2. Create policy to allow public access to avatars
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

-- 3. Create policy to allow authenticated users to upload avatars
CREATE POLICY "Auth Upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- 4. Create policy to allow authenticated users to update their own avatars
CREATE POLICY "Auth Update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars');

-- 5. Create policy to allow authenticated users to delete their own avatars
CREATE POLICY "Auth Delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars');
