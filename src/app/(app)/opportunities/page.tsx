import Link from "next/link";
import { Briefcase, KanbanSquare, Plus } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { EmptyState, GlassBadge, GlassButton, GlassCard } from "@/components/glass/primitives";
import { GlassOpportunityCard } from "@/components/cards/cards";
import { Reveal, RevealItem } from "@/components/app/reveal";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { OPPORTUNITY_TYPES } from "@/domains/football/catalog";
import { listOpenOpportunities, selfAsCard } from "@/domains/opportunities/queries";
import { cn } from "@/lib/cn";

export const metadata = { title: "Oportunidades" };

export default async function OpportunitiesPage(props: PageProps<"/opportunities">) {
  const session = await requireApp();
  const sp = await props.searchParams;
  const { t, f } = await getI18n();
  const supabase = await createClient();
  const mode = appMode(session);

  if (mode === "organization") {
    const org = session.activeOrg!.organization;
    const { data } = await supabase
      .from("opportunities")
      .select("id, title, type, status, deadline, created_at, is_demo, applications(count)")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as Array<{ id: string; title: string; type: string; status: string; deadline: string | null; created_at: string; is_demo: boolean; applications: { count: number }[] }>;
    return (
      <>
        <GlassNavbar
          title={t("nav.opportunities")}
          subtitle={t("opportunities.orgSubtitle", { org: org.name })}
          actions={<Link href="/opportunities/new"><GlassButton size="sm"><Plus className="size-4" /> {t("opportunities.new")}</GlassButton></Link>}
        />
        {rows.length === 0 ? (
          <EmptyState icon={<Briefcase className="size-7" />} title={t("opportunities.noneOrg")} body={t("opportunities.noneOrgBody")}
            action={<Link href="/opportunities/new"><GlassButton><Plus className="size-4" /> {t("opportunities.new")}</GlassButton></Link>} />
        ) : (
          <Reveal className="flex flex-col gap-3">
            {rows.map((o) => (
              <RevealItem key={o.id}>
                  <GlassCard material="regular" interactive className="relative flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <GlassBadge tone={o.status === "open" ? "green" : o.status === "draft" ? "neutral" : "amber"}>{t(`football.status.${o.status}`)}</GlassBadge>
                        <GlassBadge tone="neutral">{t(`football.opp.${o.type}`)}</GlassBadge>
                        {o.is_demo ? <GlassBadge tone="demo">DEMO</GlassBadge> : null}
                      </div>
                      <Link href={`/opportunities/${o.id}`} className="fm-title block truncate text-[16px] uppercase after:absolute after:inset-0 after:content-['']">{o.title}</Link>
                      <p className="text-[13px] text-ink-2">
                        {t("opportunities.applicationsCount", { n: o.applications?.[0]?.count ?? 0 })}
                        {o.deadline ? ` · ${t("opportunities.deadline")}: ${f.date(o.deadline)}` : ""}
                      </p>
                    </div>
                    <Link href={`/club/pipeline?opportunity=${o.id}`} aria-label={t("nav.pipeline")} className="glass glass-thin relative z-10 flex size-10 items-center justify-center rounded-full text-ink-2 hover:text-ink">
                      <KanbanSquare className="size-4" />
                    </Link>
                  </GlassCard>
              </RevealItem>
            ))}
          </Reveal>
        )}
      </>
    );
  }

  const type = typeof sp.type === "string" && (OPPORTUNITY_TYPES as readonly string[]).includes(sp.type) ? sp.type : null;
  const me = session.player ? selfAsCard(session.profile, session.player) : null;
  const items = await listOpenOpportunities(supabase, me, { type, userId: session.userId });
  const tabs = [null, ...OPPORTUNITY_TYPES] as const;

  return (
    <>
      <GlassNavbar title={t("nav.opportunities")} subtitle={me ? t("opportunities.playerSubtitle") : t("opportunities.proSubtitle")} />
      <nav aria-label={t("opportunities.type")} className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
        {tabs.map((k) => (
          <Link
            key={k ?? "all"}
            href={k ? `/opportunities?type=${k}` : "/opportunities"}
            aria-current={type === k ? "page" : undefined}
            className={cn("inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium", type === k ? "glass glass-tint-green" : "glass glass-thin text-ink-2")}
          >
            {k ? t(`football.opp.${k}`) : t("opportunities.all")}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState icon={<Briefcase className="size-7" />} title={t("opportunities.none")} body={t("opportunities.noneBody")} />
      ) : (
        <Reveal className="grid gap-3 sm:grid-cols-2">
          {items.map((o) => (
            <RevealItem key={o.id}>
              <GlassOpportunityCard opp={o} href={`/opportunities/${o.id}`} action={o.applied ? <GlassBadge tone="green">{t("opportunities.applied")}</GlassBadge> : null} />
            </RevealItem>
          ))}
        </Reveal>
      )}
    </>
  );
}
