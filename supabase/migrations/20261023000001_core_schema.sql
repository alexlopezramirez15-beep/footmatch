-- =====================================================================
-- FOOTMATCH · Core schema
-- Tablas, tipos, índices y restricciones. Las políticas RLS y funciones
-- de autorización viven en 20261023000002_security.sql.
-- =====================================================================

-- En Supabase las extensiones viven en el esquema "extensions", nunca en public.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.app_role as enum ('player','club','coach','agent','scout','academy','guardian');
create type public.org_type as enum ('club','academy','agency');
create type public.org_member_role as enum ('owner','admin','staff','scout');
create type public.verification_status as enum ('unverified','pending','verified','rejected');
create type public.availability_status as enum ('seeking_club','open_to_offers','seeking_trial','seeking_agent','unavailable');
create type public.dominant_foot as enum ('right','left','both');
create type public.mobility_scope as enum ('city','region','country','international');
create type public.profile_visibility as enum ('public','clubs_only','hidden');
create type public.opportunity_type as enum ('player','coach','staff','trial','campus','program','scouting_call');
create type public.opportunity_status as enum ('draft','open','closed','suspended','expired');
create type public.application_status as enum ('received','reviewed','shortlisted','contacted','trial_scheduled','evaluating','selected','rejected','withdrawn');
create type public.interest_target as enum ('player','organization','opportunity');
create type public.interest_kind as enum ('like','pass','superlike');
create type public.trial_status as enum ('draft','open','full','closed','completed','cancelled');
create type public.trial_application_status as enum ('sent','pending','accepted','waitlist','rejected','attended','evaluated','withdrawn');
create type public.guardian_status as enum ('pending','approved','revoked','rejected');
create type public.report_status as enum ('open','reviewing','resolved','dismissed');
create type public.report_target as enum ('user','organization','opportunity','message','conversation');
create type public.subscription_plan as enum ('free','player_pro','club_pro','agency_pro','academy_pro');
create type public.subscription_status as enum ('inactive','trialing','active','past_due','canceled');
create type public.message_kind as enum ('text','file','profile_link','trial_proposal','system');
create type public.stat_source as enum ('declared','verified');
create type public.media_kind as enum ('photo','video_highlight','video_match','video_clip','document');
create type public.verification_subject as enum ('organization','agent','coach','player');
create type public.match_status as enum ('active','archived','closed');

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Usuarios y perfiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  birth_date date check (birth_date is null or (birth_date > date '1920-01-01' and birth_date < current_date)),
  country char(2),
  region text check (char_length(region) <= 80),
  city text check (char_length(city) <= 80),
  avatar_path text,
  primary_role public.app_role,
  locale text not null default 'es' check (locale in ('es','ca','en','pl')),
  onboarding_step int not null default 0,
  onboarding_completed boolean not null default false,
  onboarding_draft jsonb not null default '{}'::jsonb,
  notification_prefs jsonb not null default '{"email":true,"matches":true,"messages":true,"applications":true,"opportunities":true}'::jsonb,
  read_receipts boolean not null default true,
  is_demo boolean not null default false,
  suspended_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Superadministradores: tabla separada, sólo modificable con service role.
create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.player_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  position text not null default 'ST',
  secondary_positions text[] not null default '{}',
  height_cm int check (height_cm between 100 and 230),
  weight_kg int check (weight_kg between 25 and 150),
  dominant_foot public.dominant_foot,
  current_club text check (char_length(current_club) <= 120),
  category text,                -- clave del catálogo de competiciones (src/domains/football/catalog.ts)
  experience_years int not null default 0 check (experience_years between 0 and 40),
  languages text[] not null default '{}',
  nationality char(2),
  availability public.availability_status not null default 'seeking_club',
  mobility public.mobility_scope not null default 'region',
  willing_to_relocate boolean not null default false,
  goals text check (char_length(goals) <= 1000),
  bio text check (char_length(bio) <= 1000),
  strengths text[] not null default '{}',
  visibility public.profile_visibility not null default 'clubs_only',
  allow_agent_contact boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger player_profiles_touch before update on public.player_profiles for each row execute function public.touch_updated_at();
