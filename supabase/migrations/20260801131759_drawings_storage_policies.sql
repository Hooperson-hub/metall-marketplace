/*
# Storage policies for drawings bucket

1. Changes
- Adds public-read and authenticated-write policies to the `drawings` storage bucket so customers can upload their DXF/PDF/DWG drawings and anyone can view them.

2. Security
- SELECT (read): public — drawings are referenced by order listings visible to all signed-in users.
- INSERT (upload): any authenticated user (customers creating orders).
- UPDATE/DELETE: the uploader only.
*/

DROP POLICY IF EXISTS "drawings_public_read" ON storage.objects;
CREATE POLICY "drawings_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'drawings');

DROP POLICY IF EXISTS "drawings_auth_upload" ON storage.objects;
CREATE POLICY "drawings_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'drawings');

DROP POLICY IF EXISTS "drawings_owner_update" ON storage.objects;
CREATE POLICY "drawings_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'drawings' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'drawings' AND owner = auth.uid());

DROP POLICY IF EXISTS "drawings_owner_delete" ON storage.objects;
CREATE POLICY "drawings_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'drawings' AND owner = auth.uid());