import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { OrgWizard } from "@/components/onboarding/org-wizard";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { loadOrgWizardInitial } from "@/domains/organizations/wizard-data";

export const metadata = { title: "Editar club" };

export default async function EditClubPage(props: PageProps<"/club/edit">) {
  const s = await requireApp();
  const m = s.activeOrg;
  if (!m || (m.role !== "owner" && m.role !== "admin")) redirect("/club");
  const sp = await props.searchParams;
  const step = Math.min(6, Math.max(1, Number(sp.step) || 1));
  const supabase = await createClient();
  const { t } = await getI18n();
  return (
    <>
      <GlassNavbar
        title={t("club.edit")}
        subtitle={m.organization.name}
        leading={<Link href="/club" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"><ArrowLeft className="size-4" /> {t("nav.club")}</Link>}
      />
      <div className="pb-6">
        <OrgWizard mode="edit" initial={await loadOrgWizardInitial(supabase, s, step)} />
      </div>
    </>
  );
}
