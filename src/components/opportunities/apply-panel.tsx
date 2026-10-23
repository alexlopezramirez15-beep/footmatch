"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Send, ShieldAlert, Undo2 } from "lucide-react";
import { GlassBadge, GlassButton, GlassCard, GlassSegmentedControl } from "@/components/glass/primitives";
import { GlassBottomSheet, useToast } from "@/components/glass/overlays";
import { GlassField, GlassTextarea } from "@/components/glass/forms";
import { useI18n } from "@/i18n/client";
import { haptic } from "@/lib/haptics";
import { applyAction, setOpportunityStatusAction, withdrawApplicationAction } from "@/domains/opportunities/actions";
import { playerInterestAction } from "@/domains/interests/actions";
import { MatchOverlay, type MatchOverlayData } from "@/components/discover/match-overlay";

export function ApplyPanel({
  opportunityId,
  org,
  application,
  blockedByGuardian,
  interested,
}: {
  opportunityId: string;
  org: { id: string; name: string; crestUrl: string | null };
  application: { id: string; status: string } | null;
  blockedByGuardian: boolean;
  interested: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [pending, start] = React.useTransition();
  const [liked, setLiked] = React.useState(interested);
  const [match, setMatch] = React.useState<MatchOverlayData | null>(null);

  const apply = () =>
    start(async () => {
      const res = await applyAction(opportunityId, message.trim() || null);
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      haptic("success");
      push({ tone: "success", title: t("opportunities.appliedToast") });
      setOpen(false);
      router.refresh();
    });

  const withdraw = () =>
    start(async () => {
      if (!application) return;
      const res = await withdrawApplicationAction(application.id);
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      push({ tone: "info", title: t("opportunities.withdrawn") });
      router.refresh();
    });

  const like = () =>
    start(async () => {
      const res = await playerInterestAction({ opportunityId }, "like");
      if (!res.ok && res.error !== "discover.alreadyActed") return push({ tone: "error", title: t(res.error) });
      setLiked(true);
      haptic("success");
      if (res.ok && res.data?.matched)
        setMatch({ otherName: org.name, otherImage: org.crestUrl, otherId: org.id, profileHref: `/clubs/${org.id}`, conversationId: res.data.conversationId });
    });

  if (blockedByGuardian) {
    return (
      <GlassCard material="tint-amber" className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warn" />
        <div>
          <p className="font-semibold">{t("opportunities.needsGuardian")}</p>
          <p className="mt-1 text-sm text-ink-2">{t("opportunities.needsGuardianBody")}</p>
          <Link href="/settings#guardian" className="mt-2 inline-block text-sm font-semibold text-accent-strong dark:text-accent">{t("opportunities.manageGuardian")}</Link>
        </div>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard material="elevated" className="flex flex-col gap-3">
        {application ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{t("opportunities.yourApplication")}</p>
              <GlassBadge tone={application.status === "rejected" ? "red" : application.status === "selected" ? "green" : "blue"}>
                {t(`football.app.${application.status}`)}
              </GlassBadge>
            </div>
            <div className="flex gap-2">
              <Link href="/applications" className="flex-1"><GlassButton variant="glass" className="w-full">{t("opportunities.followUp")}</GlassButton></Link>
              {application.status !== "withdrawn" && application.status !== "rejected" && application.status !== "selected" ? (
                <GlassButton variant="ghost" loading={pending} onClick={withdraw}><Undo2 className="size-4" /> {t("opportunities.withdraw")}</GlassButton>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            <GlassButton size="lg" className="flex-1" onClick={() => setOpen(true)}><Send className="size-4" /> {t("opportunities.apply")}</GlassButton>
            <GlassButton size="icon-lg" variant="glass" aria-label={t("discover.like")} aria-pressed={liked} disabled={liked} loading={pending && !open} onClick={like}>
              <Heart className={liked ? "size-5 fill-current text-accent" : "size-5"} />
            </GlassButton>
          </div>
        )}
        <p className="text-xs text-ink-3">{t("opportunities.applyHint")}</p>
      </GlassCard>
      <GlassBottomSheet open={open} onClose={() => setOpen(false)} title={t("opportunities.applyTitle")}>
        <div className="flex flex-col gap-4">
          <GlassField label={t("opportunities.messageLabel")} hint={t("opportunities.messageHint")}>
            <GlassTextarea rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("opportunities.messagePh")} />
          </GlassField>
          <GlassButton size="lg" loading={pending} onClick={apply}><Send className="size-4" /> {t("opportunities.sendApplication")}</GlassButton>
        </div>
      </GlassBottomSheet>
      <MatchOverlay data={match} onClose={() => setMatch(null)} />
    </>
  );
}

export function OwnerStatusControl({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [value, setValue] = React.useState(status);
  const [pending, start] = React.useTransition();
  const options = (["draft", "open", "closed"] as const).map((s) => ({ value: s, label: t(`football.status.${s}`) }));
  if (status === "expired" || status === "suspended") return <GlassBadge tone="amber">{t(`football.status.${status}`)}</GlassBadge>;
  return (
    <div aria-busy={pending}>
      <GlassSegmentedControl
            id="opp-status"
        options={options}
        value={value as "draft" | "open" | "closed"}
        onChange={(v) =>
          start(async () => {
            const prev = value;
            setValue(v);
            const res = await setOpportunityStatusAction(id, v);
            if (!res.ok) {
              setValue(prev);
              return push({ tone: "error", title: t(res.error) });
            }
            push({ tone: "success", title: t("common.saved") });
            router.refresh();
          })
        }
      />
    </div>
  );
}
