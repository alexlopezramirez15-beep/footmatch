import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { PlayerWizard } from "@/components/onboarding/player-wizard";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { loadPlayerWizardInitial } from "@/domains/profile/wizard-data";

export const metadata = { title: "Editar perfil" };

export default async function EditProfilePage(props: PageProps<"/profile/edit">) {
  const s = await requireApp();
  if (!s.player) redirect(s.activeOrg ? "/club" : "/settings");
  const sp = await props.searchParams;
  const step = Math.min(8, Math.max(1, Number(sp.step) || 1));
  const supabase = await createClient();
  const { t } = await getI18n();
  return (
    <>
      <GlassNavbar
        title={t("profile.edit")}
        leading={<Link href="/profile" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"><ArrowLeft className="size-4" /> {t("nav.profile")}</Link>}
      />
      <div className="pb-6">
        <PlayerWizard mode="edit" initial={await loadPlayerWizardInitial(supabase, s, step)} />
      </div>
    </>
  );
}
