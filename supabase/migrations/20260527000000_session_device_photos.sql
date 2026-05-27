-- Add photo support to session_devices

alter table public.session_devices add column if not exists photo_url text;

-- Storage bucket for patch photos (public so URLs work without expiry)
insert into storage.buckets (id, name, public)
values ('patch-photos', 'patch-photos', true)
on conflict (id) do nothing;

-- RLS: each user can only touch their own folder ({user_id}/{uuid}.ext)
create policy "patch_photos_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'patch-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "patch_photos_select"
on storage.objects for select to public
using (bucket_id = 'patch-photos');

create policy "patch_photos_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'patch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
