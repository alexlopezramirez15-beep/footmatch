import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { GlassBadge, GlassButton } from "@/components/glass/primitives";
import { AccountPanel, AppearancePanel, BlockedList, NotificationsPanel, PrivacyPanel, Section } from "@/components/settings/settings-panels";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const session = await requireApp();
  const supabase = await createClient();
  const { t } = await getI18n();
  const [{ data: blocks }, { data: guardian }] = await Promise.all([
    supabase.from("blocks").select("blocked_id").eq("blocker_id", session.userId),
    session.player ? supabase.from("guardian_relationships").select("status, guardian_email").eq("minor_id", session.userId).order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ids = (blocks ?? []).map((b) => b.blocked_id as string);
  const { data: people } = ids.length ? await supabase.from("public_profiles").select("id, display_name").in("id", ids) : { data: [] };
  const blocked = ids.map((id) => ({ id, name: (people ?? []).find((p) => p.id === id)?.display_name ?? "—" }));

  return (
    <>
      <GlassNavbar title={t("nav.settings")} />
      <div className="flex flex-col gap-6 pb-4">
        <Section title={t("settings.appearance")}><AppearancePanel /></Section>
        <Section title={t("settings.notifications")}>
          <NotificationsPanel prefs={session.profile.notification_prefs ?? {}} readReceipts={session.profile.read_receipts} />
        </Section>
        {session.player ? (
          <Section title={t("settings.privacy")}>
            <PrivacyPanel visibility={session.player.visibility} allowAgent={session.player.allow_agent_contact} isMinor={session.isMinor} />
          </Section>
        ) : null}
        {session.isMinor ? (
          <Section id="guardian" title={t("settings.guardian")}>
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-accent" />
              <p className="flex-1 text-sm">{guardian ? guardian.guardian_email : t("profile.guardianMissingBody")}</p>
              {guardian ? <GlassBadge tone={guardian.status === "approved" ? "green" : "amber"}>{t(`profile.gstatus.${guardian.status}`)}</GlassBadge> : null}
            </div>
            {!session.guardianApproved ? <Link href="/profile/edit?step=8"><GlassButton variant="glass" size="sm">{t("profile.manage")}</GlassButton></Link> : null}
          </Section>
        ) : null}
        {session.roles.includes("guardian") ? (
          <Section title={t("settings.guardianOf")}><Link href="/guardian"><GlassButton variant="glass">{t("guardian.dashboard")}</GlassButton></Link></Section>
        ) : null}
        <Section title={t("settings.blocked")}><BlockedList items={blocked} /></Section>
        <Section title={t("settings.account")}><AccountPanel email={session.email} /></Section>
        <p className="flex flex-wrap justify-center gap-4 text-xs text-ink-3">
          <Link href="/legal/terms">{t("legal.terms")}</Link>
          <Link href="/legal/privacy">{t("legal.privacy")}</Link>
          <span>FOOTMATCH · {t("settings.version")} 0.1 (MVP)</span>
        </p>
      </div>
    </>
  );
}
