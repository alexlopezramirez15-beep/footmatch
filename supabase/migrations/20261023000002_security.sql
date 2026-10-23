-- =====================================================================
-- FOOTMATCH · Seguridad
-- Funciones de autorización, RLS en todas las tablas, vistas enmascaradas
-- y triggers de protección de columnas privilegiadas.
-- Regla: la autorización se decide en la base de datos, no en el frontend.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones de autorización (security definer → evitan recursión RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.has_role(r public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = r);
$$;

create or replace function public.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members where organization_id = org and user_id = auth.uid());
$$;

create or replace function public.is_org_admin(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members
                 where organization_id = org and user_id = auth.uid() and role in ('owner','admin'));
$$;

-- Fecha de nacimiento desconocida ⇒ se trata como menor (criterio restrictivo).
create or replace function public.user_is_minor(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select birth_date > (current_date - interval '18 years')::date
                   from public.profiles where id = uid), true);
$$;

create or replace function public.guardian_approved(minor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guardian_relationships
                 where minor_id = minor and status = 'approved' and guardian_id is not null);
$$;

create or replace function public.is_guardian_of(minor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guardian_relationships
                 where minor_id = minor and guardian_id = auth.uid() and status = 'approved');
$$;

-- Puede contactarse/participar: adulto, o menor con autorización parental aprobada.
create or replace function public.player_contactable(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (not public.user_is_minor(p)) or public.guardian_approved(p);
$$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- ¿El jugador ha bloqueado a algún miembro de la organización (o viceversa)?
create or replace function public.is_blocked_with_org(p uuid, org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks b
                 join public.organization_members om on om.organization_id = org
                 where (b.blocker_id = p and b.blocked_id = om.user_id)
                    or (b.blocker_id = om.user_id and b.blocked_id = p));
$$;

create or replace function public.viewer_in_verified_org() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members om
                 join public.organizations o on o.id = om.organization_id
                 where om.user_id = auth.uid() and o.verification_status = 'verified' and o.suspended_at is null);
$$;

create or replace function public.viewer_is_professional() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members om
                 join public.organizations o on o.id = om.organization_id
                 where om.user_id = auth.uid() and o.suspended_at is null)
      or exists (select 1 from public.agent_profiles where user_id = auth.uid() and verification_status = 'verified')
      or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'scout');
$$;

-- Visibilidad de un futbolista para el usuario actual.
-- Menores: sólo con autorización parental y sólo ante organizaciones verificadas,
-- salvo relación previa iniciada por el propio jugador (candidatura, match, interés).
create or replace function public.can_view_player(p uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v uuid := auth.uid();
  vis public.profile_visibility;
begin
  if p is null or v is null then return false; end if;
  if v = p or public.is_admin() or public.is_guardian_of(p) then return true; end if;

  select pp.visibility into vis
  from public.player_profiles pp join public.profiles pr on pr.id = pp.user_id
  where pp.user_id = p and pr.deleted_at is null and pr.suspended_at is null;
  if not found then return false; end if;

  if public.is_blocked_between(v, p) then return false; end if;

  -- Relación existente con una organización del observador
  if exists (select 1 from public.matches m join public.organization_members om on om.organization_id = m.organization_id
             where m.player_id = p and om.user_id = v)
     or exists (select 1 from public.applications a join public.organization_members om on om.organization_id = a.organization_id
                where a.applicant_id = p and om.user_id = v and a.status <> 'withdrawn')
     or exists (select 1 from public.trial_applications t join public.organization_members om on om.organization_id = t.organization_id
                where t.player_id = p and om.user_id = v and t.status <> 'withdrawn')
     or exists (select 1 from public.interests i join public.organization_members om
                  on om.organization_id = coalesce(i.target_org_id, (select o.organization_id from public.opportunities o where o.id = i.target_opportunity_id))
                where i.actor_id = p and i.actor_org_id is null and i.kind <> 'pass' and om.user_id = v)
     or exists (select 1 from public.agent_representations ar where ar.player_id = p and ar.agent_id = v and ar.status = 'approved')
  then
    return public.player_contactable(p);
  end if;

  if vis = 'hidden' then return false; end if;

  if public.user_is_minor(p) then
    return public.guardian_approved(p) and public.viewer_in_verified_org();
  end if;

  return vis = 'public' or public.viewer_is_professional();
end $$;

create or replace function public.can_access_conversation(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations cv
    where cv.id = c and (
      cv.player_id = auth.uid()
      or public.is_org_member(cv.organization_id)
      or (cv.supervised and public.is_guardian_of(cv.player_id))
      or public.is_admin()
    )
  );
$$;

create or replace function public.can_send_message(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations cv
    where cv.id = c
      and cv.blocked_at is null
      and (cv.player_id = auth.uid() or public.is_org_member(cv.organization_id)
           or (cv.supervised and public.is_guardian_of(cv.player_id)))
      and (not cv.supervised or public.guardian_approved(cv.player_id))
      and not public.is_blocked_with_org(cv.player_id, cv.organization_id)
  ) and not exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null);
