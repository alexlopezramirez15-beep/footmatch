-- =====================================================================
-- FOOTMATCH · Storage y Realtime
-- =====================================================================

-- Buckets
--  public-assets : escudos e imágenes corporativas (organizaciones públicas)
--  player-media  : fotos y vídeos de jugadores (privado, URLs firmadas)
--  chat-files    : adjuntos de conversaciones (privado)
--  documents     : documentación de verificación (privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-assets', 'public-assets', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('player-media', 'player-media', false, 104857600, array['image/png','image/jpeg','image/webp','image/heic','video/mp4','video/quicktime','video/webm']),
  ('chat-files', 'chat-files', false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf']),
  ('documents', 'documents', false, 10485760, array['image/png','image/jpeg','application/pdf'])
on conflict (id) do nothing;

create or replace function public.safe_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

-- public-assets: carpeta = id de organización
create policy "public assets read" on storage.objects for select
  using (bucket_id = 'public-assets');
create policy "public assets write by org members" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets'
              and public.is_org_member(public.safe_uuid((storage.foldername(name))[1])));
create policy "public assets update by org members" on storage.objects for update to authenticated
  using (bucket_id = 'public-assets' and public.is_org_member(public.safe_uuid((storage.foldername(name))[1])));
create policy "public assets delete by org members" on storage.objects for delete to authenticated
  using (bucket_id = 'public-assets' and public.is_org_member(public.safe_uuid((storage.foldername(name))[1])));

-- player-media: carpeta = id del jugador; lectura según visibilidad del jugador
create policy "player media read" on storage.objects for select to authenticated
  using (bucket_id = 'player-media' and public.can_view_player(public.safe_uuid((storage.foldername(name))[1])));
create policy "player media write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'player-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "player media update own" on storage.objects for update to authenticated
  using (bucket_id = 'player-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "player media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'player-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- chat-files: carpeta = id de conversación
create policy "chat files read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-files' and public.can_access_conversation(public.safe_uuid((storage.foldername(name))[1])));
create policy "chat files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and public.can_send_message(public.safe_uuid((storage.foldername(name))[1])));

-- documents: carpeta = id del usuario solicitante
create policy "documents read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "documents write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime: mensajes, notificaciones y estados de lectura (RLS aplicada)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications, public.conversation_members;
  end if;
end $$;
