import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { GlassCard } from "@/components/glass/primitives";
import { OpportunityEditor } from "@/components/opportunities/opportunity-editor";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { getOpportunity } from "@/domains/opportunities/queries";

export default async function EditOpportunityPage(props: PageProps<"/opportunities/[id]/edit">) {
  const { id } = await props.params;
  const session = await requireApp();
  const supabase = await createClient();
  const opp = await getOpportunity(supabase, id);
  if (!opp) notFound();
  const m = session.memberships.find((x) => x.organization.id === opp.row.organization_id);
  if (!m || m.role === "scout") redirect(`/opportunities/${id}`);
  const { t } = await getI18n();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { organization: _o, ...initial } = opp.raw;
  return (
    <>
      <GlassNavbar
        title={t("common.edit")}
        subtitle={opp.row.title}
        leading={<Link href={`/opportunities/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"><ArrowLeft className="size-4" /> {t("common.back")}</Link>}
      />
      <GlassCard material="regular" className="mb-6">
        <OpportunityEditor initial={initial} initialRequirements={opp.requirements} submitLabel={t("common.save")} />
      </GlassCard>
    </>
  );
}