$$;

create or replace function public.log_audit(p_action text, p_entity text, p_entity_id text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs(actor_id, action, entity, entity_id, data)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_data, '{}'::jsonb));
$$;

-- Las funciones internas no deben poder llamarse desde la API pública.
revoke execute on function public.log_audit(text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Activar RLS en todas las tablas
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------
-- profiles: acceso directo sólo propio/tutor/admin. El resto vía public_profiles.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.is_guardian_of(id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin() or public.is_guardian_of(id))
  with check (id = auth.uid() or public.is_admin() or public.is_guardian_of(id));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check (user_id = auth.uid() and role <> 'guardian');
create policy user_roles_delete on public.user_roles for delete to authenticated
  using (user_id = auth.uid());

create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

-- player_profiles
create policy player_profiles_select on public.player_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_guardian_of(user_id));
create policy player_profiles_insert on public.player_profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy player_profiles_update on public.player_profiles for update to authenticated
  using (user_id = auth.uid() or public.is_guardian_of(user_id) or public.is_admin())
  with check (user_id = auth.uid() or public.is_guardian_of(user_id) or public.is_admin());
create policy player_profiles_delete on public.player_profiles for delete to authenticated
  using (user_id = auth.uid());

-- Perfiles profesionales (adultos): visibles a usuarios autenticados
create policy coach_profiles_select on public.coach_profiles for select to authenticated using (true);
create policy coach_profiles_write on public.coach_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy agent_profiles_select on public.agent_profiles for select to authenticated using (true);
create policy agent_profiles_write on public.agent_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy scout_profiles_select on public.scout_profiles for select to authenticated using (true);
create policy scout_profiles_write on public.scout_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy agent_repr_select on public.agent_representations for select to authenticated
  using (agent_id = auth.uid() or player_id = auth.uid() or public.is_guardian_of(player_id) or public.is_admin());
create policy agent_repr_insert on public.agent_representations for insert to authenticated
  with check (agent_id = auth.uid() and public.has_role('agent') and status = 'pending');
create policy agent_repr_update on public.agent_representations for update to authenticated
  using (agent_id = auth.uid() or player_id = auth.uid() or public.is_guardian_of(player_id));

-- organizations
create policy organizations_select on public.organizations for select to authenticated
  using (suspended_at is null or public.is_org_member(id) or public.is_admin());
create policy organizations_insert on public.organizations for insert to authenticated
  with check (created_by = auth.uid());
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_org_admin(id) or public.is_admin())
  with check (public.is_org_admin(id) or public.is_admin());
create policy organizations_delete on public.organizations for delete to authenticated
  using (public.is_admin() or exists (select 1 from public.organization_members
         where organization_id = id and user_id = auth.uid() and role = 'owner'));

create policy org_members_select on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id) or public.is_admin());
create policy org_members_insert on public.organization_members for insert to authenticated
  with check (public.is_org_admin(organization_id) and role <> 'owner');
create policy org_members_update on public.organization_members for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy org_members_delete on public.organization_members for delete to authenticated
  using ((public.is_org_admin(organization_id) and role <> 'owner') or (user_id = auth.uid() and role <> 'owner'));

create policy clubs_select on public.clubs for select to authenticated using (true);
create policy clubs_write on public.clubs for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy academies_select on public.academies for select to authenticated using (true);
create policy academies_write on public.academies for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy team_profiles_select on public.team_profiles for select to authenticated using (true);
create policy team_profiles_write on public.team_profiles for all to authenticated
  using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

-- Trayectoria / estadísticas / media
create policy careers_select on public.player_careers for select to authenticated using (public.can_view_player(player_id));
create policy careers_write on public.player_careers for all to authenticated
  using (player_id = auth.uid() or public.is_guardian_of(player_id))
  with check (player_id = auth.uid() or public.is_guardian_of(player_id));
