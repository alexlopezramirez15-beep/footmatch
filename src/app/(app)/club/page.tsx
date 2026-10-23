import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Briefcase, Compass, KanbanSquare, Pencil, Plus, ShieldAlert, Users } from "lucide-react";
import { GlassBadge, GlassButton, GlassCard, GlassAvatar, SectionHeader } from "@/components/glass/primitives";
import { ClubHeader } from "@/components/club/club-header";
import { CrestUploader } from "@/components/club/crest-uploader";
import { OrgSwitcher } from "@/components/club/org-switcher";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import { publicAssetUrl } from "@/lib/media";

export const metadata = { title: "Mi club" };

export default async function ClubDashboard() {
  const session = await requireApp();
  const m = session.activeOrg;
  if (!m) redirect("/profile");
  const org = m.organization;
  const canEdit = m.role === "owner" || m.role === "admin";
  const supabase = await createClient();
  const { t, f, locale } = await getI18n();

  const [opps, apps, newApps, matches, interested, teams, members, verif] = await Promise.all([
    supabase.from("opportunities").select("id, title, status, type, deadline").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("organization_id", org.id).eq("status", "received"),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
    supabase.from("interests").select("id", { count: "exact", head: true }).eq("target_org_id", org.id).neq("kind", "pass"),
    supabase.from("team_profiles").select("id, name, category").eq("organization_id", org.id).order("name"),
    supabase.from("organization_members").select("user_id, role, title").eq("organization_id", org.id),
    supabase.from("verification_requests").select("status, created_at, reviewer_note").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const memberIds = (members.data ?? []).map((x) => x.user_id as string);
  const { data: people } = memberIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", memberIds) : { data: [] };
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, p.display_name as string]));
  const openCount = (opps.data ?? []).filter((o) => o.status === "open").length;
  const kpis: Array<[string, number, React.ReactNode, string]> = [
    [t("home.kpiOpen"), openCount, <Briefcase key="o" className="size-4" />, "/opportunities"],
    [t("club.kpiApplications"), apps.count ?? 0, <KanbanSquare key="a" className="size-4" />, "/club/pipeline"],
    [t("home.kpiNewApps"), newApps.count ?? 0, <Plus key="n" className="size-4" />, "/club/pipeline?status=received"],
    [t("home.kpiMatches"), matches.count ?? 0, <Users key="m" className="size-4" />, "/chats"],
    [t("home.kpiInterested"), interested.count ?? 0, <Compass key="i" className="size-4" />, "/home"],
  ];

  return (
    <div className="fm-safe-top pt-3 pb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="fm-eyebrow">{t("nav.club")}</p>
        <div className="w-56"><OrgSwitcher current={org.id} orgs={session.memberships.map((x) => ({ id: x.organization.id, name: x.organization.name }))} /></div>
      </div>
      <ClubHeader
        org={org}
        t={t}
        intl={INTL_LOCALE[locale]}
        crest={<CrestUploader orgId={org.id} name={org.name} url={publicAssetUrl(org.crest_path)} editable={canEdit} />}
        actions={
          <>
            <Link href={`/clubs/${org.id}?preview=1`}><GlassButton variant="glass" size="sm">{t("club.preview")}</GlassButton></Link>
            {canEdit ? <Link href="/club/edit"><GlassButton variant="glass" size="sm"><Pencil className="size-4" /> {t("common.edit")}</GlassButton></Link> : null}
          </>
        }
      />

      {org.verification_status !== "verified" ? (
        <GlassCard material={org.verification_status === "rejected" ? "tint-red" : "tint-amber"} className="mt-4 flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t(`home.verif.${org.verification_status}`)}</p>
            <p className="text-sm text-ink-2">{t("home.verifBody")}</p>
            {verif.data?.reviewer_note ? <p className="mt-1 text-sm">{t("club.reviewerNote")}: {verif.data.reviewer_note}</p> : null}
          </div>
          {canEdit && verif.data?.status !== "pending" ? <Link href="/club/edit?step=6"><GlassButton size="sm">{t("onboarding.requestVerification")}</GlassButton></Link> : null}
        </GlassCard>
      ) : (
        <GlassCard material="tint-blue" className="mt-4 flex items-center gap-3 text-sm">
          <BadgeCheck className="size-5 text-info" /> {t("club.verifiedBody")}
        </GlassCard>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map(([label, n, icon, href]) => (
          <Link key={label} href={href}>
            <GlassCard material="regular" interactive className="p-4">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">{icon}{label}</p>
              <p className="fm-number mt-1 text-[28px]">{f.number(n)}</p>
            </GlassCard>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title={t("nav.opportunities")} action={<Link href="/opportunities/new" className="text-sm font-semibold text-accent-strong dark:text-accent">{t("opportunities.new")}</Link>} />
          <GlassCard material="regular" className="divide-y divide-[var(--fm-hairline)] py-1">
            {(opps.data ?? []).length === 0 ? <p className="py-3 text-sm text-ink-2">{t("opportunities.noneOrg")}</p> : null}
            {(opps.data ?? []).map((o) => (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate font-medium">{o.title}</span>
                <GlassBadge tone={o.status === "open" ? "green" : "neutral"}>{t(`football.status.${o.status}`)}</GlassBadge>
              </Link>
            ))}
          </GlassCard>
        </section>
        <section>
          <SectionHeader title={t("club.members")} />
          <GlassCard material="regular" className="divide-y divide-[var(--fm-hairline)] py-1">
            {(members.data ?? []).map((mm) => (
              <div key={mm.user_id} className="flex items-center gap-3 py-3">
                <GlassAvatar name={nameOf.get(mm.user_id) ?? "—"} seed={mm.user_id} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{nameOf.get(mm.user_id) ?? "—"}</p>
                  <p className="truncate text-[13px] text-ink-2">{mm.title ?? ""}</p>
                </div>
                <GlassBadge tone="neutral">{t(`club.role.${mm.role}`)}</GlassBadge>
              </div>
            ))}
          </GlassCard>
          {(teams.data ?? []).length ? (
            <div className="mt-4">
              <SectionHeader title={t("club.teams")} action={canEdit ? <Link href="/club/edit?step=3" className="text-sm font-semibold text-accent-strong dark:text-accent">{t("common.edit")}</Link> : null} />
              <div className="flex flex-wrap gap-2">
                {(teams.data ?? []).map((tm) => <GlassBadge key={tm.id} tone="neutral" className="h-9 px-4 text-sm">{tm.name}{tm.category ? ` · ${t(`football.cat.${tm.category}`)}` : ""}</GlassBadge>)}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
