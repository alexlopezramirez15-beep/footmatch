import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarDays, KanbanSquare, MapPin, Pencil, Users } from "lucide-react";
import { DemoBadge, GlassBadge, GlassButton, GlassCard, SectionHeader } from "@/components/glass/primitives";
import { Crest, MatchPill, MatchReasons } from "@/components/cards/cards";
import { ApplyPanel, OwnerStatusControl } from "@/components/opportunities/apply-panel";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import { publicAssetUrl } from "@/lib/media";
import { countryName, languageName } from "@/domains/football/catalog";
import { computeMatch } from "@/domains/matching/engine";
import { loadWeights, opportunityToSpec, playerToFacts } from "@/domains/matching/adapters";
import { getOpportunity, selfAsCard } from "@/domains/opportunities/queries";

export default async function OpportunityPage(props: PageProps<"/opportunities/[id]">) {
  const { id } = await props.params;
  const session = await requireApp();
  const supabase = await createClient();
  const { t, f, locale } = await getI18n();
  const l = INTL_LOCALE[locale];
  const opp = await getOpportunity(supabase, id);
  if (!opp) notFound();
  const { row, raw, requirements } = opp;
  const isOwner = session.memberships.some((m) => m.organization.id === row.organization_id);
  const mode = appMode(session);

  let match = null;
  let application: { id: string; status: string } | null = null;
  let interested = false;
  let appCount = 0;
  if (mode === "player" && session.player) {
    const me = selfAsCard(session.profile, session.player);
    const weights = await loadWeights(supabase);
    match = computeMatch(playerToFacts(me), opportunityToSpec(row, requirements), weights.weights, weights.enabled);
    const [{ data: app }, { data: int }] = await Promise.all([
      supabase.from("applications").select("id, status").eq("opportunity_id", id).eq("applicant_id", session.userId).maybeSingle(),
      supabase.from("interests").select("id").eq("actor_id", session.userId).eq("target_opportunity_id", id).neq("kind", "pass").limit(1),
    ]);
    application = app;
    interested = Boolean(int?.length);
  }
  if (isOwner) {
    const { count } = await supabase.from("applications").select("id", { count: "exact", head: true }).eq("opportunity_id", id);
    appCount = count ?? 0;
  }
  const crestUrl = publicAssetUrl(row.org_crest_path);
  const mandatory = requirements.filter((r) => r.mandatory);

  const facts: Array<[string, React.ReactNode]> = [
    [t("onboarding.category"), row.category ? t(`football.cat.${row.category}`) : null],
    [t("onboarding.oppPositions"), row.positions?.length ? row.positions.map((p) => t(`football.pos.${p}`)).join(", ") : null],
    [t("opportunities.ages"), row.age_min || row.age_max ? `${row.age_min ?? "–"}–${row.age_max ?? "–"}` : null],
    [t("onboarding.languages"), row.languages?.length ? row.languages.map((c) => languageName(c, l)).join(", ") : null],
    [t("opportunities.startsOn"), row.starts_on ? f.date(row.starts_on) : null],
    [t("opportunities.deadline"), row.deadline ? f.date(row.deadline) : null],
    [t("opportunities.slots"), raw.slots ?? null],
  ];

  return (
    <div className="fm-safe-top pt-3">
      <Link href="/opportunities" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" /> {t("nav.opportunities")}
      </Link>

      <GlassCard material="elevated" className="relative overflow-hidden">
        <div className="fm-pitch pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative flex items-start gap-4">
          <Crest url={crestUrl} name={row.org_name} id={row.organization_id} size={64} />
          <div className="min-w-0 flex-1">
            <Link href={`/clubs/${row.organization_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
              {row.org_name}
              {row.org_verification === "verified" ? <BadgeCheck className="size-4 text-info" aria-label={t("common.verified")} /> : null}
            </Link>
            <h1 className="fm-display mt-1 text-[28px] uppercase sm:text-[34px]">{row.title}</h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <GlassBadge tone="neutral">{t(`football.opp.${row.type}`)}</GlassBadge>
              {row.status !== "open" ? <GlassBadge tone="amber">{t(`football.status.${row.status}`)}</GlassBadge> : null}
              {row.is_demo ? <DemoBadge /> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
              {row.city || row.country ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{[row.city, row.region, countryName(row.country, l)].filter(Boolean).join(" · ")}</span> : null}
              {row.age_min || row.age_max ? <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{row.age_min ?? "–"}–{row.age_max ?? "–"}</span> : null}
              {row.deadline ? <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{f.date(row.deadline)}</span> : null}
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          {row.description ? (
            <section>
              <SectionHeader title={t("opportunities.about")} />
              <GlassCard material="regular"><p className="whitespace-pre-line text-[15px] leading-relaxed">{row.description}</p></GlassCard>
            </section>
          ) : null}
          <section>
            <SectionHeader title={t("opportunities.requirements")} />
            <GlassCard material="regular" className="divide-y divide-[var(--fm-hairline)] py-1">
              {facts.filter(([, v]) => v != null && v !== "").map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-3 text-[15px]">
                  <span className="text-ink-2">{k}</span>
                  <span className="text-right font-medium">{v}</span>
                </div>
              ))}
            </GlassCard>
            {mandatory.length ? (
              <p className="mt-2 px-1 text-[13px] text-ink-2">
                {t("opportunities.mandatoryList", { list: mandatory.map((r) => t(`reasons.crit.${r.criterion}`)).join(", ") })}
              </p>
            ) : null}
          </section>
          {raw.conditions ? (
            <section>
              <SectionHeader title={t("opportunities.conditions")} />
              <GlassCard material="regular"><p className="whitespace-pre-line text-[15px] leading-relaxed">{raw.conditions}</p></GlassCard>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {match ? (
            <GlassCard material="regular" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{t("opportunities.yourFit")}</p>
                <MatchPill score={match.score} eligible={match.eligible} size="lg" />
              </div>
              <MatchReasons match={match} max={6} />
              <p className="text-[11px] text-ink-3">{t("reasons.method")}</p>
            </GlassCard>
          ) : null}
          {mode === "player" && row.status === "open" ? (
            <ApplyPanel
              opportunityId={row.id}
              org={{ id: row.organization_id, name: row.org_name, crestUrl }}
              application={application}
              blockedByGuardian={session.isMinor && !session.guardianApproved}
              interested={interested}
            />
          ) : null}
          {mode === "player" && row.status !== "open" && application ? (
            <GlassCard material="thin" className="flex items-center justify-between">
              <span className="font-medium">{t("opportunities.yourApplication")}</span>
              <GlassBadge tone="blue">{t(`football.app.${application.status}`)}</GlassBadge>
            </GlassCard>
          ) : null}
          {isOwner ? (
            <GlassCard material="elevated" className="flex flex-col gap-3">
              <p className="font-semibold">{t("opportunities.manage")}</p>
              <OwnerStatusControl id={row.id} status={row.status} />
              <div className="flex gap-2">
                <Link href={`/club/pipeline?opportunity=${row.id}`} className="flex-1">
                  <GlassButton className="w-full"><KanbanSquare className="size-4" /> {t("opportunities.applicationsCount", { n: appCount })}</GlassButton>
                </Link>
                <Link href={`/opportunities/${row.id}/edit`}>
                  <GlassButton variant="glass" size="icon" aria-label={t("common.edit")}><Pencil className="size-4" /></GlassButton>
                </Link>
              </div>
              <Link href={`/discover?opportunity=${row.id}`}><GlassButton variant="ghost" className="w-full">{t("opportunities.findPlayers")}</GlassButton></Link>
            </GlassCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