create index player_profiles_position_idx on public.player_profiles(position);
create index player_profiles_category_idx on public.player_profiles(category);

create table public.coach_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  licenses text[] not null default '{}',     -- p.ej. UEFA_C, UEFA_B, UEFA_A, UEFA_PRO
  experience_years int not null default 0 check (experience_years between 0 and 60),
  categories text[] not null default '{}',
  methodology text check (char_length(methodology) <= 2000),
  specialties text[] not null default '{}',
  languages text[] not null default '{}',
  availability public.availability_status not null default 'open_to_offers',
  previous_teams text[] not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger coach_profiles_touch before update on public.coach_profiles for each row execute function public.touch_updated_at();

create table public.agent_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  agency_name text check (char_length(agency_name) <= 120),
  license_number text check (char_length(license_number) <= 60),
  license_authority text check (char_length(license_authority) <= 60), -- p.ej. FIFA, RFEF
  verification_status public.verification_status not null default 'unverified',
  languages text[] not null default '{}',
  markets text[] not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger agent_profiles_touch before update on public.agent_profiles for each row execute function public.touch_updated_at();

create table public.scout_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  regions text[] not null default '{}',
  focus_positions text[] not null default '{}',
  organization_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Representación de agentes: el jugador debe aprobarla expresamente.
create table public.agent_representations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  status public.guardian_status not null default 'pending',
  document_path text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (agent_id, player_id)
);

-- ---------------------------------------------------------------------
-- Organizaciones
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.org_type not null,
  name text not null check (char_length(name) between 2 and 120),
  slug text unique,
  crest_path text,
  country char(2),
  region text,
  city text,
  description text check (char_length(description) <= 3000),
  website text,
  contact_email text,
  facilities text check (char_length(facilities) <= 1000),
  competition text,
  categories text[] not null default '{}',
  verification_status public.verification_status not null default 'unverified',
  suspended_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations for each row execute function public.touch_updated_at();
create index organizations_type_idx on public.organizations(type);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.org_member_role not null default 'staff',
  title text,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

alter table public.scout_profiles
  add constraint scout_profiles_org_fk foreign key (organization_id) references public.organizations(id) on delete set null;

create table public.clubs (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  founded_year int check (founded_year between 1850 and 2100),
  stadium text,
  federation text,
  created_at timestamptz not null default now()
);

create table public.academies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  programs text[] not null default '{}',
  accommodation boolean not null default false,
  international boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.team_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  gender text check (gender in ('male','female','mixed')),
  competition text,
  created_at timestamptz not null default now()
);
create index team_profiles_org_idx on public.team_profiles(organization_id);

-- ---------------------------------------------------------------------
-- Trayectoria, estadísticas y media
-- ---------------------------------------------------------------------
create table public.player_careers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  club_name text not null check (char_length(club_name) <= 120),
  season text not null check (season ~ '^[0-9]{4}(/[0-9]{2,4})?$'),
  category text,
  role_note text check (char_length(role_note) <= 200),
  created_at timestamptz not null default now()
);
create index player_careers_player_idx on public.player_careers(player_id);

create table public.player_statistics (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  season text not null check (season ~ '^[0-9]{4}(/[0-9]{2,4})?$'),
  competition text,
  matches int check (matches >= 0),
  minutes int check (minutes >= 0),
  goals int check (goals >= 0),
  assists int check (assists >= 0),
  clean_sheets int check (clean_sheets >= 0),
  source public.stat_source not null default 'declared',
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index player_statistics_player_idx on public.player_statistics(player_id);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  kind public.media_kind not null,
  storage_path text,
  external_url text check (external_url is null or external_url ~ '^https://'),
  title text check (char_length(title) <= 120),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);
create index media_assets_owner_idx on public.media_assets(owner_id);

