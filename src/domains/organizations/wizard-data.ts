import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/lib/session";
import type { OrgWizardInitial } from "@/components/onboarding/org-wizard";

export async function loadOrgWizardInitial(supabase: SupabaseClient, s: Session, step: number): Promise<OrgWizardInitial> {
  const org = s.activeOrg?.organization ?? null;
  const [teams, verification, club, member] = org
    ? await Promise.all([
        supabase.from("team_profiles").select("id, name, category").eq("organization_id", org.id),
        supabase.from("verification_requests").select("id").eq("organization_id", org.id).eq("status", "pending").limit(1),
        supabase.from("clubs").select("founded_year").eq("organization_id", org.id).maybeSingle(),
        supabase.from("organization_members").select("title").eq("organization_id", org.id).eq("user_id", s.userId).maybeSingle(),
      ])
    : [{ data: [] }, { data: [] }, { data: null }, { data: null }];
  return {
    step,
    hasOrg: Boolean(org),
    teams: (teams.data ?? []) as Array<{ id: string; name: string; category: string | null }>,
    verificationRequested: Boolean(verification.data?.length) || org?.verification_status === "verified",
    values: {
      type: org?.type ?? (s.profile.primary_role === "academy" ? "academy" : "club"),
      name: org?.name ?? "",
      description: org?.description ?? "",
      founded_year: (club.data as { founded_year?: number } | null)?.founded_year ?? "",
      country: org?.country ?? "ES",
      region: org?.region ?? "",
      city: org?.city ?? "",
      facilities: org?.facilities ?? "",
      website: org?.website ?? "",
      contact_email: org?.contact_email ?? s.email ?? "",
      competition: org?.competition ?? "",
      categories: org?.categories ?? [],
      full_name: s.profile.full_name,
      title: (member.data as { title?: string } | null)?.title ?? "",
      birth_date: s.profile.birth_date ?? "",
    },
  };
}
