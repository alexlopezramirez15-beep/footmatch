-- =====================================================================
-- FOOTMATCH · Lógica de negocio
-- Alta de usuarios, matching bidireccional, conversaciones, candidaturas,
-- notificaciones, tutores legales, moderación y funciones de administración.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Notificaciones internas
-- ---------------------------------------------------------------------
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  prefs jsonb;
  category text := split_part(p_type, '.', 1);
begin
  if p_user is null then return; end if;
  select notification_prefs into prefs from public.profiles where id = p_user and deleted_at is null;
  if not found then return; end if;
  -- Categorías desactivadas por el usuario (las de seguridad nunca se silencian)
  if category in ('matches','messages','applications','opportunities','interests','trials')
     and coalesce((prefs ->> category)::boolean, true) = false then
    return;
  end if;
  insert into public.notifications(user_id, type, title, body, link, data)
  values (p_user, p_type, p_title, p_body, p_link, coalesce(p_data, '{}'::jsonb));
end $$;

create or replace function public.notify_org(p_org uuid, p_type text, p_title text, p_body text, p_link text, p_data jsonb default '{}'::jsonb, p_except uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  for m in select user_id from public.organization_members where organization_id = p_org loop
    if p_except is null or m.user_id <> p_except then
      perform public.notify(m.user_id, p_type, p_title, p_body, p_link, p_data);
    end if;
  end loop;
end $$;

revoke execute on function public.notify(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_org(uuid, text, text, text, text, jsonb, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Alta de usuario (Supabase Auth → profiles)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare loc text := coalesce(new.raw_user_meta_data ->> 'locale', 'es');
begin
  if loc not in ('es','ca','en','pl') then loc := 'es'; end if;
  insert into public.profiles(id, full_name, locale)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), loc)
  on conflict (id) do nothing;
  insert into public.subscriptions(user_id, plan, status) values (new.id, 'free', 'active');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Organizaciones: el creador pasa a ser propietario
-- ---------------------------------------------------------------------
create or replace function public.on_organization_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.organization_members(organization_id, user_id, role)
    values (new.id, new.created_by, 'owner') on conflict do nothing;
    insert into public.user_roles(user_id, role)
    values (new.created_by, case new.type when 'club' then 'club'::public.app_role
                                          when 'academy' then 'academy'::public.app_role
                                          else 'agent'::public.app_role end)
    on conflict do nothing;
  end if;
  if new.type = 'club' then insert into public.clubs(organization_id) values (new.id) on conflict do nothing; end if;
  if new.type = 'academy' then insert into public.academies(organization_id) values (new.id) on conflict do nothing; end if;
  insert into public.subscriptions(organization_id, plan, status) values (new.id, 'free', 'active');
  perform public.log_audit('organization.created', 'organization', new.id::text, jsonb_build_object('name', new.name, 'type', new.type));
  return new;
end $$;
create trigger organizations_after_insert after insert on public.organizations
  for each row execute function public.on_organization_created();

create or replace function public.on_organization_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.verification_status is distinct from old.verification_status then
    perform public.log_audit('organization.verification', 'organization', new.id::text,
      jsonb_build_object('from', old.verification_status, 'to', new.verification_status));
    perform public.notify_org(new.id, 'security.verification',
      case new.verification_status when 'verified' then 'Organización verificada'
                                   when 'rejected' then 'Verificación rechazada'
                                   else 'Estado de verificación actualizado' end,
      new.name, '/club', jsonb_build_object('status', new.verification_status));
  end if;
  if new.suspended_at is distinct from old.suspended_at then
    perform public.log_audit(case when new.suspended_at is null then 'organization.unsuspended' else 'organization.suspended' end,
      'organization', new.id::text, '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger organizations_after_update after update on public.organizations
  for each row execute function public.on_organization_verification();

-- ---------------------------------------------------------------------
-- Matching bidireccional
-- ---------------------------------------------------------------------
create or replace function public.create_match(p_player uuid, p_org uuid, p_opportunity uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  mid uuid;
  cid uuid;
  org_name text;
  player_name text;
  sup boolean := public.user_is_minor(p_player);
  g record;
begin
  -- Seguridad: menores sin autorización parental no generan matches
  if not public.player_contactable(p_player) or public.is_blocked_with_org(p_player, p_org) then
    return null;
  end if;

  insert into public.matches(player_id, organization_id, opportunity_id)
  values (p_player, p_org, p_opportunity)
  on conflict (player_id, organization_id) do nothing
  returning id into mid;
  if mid is null then return null; end if;   -- ya existía: sin duplicados

  insert into public.conversations(match_id, player_id, organization_id, supervised)
  values (mid, p_player, p_org, sup)
  on conflict (player_id, organization_id) do update set match_id = excluded.match_id
  returning id into cid;

  insert into public.conversation_members(conversation_id, user_id) values (cid, p_player) on conflict do nothing;
  insert into public.conversation_members(conversation_id, user_id)
    select cid, user_id from public.organization_members where organization_id = p_org on conflict do nothing;
  if sup then
    for g in select guardian_id from public.guardian_relationships
             where minor_id = p_player and status = 'approved' and guardian_id is not null loop
      insert into public.conversation_members(conversation_id, user_id) values (cid, g.guardian_id) on conflict do nothing;
      perform public.notify(g.guardian_id, 'matches.supervised', 'Nuevo match supervisado',
        'Una organización y tu tutelado han mostrado interés mutuo.', '/chats/' || cid, jsonb_build_object('conversation_id', cid));
    end loop;
  end if;

  insert into public.messages(conversation_id, sender_id, kind, body, metadata)
  values (cid, p_player, 'system', 'match', jsonb_build_object('event', 'match', 'match_id', mid));

  select name into org_name from public.organizations where id = p_org;
  select split_part(full_name, ' ', 1) into player_name from public.profiles where id = p_player;

  perform public.notify(p_player, 'matches.new', 'IT''S A FOOTMATCH!', coalesce(org_name, 'Un club') || ' también está interesado en ti.',
    '/chats/' || cid, jsonb_build_object('match_id', mid, 'conversation_id', cid, 'organization_id', p_org));
  perform public.notify_org(p_org, 'matches.new', 'IT''S A FOOTMATCH!', coalesce(player_name, 'Un jugador') || ' también está interesado.',
    '/chats/' || cid, jsonb_build_object('match_id', mid, 'conversation_id', cid, 'player_id', p_player));
  perform public.log_audit('match.created', 'match', mid::text, jsonb_build_object('player', p_player, 'organization', p_org));
  return mid;
end $$;
revoke execute on function public.create_match(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.on_interest_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
  reciprocal_opp uuid;
  org_name text;
begin
  if new.kind = 'pass' then return new; end if;

  if new.target_type = 'player' then
    -- Organización → jugador. ¿El jugador ya mostró interés por la org o una de sus oportunidades?
    select coalesce(i.target_opportunity_id, null) into reciprocal_opp
    from public.interests i
    left join public.opportunities o on o.id = i.target_opportunity_id
    where i.actor_id = new.target_user_id and i.actor_org_id is null and i.kind <> 'pass'
      and (i.target_org_id = new.actor_org_id or o.organization_id = new.actor_org_id)
    order by i.created_at desc limit 1;
    if found then
      perform public.create_match(new.target_user_id, new.actor_org_id, reciprocal_opp);
    else
      select name into org_name from public.organizations where id = new.actor_org_id;
      perform public.notify(new.target_user_id, 'interests.received', 'Un club está interesado en ti',
        coalesce(org_name, 'Una organización') || ' ha mostrado interés en tu perfil.', '/home',
        jsonb_build_object('organization_id', new.actor_org_id));
    end if;
  else
    -- Jugador → organización / oportunidad
    if new.target_type = 'organization' then
      org := new.target_org_id;
    else
      select organization_id into org from public.opportunities where id = new.target_opportunity_id;
    end if;
    if exists (select 1 from public.interests i
               where i.actor_org_id = org and i.target_user_id = new.actor_id and i.kind <> 'pass') then
      perform public.create_match(new.actor_id, org, new.target_opportunity_id);
    else
      perform public.notify_org(org, 'interests.received', 'Nuevo interés',
        'Un futbolista ha mostrado interés en vuestra organización.', '/club',
        jsonb_build_object('player_id', new.actor_id, 'opportunity_id', new.target_opportunity_id));
    end if;
  end if;
  return new;
end $$;
create trigger interests_after_insert after insert on public.interests
  for each row execute function public.on_interest_created();

-- Nuevos miembros de la organización se unen a sus conversaciones
create or replace function public.on_org_member_added() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.conversation_members(conversation_id, user_id)
    select id, new.user_id from public.conversations where organization_id = new.organization_id
  on conflict do nothing;
  perform public.log_audit('organization.member_added', 'organization', new.organization_id::text,
    jsonb_build_object('user_id', new.user_id, 'role', new.role));
  return new;
end $$;
create trigger org_members_after_insert after insert on public.organization_members
  for each row execute function public.on_org_member_added();

create or replace function public.on_org_member_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.conversation_members cm using public.conversations c
   where cm.conversation_id = c.id and c.organization_id = old.organization_id and cm.user_id = old.user_id;
  perform public.log_audit('organization.member_removed', 'organization', old.organization_id::text,
    jsonb_build_object('user_id', old.user_id));
  return old;
end $$;
create trigger org_members_after_delete after delete on public.organization_members
  for each row execute function public.on_org_member_removed();

-- ---------------------------------------------------------------------
-- Mensajería
-- ---------------------------------------------------------------------
create or replace function public.on_message_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  prev timestamptz;
  m record;
  sender_name text;
begin
  select last_message_at into prev from public.conversations where id = new.conversation_id for update;
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at, archived = false
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  if new.kind = 'system' then return new; end if;

  select split_part(full_name, ' ', 1) into sender_name from public.profiles where id = new.sender_id;
  -- Notificar sólo el primer mensaje no leído para no saturar
  for m in select user_id, last_read_at, muted from public.conversation_members
           where conversation_id = new.conversation_id and user_id <> new.sender_id loop
    if not m.muted and (prev is null or m.last_read_at is null or m.last_read_at >= prev) then
      perform public.notify(m.user_id, 'messages.new', 'Nuevo mensaje',
        coalesce(sender_name, 'Alguien') || ': ' || left(coalesce(new.body, 'Archivo adjunto'), 80),
        '/chats/' || new.conversation_id, jsonb_build_object('conversation_id', new.conversation_id));
    end if;
  end loop;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_created();

create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- El club contacta con un candidato: abre conversación (sin mensajería masiva)
create or replace function public.start_conversation_from_application(p_application uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  a public.applications;
  cid uuid;
  g record;
begin
  select * into a from public.applications where id = p_application;
  if not found or not public.is_org_member(a.organization_id) then
    raise exception 'FOOTMATCH: no autorizado' using errcode = '42501';
  end if;
  if not public.player_contactable(a.applicant_id) then
    raise exception 'FOOTMATCH: el jugador requiere autorización parental' using errcode = '42501';
  end if;
  if public.is_blocked_with_org(a.applicant_id, a.organization_id) then
    raise exception 'FOOTMATCH: contacto bloqueado' using errcode = '42501';
  end if;

  select id into cid from public.conversations where player_id = a.applicant_id and organization_id = a.organization_id;
  if cid is null then
    insert into public.conversations(application_id, player_id, organization_id, supervised)
    values (a.id, a.applicant_id, a.organization_id, public.user_is_minor(a.applicant_id))
    returning id into cid;
    insert into public.conversation_members(conversation_id, user_id) values (cid, a.applicant_id) on conflict do nothing;
    insert into public.conversation_members(conversation_id, user_id)
      select cid, user_id from public.organization_members where organization_id = a.organization_id on conflict do nothing;
    for g in select guardian_id from public.guardian_relationships
             where minor_id = a.applicant_id and status = 'approved' and guardian_id is not null loop
      insert into public.conversation_members(conversation_id, user_id) values (cid, g.guardian_id) on conflict do nothing;
    end loop;
    insert into public.messages(conversation_id, sender_id, kind, body, metadata)
    values (cid, auth.uid(), 'system', 'application_contact', jsonb_build_object('event', 'application_contact', 'application_id', a.id));
  end if;

  if a.status in ('received','reviewed','shortlisted') then
    update public.applications set status = 'contacted' where id = a.id;
  end if;
  return cid;
end $$;

-- Bloqueo de usuario: corta conversaciones entre ambas partes
create or replace function public.block_user(p_target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_target = auth.uid() then
    raise exception 'FOOTMATCH: operación no válida' using errcode = '22023';
  end if;
  insert into public.blocks(blocker_id, blocked_id) values (auth.uid(), p_target) on conflict do nothing;
  update public.conversations c set blocked_at = now(), blocked_by = auth.uid()
   where c.blocked_at is null and (
     (c.player_id = auth.uid() and exists (select 1 from public.organization_members om where om.organization_id = c.organization_id and om.user_id = p_target))
     or (c.player_id = p_target and exists (select 1 from public.organization_members om where om.organization_id = c.organization_id and om.user_id = auth.uid()))
   );
  perform public.log_audit('user.blocked', 'profile', p_target::text, '{}'::jsonb);
end $$;

create or replace function public.block_conversation(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.conversations;
begin
  select * into c from public.conversations where id = p_conversation;
  if not found or not public.can_access_conversation(p_conversation) then
    raise exception 'FOOTMATCH: no autorizado' using errcode = '42501';
  end if;
  update public.conversations set blocked_at = now(), blocked_by = auth.uid() where id = p_conversation and blocked_at is null;
  perform public.log_audit('conversation.blocked', 'conversation', p_conversation::text, '{}'::jsonb);
end $$;

create or replace function public.unblock_conversation(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set blocked_at = null, blocked_by = null
   where id = p_conversation and blocked_by = auth.uid();
  delete from public.blocks b using public.conversations c
   where c.id = p_conversation and b.blocker_id = auth.uid()
     and (b.blocked_id = c.player_id or b.blocked_id in (select user_id from public.organization_members where organization_id = c.organization_id));
end $$;

-- ---------------------------------------------------------------------
-- Candidaturas
-- ---------------------------------------------------------------------
create or replace function public.on_application_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  insert into public.application_status_history(application_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.applicant_id);
  select title into t from public.opportunities where id = new.opportunity_id;
  perform public.notify_org(new.organization_id, 'applications.received', 'Nueva candidatura',
    coalesce(t, 'Oportunidad'), '/club/pipeline?opportunity=' || new.opportunity_id,
    jsonb_build_object('application_id', new.id));
  perform public.notify(new.applicant_id, 'applications.sent', 'Candidatura enviada', coalesce(t, ''),
    '/applications', jsonb_build_object('application_id', new.id));
  return new;
end $$;
create trigger applications_after_insert after insert on public.applications
  for each row execute function public.on_application_created();

create or replace function public.on_application_updated() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  if new.status is distinct from old.status then
    insert into public.application_status_history(application_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
    select title into t from public.opportunities where id = new.opportunity_id;
    if new.status = 'withdrawn' then
      perform public.notify_org(new.organization_id, 'applications.withdrawn', 'Candidatura retirada', coalesce(t, ''),
        '/club/pipeline?opportunity=' || new.opportunity_id, jsonb_build_object('application_id', new.id));
    elsif new.status <> 'reviewed' then
      -- "Revisada" es un estado interno; el resto se comunica al candidato
      perform public.notify(new.applicant_id, 'applications.status', 'Tu candidatura ha cambiado de estado',
        coalesce(t, ''), '/applications', jsonb_build_object('application_id', new.id, 'status', new.status));
    end if;
    perform public.log_audit('application.status', 'application', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
create trigger applications_after_update after update on public.applications
  for each row execute function public.on_application_updated();

-- ---------------------------------------------------------------------
-- Trials
-- ---------------------------------------------------------------------
create or replace function public.on_trial_application_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  select title into t from public.trials where id = new.trial_id;
  if tg_op = 'INSERT' then
    perform public.notify_org(new.organization_id, 'trials.request', 'Nueva inscripción a prueba', coalesce(t, ''),
      '/trials/' || new.trial_id, jsonb_build_object('trial_application_id', new.id));
  elsif new.status is distinct from old.status then
    if new.status = 'withdrawn' then
      perform public.notify_org(new.organization_id, 'trials.withdrawn', 'Inscripción retirada', coalesce(t, ''),
        '/trials/' || new.trial_id, jsonb_build_object('trial_application_id', new.id));
    else
      perform public.notify(new.player_id, 'trials.status',
        case new.status when 'accepted' then 'Prueba aceptada' when 'waitlist' then 'En lista de espera'
                        when 'rejected' then 'Inscripción no aceptada' else 'Tu prueba ha cambiado de estado' end,
        coalesce(t, ''), '/trials/' || new.trial_id, jsonb_build_object('status', new.status));
    end if;
    perform public.log_audit('trial_application.status', 'trial_application', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
create trigger trial_applications_after_change after insert or update on public.trial_applications
  for each row execute function public.on_trial_application_changed();

-- ---------------------------------------------------------------------
-- Tutores legales
-- ---------------------------------------------------------------------
create or replace function public.on_guardian_requested() returns trigger
language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  perform public.log_audit('guardian.requested', 'guardian_relationship', new.id::text,
    jsonb_build_object('minor_id', new.minor_id));
  -- Si el tutor ya tiene cuenta, se le notifica dentro de la plataforma
  select id into gid from auth.users where lower(email) = lower(new.guardian_email::text) limit 1;
  if gid is not null then
    perform public.notify(gid, 'security.guardian_request', 'Solicitud de autorización parental',
      'Un menor te ha indicado como tutor legal en FOOTMATCH.', '/guardian/accept?token=' || new.token,
      jsonb_build_object('relationship_id', new.id));
  end if;
  return new;
end $$;
create trigger guardian_after_insert after insert on public.guardian_relationships
  for each row execute function public.on_guardian_requested();

create or replace function public.accept_guardian_invite(p_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.guardian_relationships;
  my_email text := auth.jwt() ->> 'email';
begin
  select * into r from public.guardian_relationships where token = p_token;
  if not found or r.status not in ('pending') then
    raise exception 'FOOTMATCH: invitación no válida o ya utilizada' using errcode = '22023';
  end if;
  if my_email is null or lower(my_email) <> lower(r.guardian_email::text) then
    raise exception 'FOOTMATCH: esta invitación pertenece a otra dirección de correo' using errcode = '42501';
  end if;
  if auth.uid() = r.minor_id then
    raise exception 'FOOTMATCH: un menor no puede autorizarse a sí mismo' using errcode = '42501';
  end if;
  if public.user_is_minor(auth.uid()) then
    raise exception 'FOOTMATCH: el tutor legal debe ser mayor de edad (indica tu fecha de nacimiento en Ajustes)' using errcode = '42501';
  end if;

  update public.guardian_relationships set guardian_id = auth.uid(), status = 'approved', approved_at = now()
   where id = r.id;
  insert into public.user_roles(user_id, role) values (auth.uid(), 'guardian') on conflict do nothing;
  insert into public.legal_consents(user_id, granted_by, consent_type, version, granted)
  values (r.minor_id, auth.uid(), 'guardian_authorization', '2026-10', true),
         (r.minor_id, auth.uid(), 'minor_contact', '2026-10', true);
  insert into public.conversation_members(conversation_id, user_id)
    select id, auth.uid() from public.conversations where player_id = r.minor_id on conflict do nothing;
  perform public.notify(r.minor_id, 'security.guardian_approved', 'Autorización parental aprobada',
    'Tu tutor legal ha autorizado tu participación en FOOTMATCH.', '/profile', '{}'::jsonb);
  perform public.log_audit('guardian.approved', 'guardian_relationship', r.id::text, jsonb_build_object('minor_id', r.minor_id));
  return r.minor_id;
end $$;

create or replace function public.reject_guardian_invite(p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.guardian_relationships;
begin
  select * into r from public.guardian_relationships where token = p_token;
  if not found or lower(coalesce(auth.jwt() ->> 'email', '')) <> lower(r.guardian_email::text) then
    raise exception 'FOOTMATCH: no autorizado' using errcode = '42501';
  end if;
  update public.guardian_relationships set status = 'rejected' where id = r.id;
  perform public.log_audit('guardian.rejected', 'guardian_relationship', r.id::text, '{}'::jsonb);
end $$;

create or replace function public.revoke_guardian_authorization(p_minor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_guardian_of(p_minor) then
    raise exception 'FOOTMATCH: no autorizado' using errcode = '42501';
  end if;
  update public.guardian_relationships set status = 'revoked' where minor_id = p_minor and guardian_id = auth.uid();
  insert into public.legal_consents(user_id, granted_by, consent_type, version, granted)
  values (p_minor, auth.uid(), 'guardian_authorization', '2026-10', false);
  -- Al revocar, se cortan las conversaciones activas del menor
  update public.conversations set blocked_at = now(), blocked_by = auth.uid()
   where player_id = p_minor and blocked_at is null and not public.guardian_approved(p_minor);
  perform public.log_audit('guardian.revoked', 'guardian_relationship', p_minor::text, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- Cuenta: eliminación (RGPD art. 17)
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'FOOTMATCH: no autenticado' using errcode = '42501'; end if;
  perform set_config('footmatch.internal', 'on', true);
  perform public.log_audit('account.deleted', 'profile', uid::text, '{}'::jsonb);
  delete from public.player_profiles where user_id = uid;
  delete from public.coach_profiles where user_id = uid;
  delete from public.agent_profiles where user_id = uid;
  delete from public.scout_profiles where user_id = uid;
  delete from public.player_careers where player_id = uid;
  delete from public.player_statistics where player_id = uid;
  delete from public.media_assets where owner_id = uid;
  delete from public.interests where actor_id = uid or target_user_id = uid;
  delete from public.favorites where user_id = uid or target_user_id = uid;
  delete from public.discover_preferences where user_id = uid;
  delete from public.saved_searches where user_id = uid;
  delete from public.notifications where user_id = uid;
  update public.applications set status = 'withdrawn' where applicant_id = uid and status <> 'withdrawn';
  update public.messages set body = null, attachment_path = null, deleted_at = now(), metadata = '{}'::jsonb
   where sender_id = uid and kind <> 'system';
  update public.profiles set full_name = 'Usuario eliminado', birth_date = null, city = null, region = null,
         avatar_path = null, onboarding_draft = '{}'::jsonb, deleted_at = now()
   where id = uid;
  -- La eliminación del usuario de auth.users se completa desde el servidor con service role.
end $$;

-- ---------------------------------------------------------------------
-- Discover
-- ---------------------------------------------------------------------
create or replace function public.discover_players(p_org uuid, p_limit int default 100)
returns setof public.player_cards
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.is_org_member(p_org) then
    raise exception 'FOOTMATCH: no autorizado' using errcode = '42501';
  end if;
  return query
    select pc.* from public.player_cards pc
    where pc.user_id <> auth.uid()
      and not exists (select 1 from public.interests i where i.actor_org_id = p_org and i.target_user_id = pc.user_id)
      and not exists (select 1 from public.matches m where m.organization_id = p_org and m.player_id = pc.user_id)
      and pc.availability <> 'unavailable'
    order by pc.updated_at desc
    limit least(greatest(p_limit, 1), 300);
end $$;

create or replace function public.discover_opportunities(p_limit int default 100)
returns table (
  id uuid, organization_id uuid, type public.opportunity_type, title text, description text,
  country char(2), region text, city text, category text, positions text[], age_min int, age_max int,
  languages text[], deadline date, starts_on date, status public.opportunity_status, is_demo boolean, created_at timestamptz,
  org_name text, org_crest_path text, org_verification public.verification_status, org_type public.org_type
)
language sql stable security invoker set search_path = '' as $$
  select o.id, o.organization_id, o.type, o.title, o.description, o.country, o.region, o.city, o.category, o.positions,
         o.age_min, o.age_max, o.languages, o.deadline, o.starts_on, o.status, o.is_demo, o.created_at,
         org.name, org.crest_path, org.verification_status, org.type
  from public.opportunities o
  join public.organizations org on org.id = o.organization_id
  where o.status = 'open' and (o.deadline is null or o.deadline >= current_date)
    and org.suspended_at is null
    and not public.is_org_member(o.organization_id)
    and not exists (select 1 from public.interests i where i.actor_id = auth.uid() and i.actor_org_id is null
                    and i.target_opportunity_id = o.id)
    and not exists (select 1 from public.matches m where m.player_id = auth.uid() and m.organization_id = o.organization_id)
    and not public.is_blocked_with_org(auth.uid(), o.organization_id)
  order by o.created_at desc
  limit least(greatest(p_limit, 1), 300);
$$;

-- ---------------------------------------------------------------------
-- Administración
-- ---------------------------------------------------------------------
create or replace function public.admin_set_org_verification(p_org uuid, p_status public.verification_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FOOTMATCH: sólo administradores' using errcode = '42501'; end if;
  update public.organizations set verification_status = p_status where id = p_org;
  update public.verification_requests set status = p_status, reviewer_id = auth.uid(), reviewer_note = p_note, reviewed_at = now()
   where organization_id = p_org and status = 'pending';
end $$;

create or replace function public.admin_set_agent_verification(p_agent uuid, p_status public.verification_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FOOTMATCH: sólo administradores' using errcode = '42501'; end if;
  update public.agent_profiles set verification_status = p_status where user_id = p_agent;
  update public.verification_requests set status = p_status, reviewer_id = auth.uid(), reviewer_note = p_note, reviewed_at = now()
   where user_id = p_agent and subject = 'agent' and status = 'pending';
  perform public.log_audit('agent.verification', 'profile', p_agent::text, jsonb_build_object('to', p_status));
end $$;

create or replace function public.admin_set_user_suspension(p_user uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FOOTMATCH: sólo administradores' using errcode = '42501'; end if;
  update public.profiles set suspended_at = case when p_suspended then now() else null end where id = p_user;
  perform public.log_audit(case when p_suspended then 'user.suspended' else 'user.unsuspended' end, 'profile', p_user::text, '{}'::jsonb);
end $$;

create or replace function public.admin_set_org_suspension(p_org uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FOOTMATCH: sólo administradores' using errcode = '42501'; end if;
  update public.organizations set suspended_at = case when p_suspended then now() else null end where id = p_org;
end $$;

create or replace function public.admin_resolve_report(p_report uuid, p_status public.report_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FOOTMATCH: sólo administradores' using errcode = '42501'; end if;
  update public.reports set status = p_status, resolved_by = auth.uid(), resolution_note = p_note,
         resolved_at = case when p_status in ('resolved','dismissed') then now() else null end
   where id = p_report;
  perform public.log_audit('report.' || p_status::text, 'report', p_report::text, '{}'::jsonb);
end $$;

-- Métricas reales calculadas sobre la base de datos (los datos demo se excluyen)
create or replace function public.admin_metrics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FOOTMATCH: sólo administradores' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles where deleted_at is null and not is_demo),
    'users_new_7d', (select count(*) from public.profiles where deleted_at is null and not is_demo and created_at > now() - interval '7 days'),
    'users_active_7d', (select count(distinct sender_id) from public.messages where created_at > now() - interval '7 days')
                     + 0,
    'players', (select count(*) from public.player_profiles where not is_demo),
    'organizations', (select count(*) from public.organizations where not is_demo),
    'organizations_verified', (select count(*) from public.organizations where not is_demo and verification_status = 'verified'),
    'opportunities_open', (select count(*) from public.opportunities where not is_demo and status = 'open'),
    'matches', (select count(*) from public.matches m join public.profiles p on p.id = m.player_id where not p.is_demo),
    'applications', (select count(*) from public.applications a join public.profiles p on p.id = a.applicant_id where not p.is_demo),
    'applications_selected', (select count(*) from public.applications a join public.profiles p on p.id = a.applicant_id where not p.is_demo and a.status = 'selected'),
    'trials', (select count(*) from public.trials where not is_demo),
    'reports_open', (select count(*) from public.reports where status in ('open','reviewing')),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'demo_records', (select count(*) from public.profiles where is_demo) + (select count(*) from public.organizations where is_demo)
  );
end $$;

-- Borrado de datos demostrativos antes del lanzamiento
create or replace function public.purge_demo_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n_orgs int; n_users int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'FOOTMATCH: sólo administradores' using errcode = '42501';
  end if;
  delete from public.organizations where is_demo;
  get diagnostics n_orgs = row_count;
  delete from auth.users where id in (select id from public.profiles where is_demo);
  get diagnostics n_users = row_count;
  perform public.log_audit('demo.purged', 'system', null, jsonb_build_object('organizations', n_orgs, 'users', n_users));
  return jsonb_build_object('organizations', n_orgs, 'users', n_users);
end $$;

-- Caducidad de oportunidades (programable con pg_cron: select public.expire_opportunities();)
create or replace function public.expire_opportunities() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.opportunities set status = 'expired' where status = 'open' and deadline < current_date;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.expire_opportunities() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Datos de configuración
-- ---------------------------------------------------------------------
insert into public.matching_criteria(criterion, weight) values
  ('position', 30), ('age', 15), ('category', 15), ('experience', 8), ('location', 10),
  ('mobility', 5), ('availability', 10), ('languages', 4), ('foot', 2), ('height', 1)
on conflict (criterion) do nothing;

insert into public.plans(id, name, audience, limits, features) values
  ('free', 'Free', '{player,club,coach,agent,scout,academy}', '{"daily_interests":30,"open_opportunities":2}',
    '{profile,basic_search,matching,applications}'),
  ('player_pro', 'Player Pro', '{player}', '{"daily_interests":200}', '{advanced_filters,profile_analytics,visibility_tools}'),
  ('club_pro', 'Club Pro', '{club}', '{"open_opportunities":50}', '{advanced_search,pipeline,evaluations,recruiting_tools}'),
  ('agency_pro', 'Agency Pro', '{agent}', '{"represented_players":100}', '{portfolio,authorized_representation,tracking}'),
  ('academy_pro', 'Academy Pro', '{academy}', '{"open_trials":50}', '{programs,trials,participants}')
on conflict (id) do nothing;

insert into public.app_settings(key, value) values
  ('brand', '{"name":"FOOTMATCH","tagline":"Your next opportunity starts with a match."}'),
  ('payments_enabled', 'false')
on conflict (key) do nothing;