create policy stats_select on public.player_statistics for select to authenticated using (public.can_view_player(player_id));
create policy stats_write on public.player_statistics for all to authenticated
  using (player_id = auth.uid() or public.is_admin())
  with check (player_id = auth.uid() or public.is_admin());
create policy media_select on public.media_assets for select to authenticated
  using ((organization_id is not null) or public.can_view_player(owner_id));
create policy media_write on public.media_assets for all to authenticated
  using (owner_id = auth.uid() or (organization_id is not null and public.is_org_member(organization_id)))
  with check (owner_id = auth.uid() and (organization_id is null or public.is_org_member(organization_id)));

-- Oportunidades
create policy opportunities_select on public.opportunities for select to authenticated
  using (
    public.is_org_member(organization_id) or public.is_admin()
    or (status in ('open','closed','expired')
        and exists (select 1 from public.organizations o where o.id = organization_id and o.suspended_at is null))
  );
create policy opportunities_insert on public.opportunities for insert to authenticated
  with check (public.is_org_member(organization_id) and created_by = auth.uid());
create policy opportunities_update on public.opportunities for update to authenticated
  using (public.is_org_member(organization_id) or public.is_admin())
  with check (public.is_org_member(organization_id) or public.is_admin());
create policy opportunities_delete on public.opportunities for delete to authenticated
  using (public.is_org_admin(organization_id));

create policy opp_req_select on public.opportunity_requirements for select to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id));
create policy opp_req_write on public.opportunity_requirements for all to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.is_org_member(o.organization_id)))
  with check (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.is_org_member(o.organization_id)));

-- Candidaturas
create policy applications_select on public.applications for select to authenticated
  using (applicant_id = auth.uid() or public.is_org_member(organization_id)
         or public.is_guardian_of(applicant_id) or public.is_admin());
create policy applications_insert on public.applications for insert to authenticated
  with check (
    applicant_id = auth.uid()
    and public.player_contactable(auth.uid())
    and not public.is_blocked_with_org(auth.uid(), organization_id)
    and exists (select 1 from public.opportunities o
                where o.id = opportunity_id and o.status = 'open'
                  and (o.deadline is null or o.deadline >= current_date))
  );
create policy applications_update on public.applications for update to authenticated
  using (applicant_id = auth.uid() or public.is_org_member(organization_id))
  with check (applicant_id = auth.uid() or public.is_org_member(organization_id));

create policy app_history_select on public.application_status_history for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id));

create policy app_notes_all on public.application_notes for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id) and author_id = auth.uid()
              and exists (select 1 from public.applications a where a.id = application_id and a.organization_id = application_notes.organization_id));

-- Intereses
create policy interests_select on public.interests for select to authenticated
  using (
    actor_id = auth.uid()
    or (actor_org_id is not null and public.is_org_member(actor_org_id))
    or public.is_admin()
    or (kind <> 'pass' and (
          target_user_id = auth.uid()
          or (target_org_id is not null and public.is_org_member(target_org_id))
          or (target_opportunity_id is not null and exists (
                select 1 from public.opportunities o where o.id = target_opportunity_id and public.is_org_member(o.organization_id)))
    ))
  );
create policy interests_insert on public.interests for insert to authenticated
  with check (
    actor_id = auth.uid()
    and not exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null)
    and (
      -- Una organización muestra interés por un futbolista visible
      (target_type = 'player' and actor_org_id is not null and public.is_org_member(actor_org_id)
        and public.can_view_player(target_user_id))
      or
      -- Un futbolista muestra interés por un club / oportunidad
      (target_type in ('organization','opportunity') and actor_org_id is null
        and exists (select 1 from public.player_profiles where user_id = auth.uid())
        and (kind = 'pass' or public.player_contactable(auth.uid())))
    )
  );
-- Deshacer: sólo descartes recientes (los "me interesa" no se retiran en silencio).
create policy interests_delete on public.interests for delete to authenticated
  using (actor_id = auth.uid() and kind = 'pass' and created_at > now() - interval '10 minutes');

-- Matches: escritura sólo por trigger
create policy matches_select on public.matches for select to authenticated
  using (player_id = auth.uid() or public.is_org_member(organization_id)
         or public.is_guardian_of(player_id) or public.is_admin());

-- Favoritos y preferencias
create policy favorites_all on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_searches_all on public.saved_searches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy discover_prefs_all on public.discover_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Conversaciones y mensajes
create policy conversations_select on public.conversations for select to authenticated
  using (public.can_access_conversation(id));
