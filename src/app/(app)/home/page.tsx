import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bell, Briefcase, Compass, Heart, KanbanSquare, Plus, ShieldAlert, Sparkles, Users } from "lucide-react";
import { GlassNavbar, IconLink } from "@/components/glass/navigation";
import { EmptyState, GlassBadge, GlassCard, GlassRing, SectionHeader } from "@/components/glass/primitives";
import { GlassMatchCard, GlassOpportunityCard } from "@/components/cards/cards";
import { Greeting } from "@/components/home/greeting";
import { InterestedOrgs, InterestedPlayers } from "@/components/home/interested";
import { Reveal, RevealItem } from "@/components/app/reveal";
import { appMode, requireApp, type Session } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { publicAssetUrl, signPlayerMedia } from "@/lib/media";
import { profileCompletion } from "@/domains/profile/completion";
import { rankedOpportunitiesForPlayer, selfAsCard, toOpportunityVM, toPlayerVMs } from "@/domains/opportunities/queries";
import type { PlayerCardRow } from "@/lib/types";

export const metadata = { title: "Inicio" };

/** Match de los últimos 3 días: se marca como "nuevo". */
const isRecent = (iso: string) => Date.now() - new Date(iso).getTime() < 3 * 864e5;

export default async function HomePage() {
  const session = await requireApp();
  if (!session.player && !session.activeOrg && session.roles.includes("guardian")) redirect("/guardian");
  return appMode(session) === "organization" ? <OrgHome session={session} /> : <PlayerHome session={session} />;
}

