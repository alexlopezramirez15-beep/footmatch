"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { GlassButton } from "@/components/glass/primitives";
import { GlassBottomSheet, GlassModal, useToast } from "@/components/glass/overlays";
import { GlassChips, GlassField, GlassTextarea } from "@/components/glass/forms";
import { useI18n } from "@/i18n/client";
import { blockUserAction, reportAction } from "@/domains/safety/actions";

const REASONS = ["spam", "harassment", "inappropriate", "fake_profile", "minor_safety", "scam", "other"] as const;

export function ReportSheet({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: { type: "user" | "organization" | "opportunity" | "message" | "conversation"; id: string };
}) {
  const { t } = useI18n();
  const { push } = useToast();
  const [reason, setReason] = React.useState<(typeof REASONS)[number] | null>(null);
  const [details, setDetails] = React.useState("");
  const [pending, start] = React.useTransition();
  const submit = () =>
    start(async () => {
      if (!reason) return;
      const res = await reportAction({ target: target.type, id: target.id, reason, details });
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      push({ tone: "success", title: t("common.reported") });
      setReason(null);
      setDetails("");
      onClose();
    });
  return (
    <GlassBottomSheet open={open} onClose={onClose} title={t("safety.reportTitle")}>
      <div className="flex flex-col gap-4">
        <GlassField label={t("common.reason")}>
          <GlassChips options={REASONS.map((r) => ({ value: r, label: t(`safety.reason.${r}`) }))} value={reason ? [reason] : []} onChange={(v) => setReason(v[0] ?? null)} />
        </GlassField>
        <GlassField label={t("common.details")} hint={t("common.optional")}>
          <GlassTextarea rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
        </GlassField>
        <GlassButton variant="danger" size="lg" disabled={!reason} loading={pending} onClick={submit}><Flag className="size-4" /> {t("safety.sendReport")}</GlassButton>
        <p className="text-xs text-ink-3">{t("safety.reportHint")}</p>
      </div>
    </GlassBottomSheet>
  );
}

/** Menú "···" con reportar y (si hay usuario) bloquear. */
export function SafetyMenu({ target, blockUserId, afterBlock = "/home" }: { target: { type: "user" | "organization" | "opportunity" | "conversation"; id: string }; blockUserId?: string | null; afterBlock?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [menu, setMenu] = React.useState(false);
  const [report, setReport] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [pending, start] = React.useTransition();
  const block = () =>
    start(async () => {
      if (!blockUserId) return;
      const res = await blockUserAction(blockUserId);
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      push({ tone: "info", title: t("safety.blocked") });
      setConfirm(false);
      router.push(afterBlock);
    });
  return (
    <>
      <GlassButton variant="glass" size="icon" aria-label={t("safety.more")} onClick={() => setMenu(true)}>
        <MoreHorizontal className="size-5" />
      </GlassButton>
      <GlassBottomSheet open={menu} onClose={() => setMenu(false)}>
        <div className="flex flex-col gap-2 pb-2">
          <GlassButton variant="glass" size="lg" className="justify-start" onClick={() => { setMenu(false); setReport(true); }}>
            <Flag className="size-4" /> {t("common.report")}
          </GlassButton>
          {blockUserId ? (
            <GlassButton variant="glass" size="lg" className="justify-start text-danger" onClick={() => { setMenu(false); setConfirm(true); }}>
              <Ban className="size-4" /> {t("common.block")}
            </GlassButton>
          ) : null}
        </div>
      </GlassBottomSheet>
      <ReportSheet open={report} onClose={() => setReport(false)} target={target} />
      <GlassModal open={confirm} onClose={() => setConfirm(false)} title={t("safety.blockTitle")}>
        <p className="text-[15px] text-ink-2">{t("safety.blockBody")}</p>
        <div className="mt-5 flex gap-3">
          <GlassButton variant="ghost" className="flex-1" onClick={() => setConfirm(false)}>{t("common.cancel")}</GlassButton>
          <GlassButton variant="danger" className="flex-1" loading={pending} onClick={block}>{t("common.block")}</GlassButton>
        </div>
      </GlassModal>
    </>
  );
}
