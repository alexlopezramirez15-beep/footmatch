import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { GlassCard } from "@/components/glass/primitives";
import { TrialForm } from "@/components/trials/trial-form";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";

export const metadata = { title: "Nueva prueba" };

export default async function NewTrialPage(props: PageProps<"/trials/new">) {
  const session = await requireApp();
  const m = session.activeOrg;
  if (!m || m.role === "scout") redirect("/trials");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { t } = await getI18n();
  const org = m.organization;
  const applicationId = typeof sp.application === "string" ? sp.application : null;
  let candidate: string | null = null;
  let opportunityId: string | null = null;
  let positions: string[] = [];
  if (applicationId) {
    const { data: app } = await supabase.from("applications").select("id, applicant_id, opportunity:opportunities(id, positions)").eq("id", applicationId).eq("organization_id", org.id).maybeSingle();
    if (!app) redirect("/club/pipeline");
    const { data: p } = await supabase.from("public_profiles").select("display_name").eq("id", app.applicant_id).maybeSingle();
    candidate = (p?.display_name as string) ?? null;
    const opp = app.opportunity as unknown as { id: string; positions: string[] } | null;
    opportunityId = opp?.id ?? null;
    positions = opp?.positions ?? [];
  }
  const { data: opps } = await supabase.from("opportunities").select("id, title").eq("organization_id", org.id).in("status", ["open", "draft"]);
  return (
    <>
      <GlassNavbar
        title={applicationId ? t("pipeline.proposeTrial") : t("trials.new")}
        subtitle={org.name}
        leading={<Link href={applicationId ? "/club/pipeline" : "/trials"} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"><ArrowLeft className="size-4" /> {t("common.back")}</Link>}
      />
      <GlassCard material="regular" className="mb-6">
        <TrialForm
          defaults={{ country: org.country, city: org.city, category: org.competition ?? org.categories?.[0] ?? null, opportunityId, positions }}
          applicationId={applicationId}
          candidateName={candidate}
          opportunities={(opps ?? []) as Array<{ id: string; title: string }>}
        />
      </GlassCard>
    </>
  );
}
