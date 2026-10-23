import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, FileText } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { EmptyState, GlassBadge, GlassButton, GlassCard } from "@/components/glass/primitives";
import { Crest } from "@/components/cards/cards";
import { Reveal, RevealItem } from "@/components/app/reveal";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { publicAssetUrl } from "@/lib/media";
import { APPLICATION_STATUSES } from "@/domains/football/catalog";
import { cn } from "@/lib/cn";

export const metadata = { title: "Mis candidaturas" };

// Etapas que ve el jugador (sin las internas del club como "revisada").
const STAGES = ["received", "shortlisted", "contacted", "trial_scheduled", "selected"] as const;

export default async function ApplicationsPage() {
  const session = await requireApp();
  if (appMode(session) === "organization") redirect("/club/pipeline");
  const supabase = await createClient();
  const { t, f } = await getI18n();
  const { data } = await supabase
    .from("applications")
    .select("id, status, created_at, updated_at, opportunity:opportunities(id, title, organization:organizations(id, name, crest_path)), history:application_status_history(id, to_status, created_at)")
    .eq("applicant_id", session.userId)
    .order("updated_at", { ascending: false });
  type Row = { id: string; status: string; created_at: string; updated_at: string; opportunity: { id: string; title: string; organization: { id: string; name: string; crest_path: string | null } | null } | null; history: Array<{ id: number; to_status: string; created_at: string }> };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <GlassNavbar title={t("nav.applications")} subtitle={t("applications.subtitle")} />
      {rows.length === 0 ? (
        <EmptyState icon={<FileText className="size-7" />} title={t("home.noApplications")} body={t("home.noApplicationsBody")}
          action={<Link href="/opportunities"><GlassButton>{t("nav.opportunities")}</GlassButton></Link>} />
      ) : (
        <Reveal className="flex flex-col gap-3">
          {rows.map((a) => {
            const stageIndex = STAGES.indexOf(a.status as (typeof STAGES)[number]);
            const effective = stageIndex >= 0 ? stageIndex : a.status === "reviewed" ? 0 : a.status === "evaluating" ? 3 : -1;
            const ended = a.status === "rejected" || a.status === "withdrawn";
            return (
              <RevealItem key={a.id}>
                <GlassCard material="regular" className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Crest url={publicAssetUrl(a.opportunity?.organization?.crest_path)} name={a.opportunity?.organization?.name ?? "—"} id={a.opportunity?.organization?.id ?? a.id} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink-2">{a.opportunity?.organization?.name}</p>
                      <Link href={`/opportunities/${a.opportunity?.id}`} className="fm-title block truncate text-[16px] uppercase">{a.opportunity?.title}</Link>
                    </div>
                    <GlassBadge tone={a.status === "selected" ? "green" : ended ? (a.status === "rejected" ? "red" : "neutral") : "blue"}>{t(`football.app.${a.status}`)}</GlassBadge>
                  </div>
                  {!ended ? (
                    <ol className="flex items-center gap-1" aria-label={t("applications.progress")}>
                      {STAGES.map((s, i) => (
                        <li key={s} className="flex flex-1 flex-col items-center gap-1.5">
                          <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px]", i <= effective ? "bg-accent text-white" : "glass glass-thin text-ink-3")}>
                            {i <= effective ? <Check className="size-3.5" /> : i + 1}
                          </span>
                          <span className={cn("hidden text-center text-[10px] sm:block", i <= effective ? "text-ink" : "text-ink-3")}>{t(`football.app.${s}`)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-ink-2">{t("applications.timeline")} · {f.relative(a.updated_at)}</summary>
                    <ol className="mt-2 flex flex-col gap-1.5">
                      {[...a.history].sort((x, y) => x.created_at.localeCompare(y.created_at)).filter((h) => (APPLICATION_STATUSES as readonly string[]).includes(h.to_status) || h.to_status === "withdrawn").map((h) => (
                        <li key={h.id} className="flex justify-between gap-3">
                          <span>{t(`football.app.${h.to_status}`)}</span>
                          <span className="text-ink-3">{f.date(h.created_at)}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                </GlassCard>
              </RevealItem>
            );
          })}
        </Reveal>
      )}
    </>
  );
}
