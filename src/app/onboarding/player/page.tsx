import { redirect } from "next/navigation";
import { PlayerWizard } from "@/components/onboarding/player-wizard";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadPlayerWizardInitial } from "@/domains/profile/wizard-data";

export const metadata = { title: "Perfil de futbolista" };

export default async function PlayerOnboarding() {
  const s = await requireSession();
  if (s.profile.onboarding_completed) redirect("/profile");
  if (s.profile.primary_role !== "player") redirect("/onboarding");
  const supabase = await createClient();
  return <PlayerWizard initial={await loadPlayerWizardInitial(supabase, s, s.profile.onboarding_step || 1)} />;
}
