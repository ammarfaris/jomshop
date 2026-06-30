-- Phase 1: storage buckets + access policies (replaces the Appwrite buckets).
--   contests        -> public read,  admin write      (max 30MB)
--   contest-hosts   -> public read,  admin write      (max 30MB)
--   receipts        -> owner-scoped, admin read       (max 10MB, images/pdf)
--   receipts-archive-> service-role only               (max 5GB)
--
-- Object path convention for receipts: "<user_id>/<...>", so the first path
-- segment is matched against auth.uid() for per-user isolation.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('contests',      'contests',      true,  31457280,   null),
  ('contest-hosts', 'contest-hosts', true,  31457280,   null),
  ('receipts',      'receipts',      false, 10485760,
     array['image/png','image/jpeg','application/pdf','image/webp','image/heic','image/tiff','image/avif']),
  ('receipts-archive', 'receipts-archive', false, 5368709120, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Public content buckets: anyone reads; only admins write.
-- ---------------------------------------------------------------------------
drop policy if exists "content_public_read" on storage.objects;
create policy "content_public_read" on storage.objects
  for select using (bucket_id in ('contests', 'contest-hosts'));

drop policy if exists "content_admin_insert" on storage.objects;
create policy "content_admin_insert" on storage.objects
  for insert with check (bucket_id in ('contests', 'contest-hosts') and public.is_admin());

drop policy if exists "content_admin_update" on storage.objects;
create policy "content_admin_update" on storage.objects
  for update using (bucket_id in ('contests', 'contest-hosts') and public.is_admin())
  with check (bucket_id in ('contests', 'contest-hosts') and public.is_admin());

drop policy if exists "content_admin_delete" on storage.objects;
create policy "content_admin_delete" on storage.objects
  for delete using (bucket_id in ('contests', 'contest-hosts') and public.is_admin());

-- ---------------------------------------------------------------------------
-- Receipts: each user only sees/writes objects under their own "<uid>/" prefix.
-- Admins can read all for moderation.
-- ---------------------------------------------------------------------------
drop policy if exists "receipts_owner_read" on storage.objects;
create policy "receipts_owner_read" on storage.objects
  for select using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_admin_read" on storage.objects;
create policy "receipts_admin_read" on storage.objects
  for select using (bucket_id = 'receipts' and public.is_admin());

drop policy if exists "receipts_owner_insert" on storage.objects;
create policy "receipts_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_owner_delete" on storage.objects;
create policy "receipts_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- receipts-archive intentionally has NO policies: only the service role
-- (Edge Functions) reads/writes it.
