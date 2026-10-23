import Link from "next/link";
import { CalendarDays, MapPin, Plus, Users } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { DemoBadge, EmptyState, GlassBadge, GlassButton, GlassCard, SectionHeader } from "@/components/glass/primitives";
import { Crest } from "@/components/cards/cards";
import { Reveal, RevealItem } from "@/components/app/reveal";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { publicAssetUrl } from "@/lib/media";
import type { TrialRow } from "@/lib/types";

export const metadata = { title: "Pruebas" };

type TrialJoin = TrialRow & { organization: { id: string; name: string; crest_path: string | null } | null; trial_applications?: { count: number }[] };

export default async function TrialsPage() {
  const session = await requireApp();
  const supabase = await createClient();
  const { t, f } = await getI18n();
  const org = appMode(session) === "organization" ? session.activeOrg!.organization : null;

  const card = (tr: TrialJoin, extra?: React.ReactNode) => (
    <Link href={`/trials/${tr.id}`} className="block">
      <GlassCard material="regular" interactive className="flex gap-4">
        <div className="glass glass-tint-green flex w-16 shrink-0 flex-col items-center justify-center rounded-[20px] py-2 text-center">
          <span className="text-[11px] font-semibold uppercase">{f.date(tr.starts_at, { month: "short" })}</span>
          <span className="fm-number text-[26px] leading-none">{f.date(tr.starts_at, { day: "numeric" })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            {tr.organization ? <Crest url={publicAssetUrl(tr.organization.crest_path)} name={tr.organization.name} id={tr.organization.id} size={20} /> : null}
            <span className="truncate text-[13px] text-ink-2">{tr.organization?.name}</span>
            {tr.is_demo ? <DemoBadge /> : null}
          </div>
          <p className="fm-title truncate text-[16px]">{tr.title}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-2">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{f.time(tr.starts_at)}</span>
            {tr.city || tr.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{[tr.location, tr.city].filter(Boolean).join(", ")}</span> : null}
            {tr.age_min || tr.age_max ? <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{tr.age_min ?? "–"}–{tr.age_max ?? "–"}</span> : null}
          </div>
        </div>
        {extra}
      </GlassCard>
    </Link>
  );

  if (org) {
    const { data } = await supabase.from("trials").select("*, organization:organizations(id, name, crest_path), trial_applications(count)").eq("organization_id", org.id).order("starts_at", { ascending: false });
    const rows = (data ?? []) as TrialJoin[];
    return (
      <>
        <GlassNavbar title={t("nav.trials")} subtitle={t("trials.orgSubtitle")} actions={<Link href="/trials/new"><GlassButton size="sm"><Plus className="size-4" /> {t("trials.new")}</GlassButton></Link>} />
        {rows.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-7" />} title={t("trials.noneOrg")} body={t("trials.noneOrgBody")} action={<Link href="/trials/new"><GlassButton><Plus className="size-4" /> {t("trials.new")}</GlassButton></Link>} />
        ) : (
          <Reveal className="flex flex-col gap-3">
            {rows.map((tr) => (
              <RevealItem key={tr.id}>
                {card(tr, <div className="flex flex-col items-end gap-1"><GlassBadge tone={tr.status === "open" ? "green" : "neutral"}>{t(`trials.status.${tr.status}`)}</GlassBadge><span className="text-xs text-ink-2">{t("trials.enrollmentsCount", { n: tr.trial_applications?.[0]?.count ?? 0 })}</span></div>)}
              </RevealItem>
            ))}
          </Reveal>
        )}
      </>
    );
  }

  const [{ data: upcoming }, { data: mine }] = await Promise.all([
    supabase.from("trials").select("*, organization:organizations(id, name, crest_path)").eq("status", "open").gt("starts_at", new Date().toISOString()).order("starts_at").limit(60),
    supabase.from("trial_applications").select("id, status, trial:trials(*, organization:organizations(id, name, crest_path))").eq("player_id", session.userId).order("created_at", { ascending: false }),
  ]);
  const mineRows = ((mine ?? []) as unknown as Array<{ id: string; status: string; trial: TrialJoin | null }>).filter((m) => m.trial);
  const mineIds = new Set(mineRows.map((m) => m.trial!.id));
  const open = ((upcoming ?? []) as TrialJoin[]).filter((tr) => !mineIds.has(tr.id));
  return (
    <>
      <GlassNavbar title={t("nav.trials")} subtitle={t("trials.playerSubtitle")} />
      <div className="flex flex-col gap-8">
        {mineRows.length ? (
          <section>
            <SectionHeader title={t("trials.mine")} />
            <div className="flex flex-col gap-3">
              {mineRows.map((m) => <div key={m.id}>{card(m.trial!, <GlassBadge tone={m.status === "accepted" ? "green" : m.status === "rejected" ? "red" : "blue"}>{t(`football.trial.${m.status}`)}</GlassBadge>)}</div>)}
            </div>
          </section>
        ) : null}
        <section>
          <SectionHeader title={t("trials.upcoming")} />
          {open.length === 0 ? (
            <EmptyState icon={<CalendarDays className="size-7" />} title={t("trials.none")} body={t("trials.noneBody")} />
          ) : (
            <Reveal className="flex flex-col gap-3">
              {open.map((tr) => <RevealItem key={tr.id}>{card(tr)}</RevealItem>)}
            </Reveal>
          )}
        </section>
      </div>
    </>
  );
}
