import { redirect } from "next/navigation";
import { ProForm } from "@/components/onboarding/pro-form";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Perfil profesional" };

export default async function ProOnboarding() {
  const s = await requireSession();
  if (s.profile.onboarding_completed) redirect("/home");
  const role = s.profile.primary_role;
  if (role !== "coach" && role !== "agent" && role !== "scout") redirect("/onboarding");
  const supabase = await createClient();
  const table = role === "coach" ? "coach_profiles" : role === "agent" ? "agent_profiles" : "scout_profiles";
  const { data } = await supabase.from(table).select("*").eq("user_id", s.userId).maybeSingle();
  return (
    <ProForm
      role={role}
      personal={{ full_name: s.profile.full_name, birth_date: s.profile.birth_date ?? "", country: s.profile.country ?? "ES", city: s.profile.city ?? "" }}
      values={(data ?? {}) as Record<string, unknown>}
    />
  );
}
