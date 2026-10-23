"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GlassBadge, GlassButton, GlassCard } from "@/components/glass/primitives";
import { GlassInput, GlassSelect, GlassSwitch } from "@/components/glass/forms";
import { useToast } from "@/components/glass/overlays";
import { useI18n } from "@/i18n/client";
import type { ActionResult } from "@/lib/types";
import {
  adminAgentVerificationAction, adminOrgSuspensionAction, adminOrgVerificationAction, adminPurgeDemoAction, adminResolveReportAction,
  adminSaveWeightsAction, adminUserSuspensionAction,
} from "@/domains/admin/actions";

function useRun() {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return push({ tone: "error", title: t(r.error) });
      push({ tone: "success", title: ok ?? t("common.saved") });
      router.refresh();
    });
  return { run, pending };
}

export function VerificationRow({ kind, id, name, evidence, createdAt }: { kind: "organization" | "agent"; id: string; name: string; evidence: string | null; createdAt: string }) {
  const { t, f } = useI18n();
  const { run, pending } = useRun();
  const [note, setNote] = React.useState("");
  const act = (status: "verified" | "rejected") =>
    run(() => (kind === "organization" ? adminOrgVerificationAction(id, status, note) : adminAgentVerificationAction(id, status, note)));
  return (
    <GlassCard material="regular" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="truncate font-semibold">{name}</p><p className="text-[12px] text-ink-2">{t(`admin.kind.${kind}`)} · {f.relative(createdAt)}</p></div>
        <GlassBadge tone="amber">{t("common.pending")}</GlassBadge>
      </div>
      {evidence ? <p className="whitespace-pre-line rounded-2xl bg-black/5 p-3 text-sm dark:bg-white/5">{evidence}</p> : null}
      <GlassInput placeholder={t("admin.notePh")} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <GlassButton className="flex-1" loading={pending} onClick={() => act("verified")}>{t("admin.approve")}</GlassButton>
        <GlassButton className="flex-1" variant="danger" disabled={pending} onClick={() => act("rejected")}>{t("admin.reject")}</GlassButton>
      </div>
    </GlassCard>
  );
}

export function ReportRow({ id, status, reason, details, target, createdAt }: { id: string; status: string; reason: string; details: string | null; target: string; createdAt: string }) {
  const { t, f } = useI18n();
  const { run, pending } = useRun();
  const [note, setNote] = React.useState("");
  return (
    <GlassCard material="regular" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="font-semibold">{t(`safety.reason.${reason}`)}</p><p className="text-[12px] text-ink-2">{target} · {f.relative(createdAt)}</p></div>
        <GlassBadge tone={status === "open" ? "red" : status === "reviewing" ? "amber" : "neutral"}>{t(`admin.rstatus.${status}`)}</GlassBadge>
      </div>
      {details ? <p className="text-sm">{details}</p> : null}
      {status === "open" || status === "reviewing" ? (
        <>
          <GlassInput placeholder={t("admin.notePh")} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <GlassButton size="sm" variant="glass" disabled={pending} onClick={() => run(() => adminResolveReportAction(id, "reviewing", note))}>{t("admin.rstatus.reviewing")}</GlassButton>
            <GlassButton size="sm" disabled={pending} onClick={() => run(() => adminResolveReportAction(id, "resolved", note))}>{t("admin.rstatus.resolved")}</GlassButton>
            <GlassButton size="sm" variant="ghost" disabled={pending} onClick={() => run(() => adminResolveReportAction(id, "dismissed", note))}>{t("admin.rstatus.dismissed")}</GlassButton>
          </div>
        </>
      ) : null}
    </GlassCard>
  );
}

export function SuspendButton({ kind, id, suspended }: { kind: "user" | "organization"; id: string; suspended: boolean }) {
  const { t } = useI18n();
  const { run, pending } = useRun();
  return (
    <GlassButton size="sm" variant={suspended ? "glass" : "danger"} loading={pending}
      onClick={() => run(() => (kind === "user" ? adminUserSuspensionAction(id, !suspended) : adminOrgSuspensionAction(id, !suspended)))}>
      {suspended ? t("admin.reactivate") : t("admin.suspend")}
    </GlassButton>
  );
}

export function OrgVerificationSelect({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const { run, pending } = useRun();
  return (
    <GlassSelect aria-label={t("admin.verification")} className="h-10 w-40 text-sm" value={status} disabled={pending} onChange={(e) => run(() => adminOrgVerificationAction(id, e.target.value, null))}>
      {["unverified", "pending", "verified", "rejected"].map((s) => <option key={s} value={s}>{t(`home.verif.${s}`)}</option>)}
    </GlassSelect>
  );
}

export function WeightsEditor({ rows }: { rows: Array<{ criterion: string; weight: number; enabled: boolean }> }) {
  const { t } = useI18n();
  const { run, pending } = useRun();
  const [list, setList] = React.useState(rows);
  const total = list.filter((r) => r.enabled).reduce((s, r) => s + r.weight, 0);
  return (
    <GlassCard material="regular" className="flex flex-col gap-3">
      {list.map((r, i) => (
        <div key={r.criterion} className="flex items-center gap-3">
          <div className="flex-1"><GlassSwitch checked={r.enabled} label={t(`reasons.crit.${r.criterion}`)} onChange={(v) => setList((l) => l.map((x, j) => (j === i ? { ...x, enabled: v } : x)))} /></div>
          <input type="range" min={0} max={50} value={r.weight} aria-label={t(`reasons.crit.${r.criterion}`)} onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} className="w-32 accent-[var(--fm-accent)]" />
          <span className="w-10 text-right text-sm tabular">{r.weight}</span>
        </div>
      ))}
      <p className="text-xs text-ink-3">{t("admin.weightsHint", { total })}</p>
      <GlassButton loading={pending} onClick={() => run(() => adminSaveWeightsAction(list))}>{t("common.save")}</GlassButton>
    </GlassCard>
  );
}

export function PurgeDemo({ count }: { count: number }) {
  const { t } = useI18n();
  const { run, pending } = useRun();
  const [confirm, setConfirm] = React.useState("");
  return (
    <GlassCard material="tint-red" className="flex flex-col gap-3">
      <p className="font-semibold">{t("admin.purgeTitle")}</p>
      <p className="text-sm">{t("admin.purgeBody", { n: count })}</p>
      <GlassInput placeholder="PURGE" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label={t("admin.purgeType")} />
      <GlassButton variant="danger" disabled={confirm !== "PURGE" || count === 0} loading={pending} onClick={() => run(() => adminPurgeDemoAction(confirm), t("admin.purged"))}>{t("admin.purge")}</GlassButton>
    </GlassCard>
  );
}