-- ---------------------------------------------------------------------
-- Oportunidades y candidaturas
-- ---------------------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  type public.opportunity_type not null default 'player',
  title text not null check (char_length(title) between 4 and 140),
  description text check (char_length(description) <= 5000),
  country char(2),
  region text,
  city text,
  category text,
  positions text[] not null default '{}',
  age_min int check (age_min between 4 and 60),
  age_max int check (age_max between 4 and 60),
  languages text[] not null default '{}',
  conditions text check (char_length(conditions) <= 2000),
  slots int check (slots > 0),
  starts_on date,
  deadline date,
  status public.opportunity_status not null default 'open',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_min is null or age_max is null or age_min <= age_max)
);
create trigger opportunities_touch before update on public.opportunities for each row execute function public.touch_updated_at();
create index opportunities_org_idx on public.opportunities(organization_id);
create index opportunities_status_idx on public.opportunities(status, deadline);

-- Requisitos configurables: obligatorios (excluyentes) o preferentes (ponderados).
create table public.opportunity_requirements (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  criterion text not null check (criterion in ('position','age','category','experience','location','mobility','availability','languages','foot','height')),
  mandatory boolean not null default false,
  weight int not null default 10 check (weight between 0 and 100),
  value jsonb not null default '{}'::jsonb,
  unique (opportunity_id, criterion)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  status public.application_status not null default 'received',
  message text check (char_length(message) <= 2000),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, applicant_id)
);
create trigger applications_touch before update on public.applications for each row execute function public.touch_updated_at();
create index applications_org_idx on public.applications(organization_id, status);
create index applications_applicant_idx on public.applications(applicant_id);

create table public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index application_status_history_app_idx on public.application_status_history(application_id);

-- Notas internas: nunca visibles para el candidato.
create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index application_notes_app_idx on public.application_notes(application_id);

-- ---------------------------------------------------------------------
-- Intereses, matches y favoritos
-- ---------------------------------------------------------------------
create table public.interests (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  actor_org_id uuid references public.organizations(id) on delete cascade,
  target_type public.interest_target not null,
  target_user_id uuid references public.profiles(id) on delete cascade,
  target_org_id uuid references public.organizations(id) on delete cascade,
  target_opportunity_id uuid references public.opportunities(id) on delete cascade,
  kind public.interest_kind not null,
  created_at timestamptz not null default now(),
  actor_key uuid generated always as (coalesce(actor_org_id, actor_id)) stored,
  target_key uuid generated always as (coalesce(target_user_id, target_org_id, target_opportunity_id)) stored,
  check (
    (target_type = 'player' and target_user_id is not null and target_org_id is null and target_opportunity_id is null) or
    (target_type = 'organization' and target_org_id is not null and target_user_id is null and target_opportunity_id is null) or
    (target_type = 'opportunity' and target_opportunity_id is not null and target_user_id is null and target_org_id is null)
  )
);
create unique index interests_unique on public.interests(actor_key, target_type, target_key);
create index interests_target_user_idx on public.interests(target_user_id) where target_user_id is not null;
create index interests_target_org_idx on public.interests(target_org_id) where target_org_id is not null;
create index interests_target_opp_idx on public.interests(target_opportunity_id) where target_opportunity_id is not null;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  status public.match_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (player_id, organization_id)
);
create index matches_org_idx on public.matches(organization_id);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.interest_target not null,
  target_user_id uuid references public.profiles(id) on delete cascade,
  target_org_id uuid references public.organizations(id) on delete cascade,
  target_opportunity_id uuid references public.opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  target_key uuid generated always as (coalesce(target_user_id, target_org_id, target_opportunity_id)) stored,
  check (num_nonnulls(target_user_id, target_org_id, target_opportunity_id) = 1)
);
create unique index favorites_unique on public.favorites(user_id, target_type, target_key);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  scope text not null check (scope in ('players','coaches','opportunities')),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.discover_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  filters jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Mensajería
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid unique references public.matches(id) on delete set null,
  application_id uuid unique references public.applications(id) on delete set null,
  player_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supervised boolean not null default false,  -- conversación con menor: tutor incluido
  blocked_at timestamptz,
  blocked_by uuid references public.profiles(id),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index conversations_pair_idx on public.conversations(player_id, organization_id);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  archived boolean not null default false,
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members(user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind public.message_kind not null default 'text',
  body text check (char_length(body) <= 4000),
  attachment_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (body is not null or attachment_path is not null or kind in ('trial_proposal','profile_link','system'))
);
create index messages_conversation_idx on public.messages(conversation_id, created_at desc);

