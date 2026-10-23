import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { GlassCard } from "@/components/glass/primitives";
import { OpportunityEditor } from "@/components/opportunities/opportunity-editor";
import { requireApp } from "@/lib/session";
import { getI18n } from "@/i18n/server";

export const metadata = { title: "Nueva oportunidad" };

export default async function NewOpportunityPage() {
  const session = await requireApp();
  const m = session.activeOrg;
  if (!m || m.role === "scout") redirect("/opportunities");
  const { t } = await getI18n();
  const org = m.organization;
  return (
    <>
      <GlassNavbar
        title={t("opportunities.new")}
        subtitle={org.name}
        leading={<Link href="/opportunities" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"><ArrowLeft className="size-4" /> {t("nav.opportunities")}</Link>}
      />
      <GlassCard material="regular" className="mb-6">
        <OpportunityEditor defaults={{ country: org.country, region: org.region, city: org.city, category: org.categories?.[0] ?? null }} submitLabel={t("opportunities.publish")} />
      </GlassCard>
    </>
  );
}
