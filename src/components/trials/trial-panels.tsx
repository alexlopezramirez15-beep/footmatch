"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Send, Star, Undo2 } from "lucide-react";
import { GlassAvatar, GlassBadge, GlassButton, GlassCard, GlassSegmentedControl } from "@/components/glass/primitives";
import { GlassBottomSheet, useToast } from "@/components/glass/overlays";
import { GlassField, GlassSelect, GlassSwitch, GlassTextarea } from "@/components/glass/forms";
import { useI18n } from "@/i18n/client";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import { TRIAL_APPLICATION_STATUSES } from "@/domains/football/catalog";
import { enrollTrialAction, saveEvaluationAction, setTrialApplicationStatusAction, setTrialStatusAction, withdrawTrialAction } from "@/domains/trials/actions";

export function EnrollPanel({ trialId, enrollment, open, blockedByGuardian }: { trialId: string; enrollment: { id: string; status: string } | null; open: boolean; blockedByGuardian: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [sheet, setSheet] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [pending, start] = React.useTransition();
  const enroll = () =>
    start(async () => {
      const res = await enrollTrialAction(trialId, msg);
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      haptic("success");
      setSheet(false);
      push({ tone: "success", title: t("trials.enrolled") });
      router.refresh();
    });
  const withdraw = () =>
    start(async () => {
      if (!enrollment) return;
      const res = await withdrawTrialAction(enrollment.id);
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      router.refresh();
    });
  if (enrollment) {
    return (
      <GlassCard material="elevated" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{t("trials.yourEnrollment")}</p>
          <GlassBadge tone={enrollment.status === "accepted" ? "green" : enrollment.status === "rejected" ? "red" : "blue"}>{t(`football.trial.${enrollment.status}`)}</GlassBadge>
        </div>
        {["sent", "pending", "accepted", "waitlist"].includes(enrollment.status) ? (
          <GlassButton variant="ghost" loading={pending} onClick={withdraw}><Undo2 className="size-4" /> {t("trials.withdraw")}</GlassButton>
        ) : null}
      </GlassCard>
    );
  }
  if (!open) return <GlassCard material="thin" className="text-sm text-ink-2">{t("trials.notOpen")}</GlassCard>;
  if (blockedByGuardian) return <GlassCard material="tint-amber" className="text-sm">{t("opportunities.needsGuardianBody")}</GlassCard>;
  return (
    <>
      <GlassButton size="lg" className="w-full" onClick={() => setSheet(true)}><Send className="size-4" /> {t("trials.enroll")}</GlassButton>
      <GlassBottomSheet open={sheet} onClose={() => setSheet(false)} title={t("trials.enroll")}>
        <div className="flex flex-col gap-4">
          <GlassField label={t("opportunities.messageLabel")} optional={t("common.optional")}>
            <GlassTextarea rows={4} maxLength={1000} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </GlassField>
          <GlassButton size="lg" loading={pending} onClick={enroll}>{t("trials.confirmEnroll")}</GlassButton>
        </div>
      </GlassBottomSheet>
    </>
  );
}

export function TrialStatusControl({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [value, setValue] = React.useState(status);
  const opts = (["open", "full", "closed", "completed", "cancelled"] as const).map((s) => ({ value: s, label: t(`trials.status.${s}`) }));
  return (
    <div className="no-scrollbar overflow-x-auto">
      <GlassSegmentedControl
        id="trial-status"
        size="sm"
        className="w-max"
        options={opts}
        value={value as (typeof opts)[number]["value"]}
        onChange={async (v) => {
          const prev = value;
          setValue(v);
          const res = await setTrialStatusAction(id, v);
          if (!res.ok) {
            setValue(prev);
            return push({ tone: "error", title: t(res.error) });
          }
          router.refresh();
        }}
      />
    </div>
  );
}

export type EnrollmentVM = { id: string; status: string; message: string | null; createdAt: string; player: { id: string; name: string; photoUrl: string | null; position: string; age: number | null }; evaluated: boolean };

const CRITERIA = ["technique", "tactics", "physical", "attitude", "potential"] as const;

export function EnrollmentsManager({ items, canEdit }: { items: EnrollmentVM[]; canEdit: boolean }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [evaluating, setEvaluating] = React.useState<EnrollmentVM | null>(null);
  const [ratings, setRatings] = React.useState<Record<string, number>>({});
  const [summary, setSummary] = React.useState("");
  const [nextSteps, setNextSteps] = React.useState("");
  const [shared, setShared] = React.useState(false);
  const [pending, start] = React.useTransition();

  const change = (id: string, status: string) =>
    start(async () => {
      const res = await setTrialApplicationStatusAction(id, status);
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      router.refresh();
    });
  const saveEval = () =>
    start(async () => {
      if (!evaluating) return;
      const res = await saveEvaluationAction({ trialApplicationId: evaluating.id, ratings, summary, next_steps: nextSteps, shared });
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      push({ tone: "success", title: t("trials.evaluationSaved") });
      setEvaluating(null);
      setRatings({});
      setSummary("");
      setNextSteps("");
      router.refresh();
    });

  if (!items.length) return <p className="px-1 text-sm text-ink-2">{t("trials.noEnrollments")}</p>;
  return (
    <>
      <GlassCard material="regular" padded={false} className="divide-y divide-[var(--fm-hairline)]">
        {items.map((e) => (
          <div key={e.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Link href={`/players/${e.player.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <GlassAvatar src={e.player.photoUrl} name={e.player.name} seed={e.player.id} size={44} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{e.player.name}</p>
                <p className="truncate text-[13px] text-ink-2">{e.player.position}{e.player.age != null ? ` · ${e.player.age}` : ""} · {f.relative(e.createdAt)}</p>
                {e.message ? <p className="line-clamp-2 text-[13px]">{e.message}</p> : null}
              </div>
            </Link>
            <div className="flex items-center gap-2">
              {e.status === "withdrawn" ? (
                <GlassBadge tone="neutral">{t("football.trial.withdrawn")}</GlassBadge>
              ) : (
                <GlassSelect aria-label={t("pipeline.status")} value={e.status} disabled={!canEdit || pending} onChange={(ev) => change(e.id, ev.target.value)} className="h-10 w-44 text-sm">
                  {TRIAL_APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{t(`football.trial.${s}`)}</option>)}
                </GlassSelect>
              )}
              {canEdit && ["accepted", "attended", "evaluated"].includes(e.status) ? (
                <GlassButton size="sm" variant="glass" onClick={() => setEvaluating(e)}><ClipboardCheck className="size-4" /> {e.evaluated ? t("trials.evaluateAgain") : t("trials.evaluate")}</GlassButton>
              ) : null}
            </div>
          </div>
        ))}
      </GlassCard>
      <GlassBottomSheet open={Boolean(evaluating)} onClose={() => setEvaluating(null)} title={evaluating ? t("trials.evaluationOf", { name: evaluating.player.name }) : ""}>
        <div className="flex flex-col gap-4">
          {CRITERIA.map((c) => (
            <div key={c} className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-medium">{t(`trials.crit.${c}`)}</span>
              <div className="flex gap-1" role="radiogroup" aria-label={t(`trials.crit.${c}`)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={ratings[c] === n} aria-label={`${n}/5`} onClick={() => setRatings((r) => ({ ...r, [c]: n }))} className="p-1">
                    <Star className={cn("size-6", (ratings[c] ?? 0) >= n ? "fill-current text-warn" : "text-ink-3")} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <GlassField label={t("trials.summary")}><GlassTextarea rows={4} maxLength={4000} value={summary} onChange={(e) => setSummary(e.target.value)} /></GlassField>
          <GlassField label={t("trials.nextSteps")}><GlassTextarea rows={2} maxLength={1000} value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} /></GlassField>
          <GlassSwitch checked={shared} onChange={setShared} label={t("trials.shareWithPlayer")} description={t("trials.shareHint")} />
          <GlassButton size="lg" loading={pending} disabled={Object.keys(ratings).length === 0} onClick={saveEval}>{t("common.save")}</GlassButton>
        </div>
      </GlassBottomSheet>
    </>
  );
}