-- ---------------------------------------------------------------------
-- Trials y evaluaciones
-- ---------------------------------------------------------------------
create table public.trials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 4 and 140),
  description text check (char_length(description) <= 4000),
  location text,
  city text,
  country char(2),
  starts_at timestamptz not null,
  ends_at timestamptz,
  category text,
  positions text[] not null default '{}',
  age_min int,
  age_max int,
  slots int check (slots > 0),
  requirements text,
  documentation text,
  cost_info text,
  instructions text,
  status public.trial_status not null default 'open',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trials_touch before update on public.trials for each row execute function public.touch_updated_at();
create index trials_org_idx on public.trials(organization_id);
create index trials_starts_idx on public.trials(starts_at);

create table public.trial_applications (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  status public.trial_application_status not null default 'sent',
  message text check (char_length(message) <= 1000),
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trial_id, player_id)
);
create trigger trial_applications_touch before update on public.trial_applications for each row execute function public.touch_updated_at();

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  trial_application_id uuid references public.trial_applications(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  ratings jsonb not null default '{}'::jsonb,
  summary text check (char_length(summary) <= 4000),
  next_steps text check (char_length(next_steps) <= 1000),
  shared_with_player boolean not null default false,
  created_at timestamptz not null default now()
);

-- Scouting: listas y notas privadas
create table public.talent_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  shared_with_org boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.talent_list_items (
  list_id uuid not null references public.talent_lists(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  primary key (list_id, player_id)
);

-- ---------------------------------------------------------------------
-- Notificaciones
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Suscripciones (arquitectura preparada; sin cobros habilitados)
-- ---------------------------------------------------------------------
create table public.plans (
  id public.subscription_plan primary key,
  name text not null,
  audience public.app_role[] not null default '{}',
  limits jsonb not null default '{}'::jsonb,
  features text[] not null default '{}',
  price_cents int,              -- null = precio no publicado
  currency char(3) default 'EUR',
  active boolean not null default true
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  plan public.subscription_plan not null default 'free' references public.plans(id),
  status public.subscription_status not null default 'inactive',
  provider text,               -- 'stripe' cuando se integre
  provider_ref text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(user_id, organization_id) = 1)
);

-- ---------------------------------------------------------------------
-- Verificación, menores, consentimientos
-- ---------------------------------------------------------------------
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  subject public.verification_subject not null,
  user_id uuid references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status public.verification_status not null default 'pending',
  evidence text check (char_length(evidence) <= 2000),
  document_path text,
  reviewer_id uuid references public.profiles(id),
  reviewer_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.guardian_relationships (
  id uuid primary key default gen_random_uuid(),
  minor_id uuid not null references public.profiles(id) on delete cascade,
  guardian_id uuid references public.profiles(id) on delete cascade,
  guardian_email extensions.citext not null,
  guardian_name text,
  relationship text check (relationship in ('mother','father','legal_guardian','other')),
  status public.guardian_status not null default 'pending',
  token uuid not null default gen_random_uuid() unique,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (minor_id, guardian_email)
);

create table public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms','privacy','marketing','guardian_authorization','minor_contact','data_processing')),
  version text not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index legal_consents_user_idx on public.legal_consents(user_id, consent_type);

-- ---------------------------------------------------------------------
-- Moderación y auditoría
-- ---------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  target_org_id uuid references public.organizations(id) on delete set null,
  target_opportunity_id uuid references public.opportunities(id) on delete set null,
  target_message_id uuid references public.messages(id) on delete set null,
  target_conversation_id uuid references public.conversations(id) on delete set null,
  reason text not null check (reason in ('spam','harassment','inappropriate','fake_profile','minor_safety','scam','other')),
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles(id),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity, entity_id);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

-- ---------------------------------------------------------------------
-- Configuración del motor de matching (pesos editables por admin)
-- ---------------------------------------------------------------------
create table public.matching_criteria (
  criterion text primary key check (criterion in ('position','age','category','experience','location','mobility','availability','languages','foot','height')),
  weight int not null check (weight between 0 and 100),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
