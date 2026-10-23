"use client";

import * as React from "react";
import { ShieldCheck, X } from "lucide-react";
import { GlassButton } from "@/components/glass/primitives";
import { GlassField, GlassInput } from "@/components/glass/forms";
import { useToast } from "@/components/glass/overlays";
import { useI18n } from "@/i18n/client";
import { acceptGuardianAction, rejectGuardianAction, revokeGuardianAction } from "@/domains/settings/actions";
import { useRouter } from "next/navigation";

export function AcceptGuardianForm({ token, needsBirthDate }: { token: string; needsBirthDate: boolean }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [birth, setBirth] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const [pending, start] = React.useTransition();
  const accept = () =>
    start(async () => {
      const res = await acceptGuardianAction(token, birth || null);
      if (res && !res.ok) push({ tone: "error", title: t(res.error) });
    });
  const reject = () =>
    start(async () => {
      const res = await rejectGuardianAction(token);
      if (res && !res.ok) push({ tone: "error", title: t(res.error) });
    });
  return (
    <div className="flex flex-col gap-4">
      {needsBirthDate ? (
        <GlassField label={t("onboarding.birthDate")} hint={t("guardian.birthHint")}>
          <GlassInput type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
        </GlassField>
      ) : null}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--fm-accent)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>{t("guardian.declaration")}</span>
      </label>
      <GlassButton size="lg" loading={pending} disabled={!agree || (needsBirthDate && !birth)} onClick={accept}><ShieldCheck className="size-4" /> {t("guardian.accept")}</GlassButton>
      <GlassButton variant="ghost" disabled={pending} onClick={reject}><X className="size-4" /> {t("guardian.reject")}</GlassButton>
    </div>
  );
}

export function RevokeButton({ minorId }: { minorId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [pending, start] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  return confirm ? (
    <div className="flex gap-2">
      <GlassButton size="sm" variant="ghost" onClick={() => setConfirm(false)}>{t("common.cancel")}</GlassButton>
      <GlassButton size="sm" variant="danger" loading={pending} onClick={() => start(async () => {
        const r = await revokeGuardianAction(minorId);
        if (!r.ok) return push({ tone: "error", title: t(r.error) });
        router.refresh();
      })}>{t("common.confirm")}</GlassButton>
    </div>
  ) : (
    <GlassButton size="sm" variant="glass" onClick={() => setConfirm(true)}>{t("guardian.revoke")}</GlassButton>
  );
}
