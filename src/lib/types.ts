// Tipos de filas de Supabase usados por la app (espejo de supabase/migrations).
import type { Availability, Mobility, OpportunityType } from "@/domains/football/catalog";

export type AppRole = "player" | "club" | "coach" | "agent" | "scout" | "academy" | "guardian";
export type OrgType = "club" | "academy" | "agency";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type ApplicationStatusDb =
  | "received" | "reviewed" | "shortlisted" | "contacted" | "trial_scheduled" | "evaluating" | "selected" | "rejected" | "withdrawn";
export type TrialAppStatus = "sent" | "pending" | "accepted" | "waitlist" | "rejected" | "attended" | "evaluated" | "withdrawn";

export interface ProfileRow {
  id: string;
  full_name: string;
  birth_date: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  avatar_path: string | null;
  primary_role: AppRole | null;
  locale: "es" | "ca" | "en" | "pl";
  onboarding_step: number;
  onboarding_completed: boolean;
  onboarding_draft: Record<string, unknown>;
  notification_prefs: Record<string, boolean>;
  read_receipts: boolean;
  is_demo: boolean;
  suspended_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface PublicProfileRow {
  id: string;
  display_name: string;
  avatar_path: string | null;
  primary_role: AppRole | null;
  country: string | null;
  region: string | null;
  city: string | null;
  age: number | null;
  is_minor: boolean;
  is_demo: boolean;
}

export interface PlayerProfileRow {
  user_id: string;
  position: string;
  secondary_positions: string[];
  height_cm: number | null;
  weight_kg: number | null;
  dominant_foot: "right" | "left" | "both" | null;
  current_club: string | null;
  category: string | null;
  experience_years: number;
  languages: string[];
  nationality: string | null;
  availability: Availability;
  mobility: Mobility;
  willing_to_relocate: boolean;
  goals: string | null;
  bio: string | null;
  strengths: string[];
  visibility: "public" | "clubs_only" | "hidden";
  allow_agent_contact: boolean;
  is_demo: boolean;
  updated_at: string;
}

export interface PlayerCardRow extends Omit<PlayerProfileRow, "user_id"> {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  age: number | null;
  is_minor: boolean;
  country: string | null;
  region: string | null;
  city: string | null;
}

export interface OrganizationRow {
  id: string;
  type: OrgType;
  name: string;
  slug: string | null;
  crest_path: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  description: string | null;
  website: string | null;
  contact_email: string | null;
  facilities: string | null;
  competition: string | null;
  categories: string[];
  verification_status: VerificationStatus;
  suspended_at: string | null;
  created_by: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface OpportunityRow {
  id: string;
  organization_id: string;
  created_by: string | null;
  type: OpportunityType;
  title: string;
  description: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  category: string | null;
  positions: string[];
  age_min: number | null;
  age_max: number | null;
  languages: string[];
  conditions: string | null;
  slots: number | null;
  starts_on: string | null;
  deadline: string | null;
  status: "draft" | "open" | "closed" | "suspended" | "expired";
  is_demo: boolean;
  created_at: string;
}

export interface DiscoverOpportunityRow extends Omit<OpportunityRow, "created_by" | "conditions" | "slots"> {
  org_name: string;
  org_crest_path: string | null;
  org_verification: VerificationStatus;
  org_type: OrgType;
}

export interface RequirementRow {
  id?: string;
  opportunity_id?: string;
  criterion: string;
  mandatory: boolean;
  weight: number;
  value: Record<string, unknown>;
}

export interface ApplicationRow {
  id: string;
  opportunity_id: string;
  organization_id: string;
  applicant_id: string;
  status: ApplicationStatusDb;
  message: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  match_id: string | null;
  application_id: string | null;
  player_id: string;
  organization_id: string;
  supervised: boolean;
  blocked_at: string | null;
  blocked_by: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: "text" | "file" | "profile_link" | "trial_proposal" | "system";
  body: string | null;
  attachment_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  deleted_at: string | null;
}

export interface TrialRow {
  id: string;
  organization_id: string;
  opportunity_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  starts_at: string;
  ends_at: string | null;
  category: string | null;
  positions: string[];
  age_min: number | null;
  age_max: number | null;
  slots: number | null;
  requirements: string | null;
  documentation: string | null;
  cost_info: string | null;
  instructions: string | null;
  status: "draft" | "open" | "full" | "closed" | "completed" | "cancelled";
  is_demo: boolean;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
