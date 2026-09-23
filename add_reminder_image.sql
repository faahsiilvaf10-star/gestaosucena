ALTER TABLE reminders ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('reminders_media', 'reminders_media', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    BEGIN
        CREATE POLICY "reminders_media_public_access" ON storage.objects FOR SELECT USING ( bucket_id = 'reminders_media' );
    EXCEPTION WHEN duplicate_object THEN null; END;
    
    BEGIN
        CREATE POLICY "reminders_media_auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'reminders_media' );
    EXCEPTION WHEN duplicate_object THEN null; END;
    
    BEGIN
        CREATE POLICY "reminders_media_auth_update" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'reminders_media' AND auth.uid() = owner );
    EXCEPTION WHEN duplicate_object THEN null; END;
    
    BEGIN
        CREATE POLICY "reminders_media_auth_delete" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'reminders_media' AND auth.uid() = owner );
    EXCEPTION WHEN duplicate_object THEN null; END;
END
$$;