create policy conv_members_select on public.conversation_members for select to authenticated
  using (user_id = auth.uid() or public.can_access_conversation(conversation_id));
create policy conv_members_update on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy messages_select on public.messages for select to authenticated
  using (public.can_access_conversation(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and kind in ('text','file','profile_link','trial_proposal')
              and public.can_send_message(conversation_id)
              and (kind <> 'trial_proposal' or exists (
                    select 1 from public.conversations c where c.id = conversation_id and public.is_org_member(c.organization_id))));
create policy messages_update on public.messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- Trials
create policy trials_select on public.trials for select to authenticated
  using (status <> 'draft' or public.is_org_member(organization_id) or public.is_admin());
create policy trials_write on public.trials for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy trial_apps_select on public.trial_applications for select to authenticated
  using (player_id = auth.uid() or public.is_org_member(organization_id)
         or public.is_guardian_of(player_id) or public.is_admin());
create policy trial_apps_insert on public.trial_applications for insert to authenticated
  with check (
    player_id = auth.uid() and public.player_contactable(auth.uid())
    and not public.is_blocked_with_org(auth.uid(), organization_id)
    and exists (select 1 from public.trials t where t.id = trial_id and t.status = 'open' and t.starts_at > now())
  );
create policy trial_apps_update on public.trial_applications for update to authenticated
  using (player_id = auth.uid() or public.is_org_member(organization_id))
  with check (player_id = auth.uid() or public.is_org_member(organization_id));

-- Evaluaciones: privadas por defecto
create policy evaluations_select on public.evaluations for select to authenticated
  using (public.is_org_member(organization_id) or (shared_with_player and (player_id = auth.uid() or public.is_guardian_of(player_id))));
create policy evaluations_write on public.evaluations for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id) and author_id = auth.uid());

-- Scouting
create policy talent_lists_select on public.talent_lists for select to authenticated
  using (owner_id = auth.uid() or (shared_with_org and organization_id is not null and public.is_org_member(organization_id)));
create policy talent_lists_write on public.talent_lists for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and (organization_id is null or public.is_org_member(organization_id)));
create policy talent_items_select on public.talent_list_items for select to authenticated
  using (exists (select 1 from public.talent_lists l where l.id = list_id));
create policy talent_items_write on public.talent_list_items for all to authenticated
  using (exists (select 1 from public.talent_lists l where l.id = list_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.talent_lists l where l.id = list_id and l.owner_id = auth.uid()) and public.can_view_player(player_id));

-- Notificaciones: propias
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Planes y suscripciones (lectura; escritura sólo desde el proveedor de pagos con service role)
create policy plans_select on public.plans for select to anon, authenticated using (active);
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or (organization_id is not null and public.is_org_member(organization_id)) or public.is_admin());

-- Verificaciones
create policy verif_select on public.verification_requests for select to authenticated
  using (requested_by = auth.uid() or public.is_admin()
         or (organization_id is not null and public.is_org_member(organization_id)));
create policy verif_insert on public.verification_requests for insert to authenticated
  with check (requested_by = auth.uid() and (
    (subject = 'organization' and organization_id is not null and public.is_org_admin(organization_id))
    or (subject <> 'organization' and user_id = auth.uid())
  ));
create policy verif_update on public.verification_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Tutores legales
create policy guardian_select on public.guardian_relationships for select to authenticated
  using (minor_id = auth.uid() or guardian_id = auth.uid() or public.is_admin()
         or guardian_email = (auth.jwt() ->> 'email')::citext);
create policy guardian_insert on public.guardian_relationships for insert to authenticated
  with check (minor_id = auth.uid() and status = 'pending' and guardian_id is null);
create policy guardian_delete on public.guardian_relationships for delete to authenticated
  using (minor_id = auth.uid() and status = 'pending');

create policy consents_select on public.legal_consents for select to authenticated
  using (user_id = auth.uid() or granted_by = auth.uid() or public.is_admin() or public.is_guardian_of(user_id));
create policy consents_insert on public.legal_consents for insert to authenticated
  with check (granted_by = auth.uid() and (user_id = auth.uid() or public.is_guardian_of(user_id))
              and consent_type <> 'guardian_authorization');

-- Bloqueos y reportes
create policy blocks_all on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
create policy reports_update on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy audit_select on public.audit_logs for select to authenticated using (public.is_admin());

