
CREATE POLICY "app_assets_read_all" ON storage.objects FOR SELECT USING (bucket_id = 'app-assets');
CREATE POLICY "app_assets_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "app_assets_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'app-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'app-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "app_assets_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'app-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "kyc_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "kyc_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
