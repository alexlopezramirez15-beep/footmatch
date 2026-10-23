"use client";

import * as React from "react";
import { GlassButton } from "@/components/glass/primitives";
import { GlassChips, GlassField, GlassInput, GlassSelect, GlassSwitch, GlassTextarea } from "@/components/glass/forms";
import { useToast } from "@/components/glass/overlays";
import { useFootballOptions } from "@/components/app/options";
import { useI18n } from "@/i18n/client";
import { createOpportunityAction, updateOpportunityAction } from "@/domains/opportunities/actions";
import type { OpportunityRow, RequirementRow } from "@/lib/types";

type Req = { criterion: string; mandatory: boolean; weight: number; value: Record<string, unknown> };
const MANDATORY_CHOICES = ["position", "age", "availability", "category", "location", "languages"] as const;

export function OpportunityForm({
  initial,
  initialRequirements = [],
  defaults,
  compact,
  submitLabel,
  onDone,
}: {
  initial?: Partial<OpportunityRow>;
  initialRequirements?: RequirementRow[];
  defaults?: { country?: string | null; region?: string | null; city?: string | null; category?: string | null };
  compact?: boolean;
  submitLabel?: string;
  onDone?: (id: string) => void;
}) {
  const { t } = useI18n();
  const o = useFootballOptions();
  const { push } = useToast();
  const [pending, start] = React.useTransition();
  const [v, setV] = React.useState({
    type: initial?.type ?? "player",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? defaults?.category ?? "",
    positions: initial?.positions ?? [],
    age_min: initial?.age_min?.toString() ?? "",
    age_max: initial?.age_max?.toString() ?? "",
    languages: initial?.languages ?? [],
    country: initial?.country ?? defaults?.country ?? "ES",
    region: initial?.region ?? defaults?.region ?? "",
    city: initial?.city ?? defaults?.city ?? "",
    conditions: initial?.conditions ?? "",
    slots: initial?.slots?.toString() ?? "",
    starts_on: initial?.starts_on ?? "",
    deadline: initial?.deadline ?? "",
    status: (initial?.status === "expired" ? "closed" : initial?.status) ?? "open",
  });
  const [reqs, setReqs] = React.useState<Record<string, Req>>(() =>
    Object.fromEntries(initialRequirements.map((r) => [r.criterion, { ...r, value: r.value ?? {} }])),
  );
  const set = (k: keyof typeof v, val: unknown) => setV((s) => ({ ...s, [k]: val }));
  const toggleMandatory = (c: string, on: boolean) =>
    setReqs((r) => {
      const next = { ...r };
      if (on) next[c] = { criterion: c, mandatory: true, weight: next[c]?.weight ?? 20, value: next[c]?.value ?? {} };
      else if (next[c]?.value && Object.keys(next[c].value).length) next[c] = { ...next[c], mandatory: false };
      else delete next[c];
      return next;
    });
  const setValue = (c: string, value: Record<string, unknown> | null) =>
    setReqs((r) => {
      const next = { ...r };
      if (!value) {
        if (next[c] && !next[c].mandatory) delete next[c];
        else if (next[c]) next[c] = { ...next[c], value: {} };
      } else next[c] = { criterion: c, mandatory: next[c]?.mandatory ?? false, weight: next[c]?.weight ?? 10, value };
      return next;
    });

  const submit = () =>
    start(async () => {
      const payload = {
        ...v,
        description: v.description || null,
        category: v.category || null,
        region: v.region || null,
        city: v.city || null,
        conditions: v.conditions || null,
        age_min: v.age_min || null,
        age_max: v.age_max || null,
        slots: v.slots || null,
        requirements: Object.values(reqs),
      };
      const res = initial?.id ? await updateOpportunityAction(initial.id, payload) : await createOpportunityAction(payload);
      if (!res.ok) {
        push({ tone: "error", title: t(res.error) });
        return;
      }
      push({ tone: "success", title: t("common.saved") });
      onDone?.(initial?.id ?? (res.data as { id: string }).id);
    });

  const isPlayerType = v.type === "player" || v.type === "trial" || v.type === "scouting_call";

  return (
    <div className="flex flex-col gap-5">
      {!compact ? (
        <GlassField label={t("opportunities.type")}>
          <GlassSelect value={v.type} onChange={(e) => set("type", e.target.value)}>
            {o.opportunityTypes.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </GlassSelect>
        </GlassField>
      ) : null}
      <GlassField label={t("onboarding.oppTitle")} htmlFor="opp_title">
        <GlassInput id="opp_title" value={v.title} maxLength={140} placeholder={t("opportunities.titlePh")} onChange={(e) => set("title", e.target.value)} />
      </GlassField>
      {isPlayerType ? (
        <GlassField label={t("onboarding.oppPositions")}>
          <GlassChips multiple max={6} options={o.positions} value={v.positions} onChange={(x) => set("positions", x)} />
        </GlassField>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <GlassField label={t("onboarding.ageMin")} htmlFor="age_min">
          <GlassInput id="age_min" type="number" inputMode="numeric" value={v.age_min} onChange={(e) => set("age_min", e.target.value)} />
        </GlassField>
        <GlassField label={t("onboarding.ageMax")} htmlFor="age_max">
          <GlassInput id="age_max" type="number" inputMode="numeric" value={v.age_max} onChange={(e) => set("age_max", e.target.value)} />
        </GlassField>
      </div>
      <GlassField label={t("onboarding.category")}>
        <GlassSelect value={v.category} onChange={(e) => set("category", e.target.value)}>
          <option value="">—</option>
          {o.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </GlassSelect>
      </GlassField>
      {!compact ? (
        <>
          <GlassField label={t("onboarding.description")} htmlFor="opp_desc">
            <GlassTextarea id="opp_desc" value={v.description} maxLength={5000} onChange={(e) => set("description", e.target.value)} />
          </GlassField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <GlassField label={t("onboarding.country")}>
              <GlassSelect value={v.country ?? ""} onChange={(e) => set("country", e.target.value)}>
                {o.countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label={t("onboarding.region")}>
              <GlassInput value={v.region ?? ""} onChange={(e) => set("region", e.target.value)} />
            </GlassField>
            <GlassField label={t("onboarding.city")}>
              <GlassInput value={v.city ?? ""} onChange={(e) => set("city", e.target.value)} />
            </GlassField>
          </div>
          <GlassField label={t("onboarding.languages")}>
            <GlassChips multiple options={o.languages} value={v.languages} onChange={(x) => set("languages", x)} />
          </GlassField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <GlassField label={t("opportunities.slots")}>
              <GlassInput type="number" inputMode="numeric" value={v.slots} onChange={(e) => set("slots", e.target.value)} />
            </GlassField>
            <GlassField label={t("opportunities.startsOn")}>
              <GlassInput type="date" value={v.starts_on ?? ""} onChange={(e) => set("starts_on", e.target.value)} />
            </GlassField>
            <GlassField label={t("opportunities.deadline")}>
              <GlassInput type="date" value={v.deadline ?? ""} onChange={(e) => set("deadline", e.target.value)} />
            </GlassField>
          </div>
          <GlassField label={t("opportunities.conditions")}>
            <GlassTextarea rows={3} value={v.conditions} maxLength={2000} onChange={(e) => set("conditions", e.target.value)} />
          </GlassField>
        </>
      ) : null}

      <div className="glass glass-thin rounded-[24px] p-4">
        <p className="text-[15px] font-semibold">{t("opportunities.mandatoryTitle")}</p>
        <p className="mb-2 text-[13px] text-ink-2">{t("opportunities.mandatoryHint")}</p>
        <div className="divide-y divide-[var(--fm-hairline)]">
          {MANDATORY_CHOICES.map((c) => (
            <GlassSwitch key={c} label={t(`reasons.crit.${c}`)} checked={Boolean(reqs[c]?.mandatory)} onChange={(on) => toggleMandatory(c, on)} />
          ))}
        </div>
        {!compact ? (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[var(--fm-hairline)] pt-4 sm:grid-cols-3">
            <GlassField label={t("opportunities.minHeight")}>
              <GlassInput type="number" inputMode="numeric" value={(reqs.height?.value?.min_cm as string) ?? ""} onChange={(e) => setValue("height", e.target.value ? { min_cm: Number(e.target.value) } : null)} />
            </GlassField>
            <GlassField label={t("opportunities.minExperience")}>
              <GlassInput type="number" inputMode="numeric" value={(reqs.experience?.value?.min_years as string) ?? ""} onChange={(e) => setValue("experience", e.target.value ? { min_years: Number(e.target.value) } : null)} />
            </GlassField>
            <GlassField label={t("onboarding.foot")}>
              <GlassSelect value={(reqs.foot?.value?.foot as string) ?? ""} onChange={(e) => setValue("foot", e.target.value ? { foot: e.target.value } : null)}>
                <option value="">—</option>
                <option value="right">{t("football.foot.right")}</option>
                <option value="left">{t("football.foot.left")}</option>
              </GlassSelect>
            </GlassField>
          </div>
        ) : null}
      </div>

      {!compact ? (
        <GlassField label={t("opportunities.statusLabel")}>
          <GlassSelect value={v.status} onChange={(e) => set("status", e.target.value)}>
            <option value="open">{t("football.status.open")}</option>
            <option value="draft">{t("football.status.draft")}</option>
            <option value="closed">{t("football.status.closed")}</option>
            <option value="suspended">{t("football.status.suspended")}</option>
          </GlassSelect>
        </GlassField>
      ) : null}

      <GlassButton variant="primary" size="lg" className="justify-center" loading={pending} disabled={v.title.trim().length < 4} onClick={submit}>
        {submitLabel ?? t("common.save")}
      </GlassButton>
    </div>
  );
}
