import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Settings, ShieldAlert, ShieldCheck } from "lucide-react";
import { GlassBadge, GlassButton, GlassCard, GlassRing } from "@/components/glass/primitives";
import { GlassNavbar, IconLink } from "@/components/glass/navigation";
import { PlayerProfile } from "@/components/profile/player-profile";
import { ShareButton } from "@/components/profile/share-button";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import { profileCompletion } from "@/domains/profile/completion";
import { loadPlayerProfile } from "@/domains/profile/queries";
import { selfAsCard } from "@/domains/opportunities/queries";

export const metadata = { title: "Perfil" };

const PRO_LABELS: Record<string, string> = {
  licenses: "licenses", experience_years: "experience", categories: "categories", methodology: "methodology", languages: "languages",
  previous_teams: "previousTeams", agency_name: "agencyName", license_number: "licenseNumber", license_authority: "licenseAuthority",
  markets: "markets", regions: "regions", focus_positions: "focusPositions",
};

export default async function ProfilePage() {
  const session = await requireApp();
  const mode = appMode(session);
  if (mode === "organization") redirect("/club");
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  if (!session.player) {
    // Entrenador / agente / scout: ficha profesional básica (fase 2 amplía estos perfiles).
    const [coach, agent, scout] = await Promise.all([
      supabase.from("coach_profiles").select("*").eq("user_id", session.userId).maybeSingle(),
      supabase.from("agent_profiles").select("*").eq("user_id", session.userId).maybeSingle(),
      supabase.from("scout_profiles").select("*").eq("user_id", session.userId).maybeSingle(),
    ]);
    const rows = [coach.data, agent.data, scout.data].filter(Boolean) as Record<string, unknown>[];
    return (
      <>
        <GlassNavbar title={session.profile.full_name} subtitle={session.roles.map((r) => t(`football.role.${r}`)).join(" · ")}
          actions={<IconLink href="/settings" label={t("nav.settings")}><Settings className="size-5" /></IconLink>} />
        <GlassCard material="regular" className="flex flex-col gap-3">
          {rows.length === 0 ? <p className="text-ink-2">{t("profile.proEmpty")}</p> : null}
          {rows.map((r, i) => (
            <dl key={i} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
              {Object.entries(r)
                .filter(([k, v]) => k in PRO_LABELS && v != null && v !== "" && !(Array.isArray(v) && !v.length))
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-2">{t(`onboarding.${PRO_LABELS[k]}`)}</dt>
                    <dd className="font-medium">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
                  </div>
                ))}
            </dl>
          ))}
          <Link href="/onboarding/pro"><GlassButton variant="glass"><Pencil className="size-4" /> {t("profile.edit")}</GlassButton></Link>
        </GlassCard>
      </>
    );
  }

  const card = selfAsCard(session.profile, session.player);
  card.user_id = session.userId;
  const p = await loadPlayerProfile(supabase, card);
  const completion = profileCompletion({ ...session.profile, ...session.player, careers: p.careers.length, videos: p.videos.length });
  const { data: guardian } = session.isMinor
    ? await supabase.from("guardian_relationships").select("status, guardian_email").eq("minor_id", session.userId).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  return (
    <div className="fm-safe-top pt-3 pb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="fm-eyebrow">{t("nav.profile")}</p>
        <div className="flex items-center gap-2">
          <ShareButton path={`/players/${session.userId}`} title={p.name} />
          <IconLink href="/settings" label={t("nav.settings")}><Settings className="size-5" /></IconLink>
        </div>
      </div>
      <PlayerProfile
        p={{ ...p, name: session.profile.full_name }}
        t={t}
        intl={INTL_LOCALE[locale]}
        actions={<Link href="/profile/edit" className="w-full sm:w-auto"><GlassButton className="w-full"><Pencil className="size-4" /> {t("profile.edit")}</GlassButton></Link>}
        banner={
          <div className="flex flex-col gap-3">
            {completion.score < 100 ? (
              <GlassCard material="regular" className="flex items-center gap-4">
                <GlassRing value={completion.score} size={60}><span className="text-sm font-bold tabular">{completion.score}%</span></GlassRing>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t("profile.completeTitle")}</p>
                  <p className="text-sm text-ink-2">{completion.next ? t(`home.next.${completion.next}`) : t("home.next.done")}</p>
                </div>
                <Link href="/profile/edit"><GlassButton size="sm" variant="glass">{t("profile.improve")}</GlassButton></Link>
              </GlassCard>
            ) : null}
            {session.isMinor ? (
              <GlassCard material={session.guardianApproved ? "tint-green" : "tint-amber"} className="flex items-start gap-3">
                {session.guardianApproved ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" /> : <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warn" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{session.guardianApproved ? t("profile.guardianApproved") : t("profile.guardianMissing")}</p>
                  <p className="text-sm text-ink-2">
                    {guardian ? <>{guardian.guardian_email} · <GlassBadge tone="neutral">{t(`profile.gstatus.${guardian.status}`)}</GlassBadge></> : t("profile.guardianMissingBody")}
                  </p>
                </div>
                {!session.guardianApproved ? <Link href="/profile/edit?step=8"><GlassButton size="sm" variant="glass">{t("profile.manage")}</GlassButton></Link> : null}
              </GlassCard>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