create policy matching_criteria_select on public.matching_criteria for select to authenticated using (true);
create policy matching_criteria_update on public.matching_criteria for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy app_settings_select on public.app_settings for select to anon, authenticated using (true);
create policy app_settings_write on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Vistas enmascaradas (se ejecutan con permisos del propietario y filtran
-- explícitamente con can_view_player; nunca exponen fecha de nacimiento
-- ni ciudad exacta de menores).
-- ---------------------------------------------------------------------
create or replace view public.public_profiles with (security_invoker = false) as
select
  p.id,
  case when public.user_is_minor(p.id) and not (p.id = auth.uid() or public.is_guardian_of(p.id) or public.is_admin())
       then split_part(p.full_name, ' ', 1) ||
            coalesce(' ' || nullif(left(split_part(p.full_name, ' ', 2), 1), '') || '.', '')
       else p.full_name end as display_name,
  p.avatar_path,
  p.primary_role,
  p.country,
  p.region,
  case when public.user_is_minor(p.id) and not (p.id = auth.uid() or public.is_guardian_of(p.id) or public.is_admin())
       then null else p.city end as city,
  case when p.birth_date is null then null else extract(year from age(p.birth_date))::int end as age,
  public.user_is_minor(p.id) as is_minor,
  p.is_demo
from public.profiles p
where p.deleted_at is null
  and auth.uid() is not null
  and (
    p.id = auth.uid()
    or (exists (select 1 from public.player_profiles pp where pp.user_id = p.id) and public.can_view_player(p.id))
    or (not exists (select 1 from public.player_profiles pp where pp.user_id = p.id) and not public.is_blocked_between(auth.uid(), p.id))
  );

create or replace view public.player_cards with (security_invoker = false) as
select
  pp.user_id,
  pub.display_name,
  pub.avatar_path,
  pub.age,
  pub.is_minor,
  pub.country,
  pub.region,
  pub.city,
  pp.nationality,
  pp.position,
  pp.secondary_positions,
  pp.height_cm,
  pp.weight_kg,
  pp.dominant_foot,
  pp.current_club,
  pp.category,
  pp.experience_years,
  pp.languages,
  pp.availability,
  pp.mobility,
  pp.willing_to_relocate,
  pp.goals,
  pp.bio,
  pp.strengths,
  pp.visibility,
  pp.allow_agent_contact,
  pp.is_demo,
  pp.updated_at
from public.player_profiles pp
join public.public_profiles pub on pub.id = pp.user_id;

-- Las vistas se ejecutan como propietario: sólo lectura (nunca INSERT/UPDATE a través de ellas).
revoke all on public.public_profiles, public.player_cards from public, anon, authenticated;
grant select on public.public_profiles, public.player_cards to authenticated;

-- ---------------------------------------------------------------------
-- Protección de columnas privilegiadas
-- ---------------------------------------------------------------------
create or replace function public.guard_profiles() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() or current_setting('footmatch.internal', true) = 'on' then
    return new;
  end if;
  if new.is_demo is distinct from old.is_demo
     or new.suspended_at is distinct from old.suspended_at
     or new.deleted_at is distinct from old.deleted_at
     or new.id is distinct from old.id then
    raise exception 'FOOTMATCH: columna protegida' using errcode = '42501';
  end if;
  -- La fecha de nacimiento de un menor sólo puede corregirla su tutor o un admin.
  if new.birth_date is distinct from old.birth_date and old.birth_date is not null
     and public.guardian_approved(old.id) and not public.is_guardian_of(old.id) then
    raise exception 'FOOTMATCH: la fecha de nacimiento sólo puede cambiarla el tutor legal' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profiles();

create or replace function public.guard_is_demo_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.is_demo := false;
  end if;
  return new;
end $$;
create trigger player_profiles_demo_guard before insert or update on public.player_profiles for each row execute function public.guard_is_demo_insert();
create trigger organizations_demo_guard before insert on public.organizations for each row execute function public.guard_is_demo_insert();
create trigger opportunities_demo_guard before insert on public.opportunities for each row execute function public.guard_is_demo_insert();
create trigger trials_demo_guard before insert on public.trials for each row execute function public.guard_is_demo_insert();

create or replace function public.guard_organizations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.verification_status := 'unverified';
    new.suspended_at := null;
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.suspended_at is distinct from old.suspended_at
     or new.is_demo is distinct from old.is_demo
     or new.created_by is distinct from old.created_by then
    raise exception 'FOOTMATCH: sólo un administrador puede verificar o suspender organizaciones' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger organizations_guard before insert or update on public.organizations for each row execute function public.guard_organizations();

