-- ============================================================
-- Rumbo · Álbum del mes: las fotos de los mejores momentos
-- Las fotos viven en Supabase Storage, en un bucket privado ("album"), cada una en
-- la carpeta de su dueño: <user_id>/<YYYY-MM>/<foto>.jpg (y la miniatura, <foto>-m.jpg).
-- Solo tu cuenta puede ver, subir, cambiar o borrar lo que está en tu carpeta: nadie más
-- las ve, tampoco tus amigos. Lo demás del álbum (comentarios, portada, estilo) va en tu
-- documento privado (estado_usuario), como siempre.
-- Se puede correr más de una vez. Correr en Supabase → SQL Editor.
-- ============================================================

-- El bucket: privado, hasta 3 MB por archivo y solo imágenes JPEG o WebP
-- (la app achica cada foto a unos 300 KB antes de subirla)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album', 'album', false, 3145728, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Las reglas: la primera carpeta de la ruta tiene que ser tu id
drop policy if exists "album: ver lo tuyo" on storage.objects;
create policy "album: ver lo tuyo" on storage.objects
  for select to authenticated
  using (bucket_id = 'album' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "album: subir a tu carpeta" on storage.objects;
create policy "album: subir a tu carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'album' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "album: cambiar lo tuyo" on storage.objects;
create policy "album: cambiar lo tuyo" on storage.objects
  for update to authenticated
  using (bucket_id = 'album' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'album' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "album: borrar lo tuyo" on storage.objects;
create policy "album: borrar lo tuyo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'album' and (storage.foldername(name))[1] = auth.uid()::text);

-- Para revisar que quedó bien:
--   select id, public, file_size_limit from storage.buckets where id = 'album';
--   select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'album:%';   -- 4