async function PlayerHome({ session }: { session: Session }) {
  const supabase = await createClient();
  const { t, f } = await getI18n();
  const me = session.player ? selfAsCard(session.profile, session.player) : null;

  const [ranked, careers, videos, interests, matches, applications, notifications] = await Promise.all([
    me ? rankedOpportunitiesForPlayer(supabase, me, 60) : Promise.resolve([]),
    supabase.from("player_careers").select("id", { count: "exact", head: true }).eq("player_id", session.userId),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("owner_id", session.userId).neq("kind", "photo"),
    supabase.from("interests").select("id, actor_org_id, created_at, organization:organizations!interests_actor_org_id_fkey(id, name, crest_path, city, verification_status, is_demo)")
      .eq("target_user_id", session.userId).neq("kind", "pass").order("created_at", { ascending: false }).limit(12),
    supabase.from("matches").select("id, created_at, organization:organizations(id, name, crest_path, city), conversation:conversations(id)")
      .eq("player_id", session.userId).order("created_at", { ascending: false }).limit(10),
    supabase.from("applications").select("id, status, updated_at, opportunity:opportunities(id, title, organization:organizations(name))")
      .eq("applicant_id", session.userId).order("updated_at", { ascending: false }).limit(4),
    supabase.from("notifications").select("id, title, body, link, created_at, read_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(4),
  ]);

  const completion = profileCompletion({
    ...session.profile, ...(session.player ?? {}), careers: careers.count ?? 0, videos: videos.count ?? 0,
  });
  const matchedOrgs = new Set((matches.data ?? []).map((m) => (m.organization as unknown as { id: string } | null)?.id));
  const interested = (interests.data ?? [])
    .map((i) => i.organization as unknown as { id: string; name: string; crest_path: string | null; city: string | null; verification_status: string; is_demo: boolean } | null)
    .filter((o): o is NonNullable<typeof o> => Boolean(o) && !matchedOrgs.has(o!.id));
  const topOpps = ranked.slice(0, 8).map((r) => toOpportunityVM(r.row, r.match));
  const firstName = session.profile.full_name.split(" ")[0];

  return (
    <>
      <GlassNavbar
        title={t("nav.home")}
        eyebrow={<Greeting name={firstName} />}
        subtitle={t("home.playerSubtitle")}
        actions={<IconLink href="/notifications" label={t("nav.notifications")}><Bell className="size-5" /></IconLink>}
      />
      <Reveal className="flex flex-col gap-8">
        {session.isMinor && !session.guardianApproved ? (
          <RevealItem>
            <Link href="/profile#guardian" className="glass glass-tint-blue flex items-start gap-3 rounded-[26px] p-4">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-info" />
              <div>
                <p className="font-semibold">{t("onboarding.minorTitle")}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">{t("home.guardianPending")}</p>
              </div>
            </Link>
          </RevealItem>
        ) : null}

        <RevealItem>
          <GlassCard material="elevated" radius="xl" className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-accent/20 blur-3xl" />
            <div className="flex items-center gap-5">
              <GlassRing value={completion.score} size={84} stroke={7} label={t("onboarding.completion")}>
                <span className="fm-number text-xl">{completion.score}%</span>
              </GlassRing>
              <div className="min-w-0 flex-1">
                <p className="fm-eyebrow">{t("onboarding.completion")}</p>
                <p className="mt-1 text-[15px] leading-snug font-medium text-balance">
                  {completion.next ? t(`home.next.${completion.next}`, { n: completion.score }) : t("home.next.done")}
                </p>
                {session.player ? (
                  <GlassBadge tone="green" className="mt-2">{t(`football.av.${session.player.availability}`)}</GlassBadge>
                ) : null}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Link href="/discover" className="glass glass-tint-green inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold shadow-[var(--shadow-glow)]">
                <Compass className="size-4" /> {t("home.ctaDiscover")}
              </Link>
              <Link href="/profile/edit" className="glass glass-regular inline-flex h-11 items-center justify-center rounded-full px-5 text-[15px] font-medium">
                {t("home.ctaProfile")}
              </Link>
            </div>
          </GlassCard>
        </RevealItem>

        <RevealItem>
          <SectionHeader title={t("home.forYou")} action={<Link href="/opportunities" className="text-sm font-semibold text-accent-strong dark:text-accent">{t("common.seeAll")}</Link>} />
          {topOpps.length ? (
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              {topOpps.map((o) => (
                <div key={o.id} className="w-[86%] max-w-[340px] shrink-0 snap-start">
                  <GlassOpportunityCard opp={o} href={`/opportunities/${o.id}`} compact />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Briefcase className="size-7" />} title={t("home.noOpps")} body={t("home.noOppsBody")} />
          )}
        </RevealItem>

        <RevealItem>
          <SectionHeader title={t("home.interestedClubs")} />
          <InterestedOrgs
            orgs={interested.map((o) => ({ id: o.id, name: o.name, crestUrl: publicAssetUrl(o.crest_path), city: o.city, verified: o.verification_status === "verified", isDemo: o.is_demo }))}
          />
        </RevealItem>

        <RevealItem>
          <SectionHeader title={t("home.matches")} action={<Link href="/chats" className="text-sm font-semibold text-accent-strong dark:text-accent">{t("nav.chats")}</Link>} />
          {matches.data?.length ? (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              {matches.data.map((m) => {
                const org = m.organization as unknown as { id: string; name: string; crest_path: string | null; city: string | null };
                const conv = (m.conversation as unknown as Array<{ id: string }> | { id: string } | null);
                const convId = Array.isArray(conv) ? conv[0]?.id : conv?.id;
                return (
                  <GlassMatchCard key={m.id} id={org.id} name={org.name} imageUrl={publicAssetUrl(org.crest_path)} subtitle={org.city ?? undefined}
                    href={convId ? `/chats/${convId}` : `/clubs/${org.id}`} isNew={isRecent(m.created_at)} />
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<Heart className="size-7" />} title={t("home.noMatches")} body={t("home.noMatchesBody")} />
          )}
        </RevealItem>

        <RevealItem>
          <SectionHeader title={t("home.applications")} action={<Link href="/applications" className="text-sm font-semibold text-accent-strong dark:text-accent">{t("common.seeAll")}</Link>} />
          {applications.data?.length ? (
            <GlassCard material="regular" className="divide-y divide-[var(--fm-hairline)] p-2">
              {applications.data.map((a) => {
                const opp = a.opportunity as unknown as { id: string; title: string; organization: { name: string } | null } | null;
                return (
                  <Link key={a.id} href={`/applications#${a.id}`} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{opp?.title}</p>
                      <p className="truncate text-[13px] text-ink-2">{opp?.organization?.name} · {f.relative(a.updated_at)}</p>
                    </div>
                    <GlassBadge tone={a.status === "selected" ? "green" : a.status === "rejected" || a.status === "withdrawn" ? "red" : "blue"}>
                      {t(`football.app.${a.status}`)}
                    </GlassBadge>
                  </Link>
                );
              })}
            </GlassCard>
          ) : (
            <EmptyState icon={<KanbanSquare className="size-7" />} title={t("home.noApplications")} body={t("home.noApplicationsBody")} />
          )}
        </RevealItem>

        <RevealItem>
          <ActivityList items={notifications.data ?? []} title={t("home.activity")} empty={t("home.noActivity")} rel={f.relative} />
        </RevealItem>
      </Reveal>
    </>
  );
}

async function OrgHome({ session }: { session: Session }) {
  const supabase = await createClient();
  const { t, f } = await getI18n();
  const org = session.activeOrg!.organization;

  const { data: oppIds } = await supabase.from("opportunities").select("id").eq("organization_id", org.id);
  const ids = (oppIds ?? []).map((o) => o.id);
  const [openOpps, newApps, matches, likesOrg, likesOpps, myActs, recentApps, notifications] = await Promise.all([
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("organization_id", org.id).eq("status", "open"),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("organization_id", org.id).eq("status", "received"),
    supabase.from("matches").select("id, created_at, player_id, conversation:conversations(id)").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("interests").select("actor_id, created_at").eq("target_org_id", org.id).neq("kind", "pass").limit(50),
    ids.length ? supabase.from("interests").select("actor_id, created_at").in("target_opportunity_id", ids).neq("kind", "pass").limit(100) : Promise.resolve({ data: [] }),
    supabase.from("interests").select("target_user_id").eq("actor_org_id", org.id),
    supabase.from("applications").select("id, status, created_at, applicant_id, opportunity:opportunities(title)").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("notifications").select("id, title, body, link, created_at, read_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(4),
  ]);

  const acted = new Set((myActs.data ?? []).map((i) => i.target_user_id));
  const likerIds = [...new Set([...(likesOrg.data ?? []), ...((likesOpps.data ?? []) as Array<{ actor_id: string }>)].map((i) => i.actor_id))].filter((id) => !acted.has(id));
  const matchPlayerIds = (matches.data ?? []).map((m) => m.player_id);
  const appPlayerIds = (recentApps.data ?? []).map((a) => a.applicant_id);
  const allIds = [...new Set([...likerIds, ...matchPlayerIds, ...appPlayerIds])];
  const { data: cards } = allIds.length ? await supabase.from("player_cards").select("*").in("user_id", allIds) : { data: [] };
  const byId = new Map(((cards ?? []) as PlayerCardRow[]).map((c) => [c.user_id, c]));
  const likers = await toPlayerVMs(supabase, likerIds.map((id) => byId.get(id)).filter(Boolean).map((row) => ({ row: row! })));
  const signed = await signPlayerMedia(supabase, [...byId.values()].map((c) => c.avatar_path));

  const kpis = [
    { label: t("home.kpiOpen"), value: openOpps.count ?? 0, icon: <Briefcase className="size-4" />, href: "/opportunities?mine=1" },
    { label: t("home.kpiNewApps"), value: newApps.count ?? 0, icon: <KanbanSquare className="size-4" />, href: "/club/pipeline" },
    { label: t("home.kpiMatches"), value: matches.data?.length ?? 0, icon: <Sparkles className="size-4" />, href: "/chats" },
    { label: t("home.kpiInterested"), value: likers.length, icon: <Users className="size-4" />, href: "#interested" },
  ];

  return (
    <>
      <GlassNavbar
        title={org.name}
        eyebrow={<Greeting name={session.profile.full_name.split(" ")[0]} />}
        subtitle={t("home.orgSubtitle")}
        actions={<IconLink href="/notifications" label={t("nav.notifications")}><Bell className="size-5" /></IconLink>}
      />
      <Reveal className="flex flex-col gap-8">
        {org.verification_status !== "verified" ? (
          <RevealItem>
            <Link href="/club#verification" className="glass glass-tint-amber flex items-start gap-3 rounded-[26px] p-4">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warn" />
              <div>
                <p className="font-semibold">{t(`home.verif.${org.verification_status}`)}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">{t("home.verifBody")}</p>
              </div>
            </Link>
          </RevealItem>
        ) : null}
        <RevealItem>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => (
              <Link key={k.label} href={k.href}>
                <GlassCard material="regular" interactive className="p-4">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                    <span className="glass glass-thin flex size-7 items-center justify-center rounded-full text-accent">{k.icon}</span>
                    {k.label}
                  </div>
                  <p className="fm-number mt-3 text-[34px]">{k.value}</p>
                </GlassCard>
              </Link>
            ))}
          </div>
        </RevealItem>
        <RevealItem>
          <div className="flex gap-2">
            <Link href="/opportunities/new" className="glass glass-tint-green inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold shadow-[var(--shadow-glow)]">
              <Plus className="size-4" /> {t("home.ctaPublish")}
            </Link>
            <Link href="/discover" className="glass glass-regular inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold">
              <Compass className="size-4" /> {t("home.ctaFindPlayers")}
            </Link>
          </div>
        </RevealItem>
        <RevealItem>
          <div id="interested" />
          <SectionHeader title={t("home.interestedPlayers")} />
          <InterestedPlayers players={likers} />
        </RevealItem>
        <RevealItem>
          <SectionHeader title={t("home.matches")} />
          {matches.data?.length ? (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              {matches.data.map((m) => {
                const p = byId.get(m.player_id);
                const conv = m.conversation as unknown as Array<{ id: string }> | { id: string } | null;
                const convId = Array.isArray(conv) ? conv[0]?.id : conv?.id;
                return (
                  <GlassMatchCard key={m.id} id={m.player_id} name={p?.display_name ?? "—"} imageUrl={p?.avatar_path ? signed[p.avatar_path] : null}
                    subtitle={p ? t(`football.pos.${p.position}`) : undefined} href={convId ? `/chats/${convId}` : `/players/${m.player_id}`}
                    isNew={isRecent(m.created_at)} />
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<Heart className="size-7" />} title={t("home.noMatches")} body={t("home.noMatchesOrgBody")} />
          )}
        </RevealItem>
        <RevealItem>
          <SectionHeader title={t("home.latestApplications")} action={<Link href="/club/pipeline" className="text-sm font-semibold text-accent-strong dark:text-accent">{t("nav.pipeline")}</Link>} />
          {recentApps.data?.length ? (
            <GlassCard material="regular" className="divide-y divide-[var(--fm-hairline)] p-2">
              {recentApps.data.map((a) => {
                const p = byId.get(a.applicant_id);
                return (
                  <Link key={a.id} href={`/club/pipeline?application=${a.id}`} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p?.display_name ?? "—"}</p>
                      <p className="truncate text-[13px] text-ink-2">{(a.opportunity as unknown as { title: string } | null)?.title} · {f.relative(a.created_at)}</p>
                    </div>
                    <GlassBadge tone="blue">{t(`football.app.${a.status}`)}</GlassBadge>
                  </Link>
                );
              })}
            </GlassCard>
          ) : (
            <EmptyState icon={<KanbanSquare className="size-7" />} title={t("home.noApplicationsOrg")} body={t("home.noApplicationsOrgBody")} />
          )}
        </RevealItem>
        <RevealItem>
          <ActivityList items={notifications.data ?? []} title={t("home.activity")} empty={t("home.noActivity")} rel={f.relative} />
        </RevealItem>
      </Reveal>
    </>
  );
}

function ActivityList({ items, title, empty, rel }: { items: Array<{ id: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null }>; title: string; empty: string; rel: (d: string) => string }) {
  return (
    <div>
      <SectionHeader title={title} />
      <GlassCard material="thin" className="p-2">
        {items.length === 0 ? <p className="px-3 py-4 text-sm text-ink-3">{empty}</p> : null}
        {items.map((n) => (
          <Link key={n.id} href={n.link ?? "/notifications"} className="flex items-center gap-3 rounded-2xl px-3 py-3">
            <span className={`size-2 shrink-0 rounded-full ${n.read_at ? "bg-[var(--fm-hairline)]" : "bg-accent shadow-[0_0_10px_var(--fm-accent)]"}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{n.title}</p>
              {n.body ? <p className="truncate text-[13px] text-ink-2">{n.body}</p> : null}
            </div>
            <span className="shrink-0 text-[12px] text-ink-3">{rel(n.created_at)}</span>
            <ArrowRight className="size-4 shrink-0 text-ink-3" />
          </Link>
        ))}
      </GlassCard>
    </div>
  );
}
