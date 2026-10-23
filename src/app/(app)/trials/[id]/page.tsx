import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Euro, FileText, Info, MapPin, Star, Users } from "lucide-react";
import { DemoBadge, GlassBadge, GlassCard, SectionHeader } from "@/components/glass/primitives";
import { Crest } from "@/components/cards/cards";
import { EnrollPanel, EnrollmentsManager, TrialStatusControl, type EnrollmentVM } from "@/components/trials/trial-panels";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { publicAssetUrl, signPlayerMedia } from "@/lib/media";
import type { PlayerCardRow, TrialRow } from "@/lib/types";

export default async function TrialPage(props: PageProps<"/trials/[id]">) {
  const { id } = await props.params;
  const session = await requireApp();
  const supabase = await createClient();
  const { t, f } = await getI18n();
  const { data } = await supabase.from("trials").select("*, organization:organizations(id, name, crest_path, verification_status)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const tr = data as TrialRow & { organization: { id: string; name: string; crest_path: string | null } | null };
  const member = session.memberships.find((m) => m.organization.id === tr.organization_id);
  const isPlayer = appMode(session) === "player";

  let enrollment: { id: string; status: string } | null = null;
  let evaluations: Array<{ id: string; ratings: Record<string, number>; summary: string | null; next_steps: string | null; created_at: string }> = [];
  let enrollments: EnrollmentVM[] = [];
  if (isPlayer) {
    const [{ data: e }, { data: ev }] = await Promise.all([
      supabase.from("trial_applications").select("id, status").eq("trial_id", id).eq("player_id", session.userId).maybeSingle(),
      supabase.from("evaluations").select("id, ratings, summary, next_steps, created_at, trial_application:trial_applications!inner(trial_id)").eq("player_id", session.userId).eq("trial_application.trial_id", id),
    ]);
    enrollment = e;
    evaluations = (ev ?? []) as typeof evaluations;
  }
  if (member) {
    const { data: rows } = await supabase.from("trial_applications").select("id, status, message, created_at, player_id, evaluations(id)").eq("trial_id", id).order("created_at");
    const ids = (rows ?? []).map((r) => r.player_id as string);
    const { data: cards } = ids.length ? await supabase.from("player_cards").select("*").in("user_id", ids) : { data: [] };
    const cmap = new Map(((cards ?? []) as PlayerCardRow[]).map((c) => [c.user_id, c]));
    const signed = await signPlayerMedia(supabase, [...cmap.values()].map((c) => c.avatar_path));
    enrollments = (rows ?? []).map((r) => {
      const c = cmap.get(r.player_id);
      return {
        id: r.id, status: r.status, message: r.message, createdAt: r.created_at, evaluated: Boolean((r.evaluations as unknown[] | null)?.length),
        player: { id: r.player_id, name: c?.display_name ?? "—", photoUrl: c?.avatar_path ? signed[c.avatar_path] ?? null : null, position: c?.position ?? "—", age: c?.age ?? null },
      };
    });
  }
  const accepted = enrollments.filter((e) => ["accepted", "attended", "evaluated"].includes(e.status)).length;
  const isOpen = tr.status === "open" && new Date(tr.starts_at) > new Date();

  const facts: Array<[React.ReactNode, string, string | null]> = [
    [<CalendarDays key="d" className="size-4" />, t("trials.startsAt"), f.date(tr.starts_at, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })],
    [<Clock key="e" className="size-4" />, t("trials.endsAt"), tr.ends_at ? f.date(tr.ends_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null],
    [<MapPin key="l" className="size-4" />, t("trials.location"), [tr.location, tr.city].filter(Boolean).join(", ") || null],
    [<Users key="a" className="size-4" />, t("opportunities.ages"), tr.age_min || tr.age_max ? `${tr.age_min ?? "–"}–${tr.age_max ?? "–"}` : null],
    [<Users key="s" className="size-4" />, t("opportunities.slots"), tr.slots ? (member ? `${accepted}/${tr.slots}` : String(tr.slots)) : null],
    [<Euro key="c" className="size-4" />, t("trials.cost"), tr.cost_info],
  ];

  return (
    <div className="fm-safe-top pt-3 pb-6">
      <Link href="/trials" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /> {t("nav.trials")}</Link>
      <GlassCard material="elevated" radius="xl" className="relative overflow-hidden">
        <div className="fm-pitch pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative">
          <Link href={`/clubs/${tr.organization_id}`} className="inline-flex items-center gap-2 text-sm font-medium text-ink-2">
            <Crest url={publicAssetUrl(tr.organization?.crest_path)} name={tr.organization?.name ?? "—"} id={tr.organization_id} size={28} /> {tr.organization?.name}
          </Link>
          <h1 className="fm-display mt-2 text-[30px] sm:text-[36px]">{tr.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <GlassBadge tone={tr.status === "open" ? "green" : "neutral"}>{t(`trials.status.${tr.status}`)}</GlassBadge>
            {tr.category ? <GlassBadge tone="neutral">{t(`football.cat.${tr.category}`)}</GlassBadge> : null}
            {tr.positions.map((p) => <GlassBadge key={p} tone="green">{p}</GlassBadge>)}
            {tr.is_demo ? <DemoBadge /> : null}
          </div>
        </div>
      </GlassCard>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facts.filter(([, , v]) => v).map(([icon, label, value]) => (
              <GlassCard key={label} material="regular" className="p-4">
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">{icon}{label}</p>
                <p className="mt-1 text-[14px] font-semibold first-letter:uppercase">{value}</p>
              </GlassCard>
            ))}
          </div>
          {[["description", tr.description, <Info key="i" className="size-4" />], ["requirements", tr.requirements, <Star key="r" className="size-4" />], ["documentation", tr.documentation, <FileText key="d" className="size-4" />], ["instructions", tr.instructions, <Info key="n" className="size-4" />]]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <section key={k as string}>
                <SectionHeader title={t(`trials.${k === "description" ? "about" : k}`)} />
                <GlassCard material="regular"><p className="whitespace-pre-line text-[15px] leading-relaxed">{v as string}</p></GlassCard>
              </section>
            ))}
          {member ? (
            <section>
              <SectionHeader title={t("trials.enrollments")} />
              <EnrollmentsManager items={enrollments} canEdit={member.role !== "scout"} />
            </section>
          ) : null}
          {evaluations.length ? (
            <section>
              <SectionHeader title={t("trials.yourEvaluation")} />
              {evaluations.map((ev) => (
                <GlassCard key={ev.id} material="tint-green" className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ev.ratings).map(([k, n]) => <GlassBadge key={k} tone="neutral">{t(`trials.crit.${k}`)} · {n}/5</GlassBadge>)}
                  </div>
                  {ev.summary ? <p className="whitespace-pre-line">{ev.summary}</p> : null}
                  {ev.next_steps ? <p className="text-sm"><strong>{t("trials.nextSteps")}:</strong> {ev.next_steps}</p> : null}
                </GlassCard>
              ))}
            </section>
          ) : null}
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {isPlayer ? <EnrollPanel trialId={tr.id} enrollment={enrollment} open={isOpen} blockedByGuardian={session.isMinor && !session.guardianApproved} /> : null}
          {member && member.role !== "scout" ? (
            <GlassCard material="elevated" className="flex flex-col gap-3">
              <p className="font-semibold">{t("trials.manage")}</p>
              <TrialStatusControl id={tr.id} status={tr.status} />
              <p className="text-xs text-ink-3">{t("trials.manageHint")}</p>
            </GlassCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
