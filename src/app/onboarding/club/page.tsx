import { redirect } from "next/navigation";
import { OrgWizard } from "@/components/onboarding/org-wizard";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadOrgWizardInitial } from "@/domains/organizations/wizard-data";

export const metadata = { title: "Perfil de club" };

export default async function ClubOnboarding() {
  const s = await requireSession();
  if (s.profile.onboarding_completed) redirect("/club");
  if (s.profile.primary_role !== "club" && s.profile.primary_role !== "academy") redirect("/onboarding");
  const supabase = await createClient();
  return <OrgWizard initial={await loadOrgWizardInitial(supabase, s, s.profile.onboarding_step || 1)} />;
}
