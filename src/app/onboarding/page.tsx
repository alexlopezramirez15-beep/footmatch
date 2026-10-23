import { redirect } from "next/navigation";
import { RolePicker } from "@/components/onboarding/role-picker";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const s = await requireSession();
  if (s.profile.onboarding_completed) redirect("/home");
  const role = s.profile.primary_role;
  if (role) redirect(`/onboarding/${role === "academy" || role === "club" ? "club" : role === "player" ? "player" : `pro?role=${role}`}`);
  return <RolePicker />;
}