create or replace function public.guard_agent_profiles() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.verification_status := 'unverified'; return new; end if;
  if new.verification_status is distinct from old.verification_status then
    raise exception 'FOOTMATCH: la verificación de agentes la realiza un administrador' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger agent_profiles_guard before insert or update on public.agent_profiles for each row execute function public.guard_agent_profiles();

create or replace function public.guard_player_statistics() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  -- Un jugador sólo puede declarar estadísticas; la verificación es externa.
  new.source := 'declared';
  new.verified_by := null;
  return new;
end $$;
create trigger player_statistics_guard before insert or update on public.player_statistics for each row execute function public.guard_player_statistics();

create or replace function public.guard_applications() returns trigger
language plpgsql security definer set search_path = '' as $$
declare org uuid;
begin
  if tg_op = 'INSERT' then
    select organization_id into org from public.opportunities where id = new.opportunity_id;
    new.organization_id := org;
    new.status := 'received';
    new.assigned_to := null;
    return new;
  end if;
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.opportunity_id is distinct from old.opportunity_id
     or new.applicant_id is distinct from old.applicant_id
     or new.organization_id is distinct from old.organization_id then
    raise exception 'FOOTMATCH: no se puede reasignar una candidatura' using errcode = '42501';
  end if;
  if public.is_org_member(old.organization_id) then
    if new.message is distinct from old.message then
      raise exception 'FOOTMATCH: el club no puede editar el mensaje del candidato' using errcode = '42501';
    end if;
    if new.status = 'withdrawn' and old.status <> 'withdrawn' then
      raise exception 'FOOTMATCH: sólo el candidato puede retirar su candidatura' using errcode = '42501';
    end if;
    if new.assigned_to is not null and not exists (
         select 1 from public.organization_members where organization_id = old.organization_id and user_id = new.assigned_to) then
      raise exception 'FOOTMATCH: el responsable debe pertenecer a la organización' using errcode = '22023';
    end if;
    return new;
  end if;
  -- Candidato: sólo puede retirar la candidatura
  if new.assigned_to is distinct from old.assigned_to
     or (new.status is distinct from old.status and new.status <> 'withdrawn') then
    raise exception 'FOOTMATCH: el candidato sólo puede retirar su candidatura' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger applications_guard before insert or update on public.applications for each row execute function public.guard_applications();

create or replace function public.guard_trial_applications() returns trigger
language plpgsql security definer set search_path = '' as $$
declare org uuid;
begin
  if tg_op = 'INSERT' then
    select organization_id into org from public.trials where id = new.trial_id;
    new.organization_id := org;
    new.status := 'sent';
    return new;
  end if;
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.trial_id is distinct from old.trial_id or new.player_id is distinct from old.player_id
     or new.organization_id is distinct from old.organization_id then
    raise exception 'FOOTMATCH: no se puede reasignar una inscripción' using errcode = '42501';
  end if;
  if public.is_org_member(old.organization_id) then
    if new.status = 'withdrawn' and old.status <> 'withdrawn' then
      raise exception 'FOOTMATCH: sólo el jugador puede retirarse' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and new.status <> 'withdrawn' then
    raise exception 'FOOTMATCH: el jugador sólo puede retirar su inscripción' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trial_applications_guard before insert or update on public.trial_applications for each row execute function public.guard_trial_applications();

create or replace function public.guard_verification_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := 'pending';
    new.reviewer_id := null;
    new.reviewer_note := null;
    new.reviewed_at := null;
  end if;
  return new;
end $$;
create trigger verification_requests_guard before insert on public.verification_requests for each row execute function public.guard_verification_requests();

create or replace function public.guard_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.deleted_at := null;
    return new;
  end if;
  -- Sólo se permite el borrado lógico por parte del remitente
  if new.body is distinct from old.body or new.kind is distinct from old.kind
     or new.conversation_id is distinct from old.conversation_id or new.sender_id is distinct from old.sender_id
     or new.metadata is distinct from old.metadata or new.attachment_path is distinct from old.attachment_path then
    raise exception 'FOOTMATCH: los mensajes no se pueden editar' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger messages_guard before insert or update on public.messages for each row execute function public.guard_messages();

create or replace function public.guard_opportunities() returns trigger
language plpgsql as $$
begin
  if new.deadline is not null and new.deadline < current_date and new.status = 'open' then
    new.status := 'expired';
  end if;
  return new;
end $$;
create trigger opportunities_guard before insert or update on public.opportunities for each row execute function public.guard_opportunities();
