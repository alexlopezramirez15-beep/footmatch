"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GlassButton } from "@/components/glass/primitives";
import { GlassChips, GlassField, GlassInput, GlassSelect, GlassTextarea } from "@/components/glass/forms";
import { useToast } from "@/components/glass/overlays";
import { useFootballOptions } from "@/components/app/options";
import { useI18n } from "@/i18n/client";
import { createTrialAction } from "@/domains/trials/actions";

export function TrialForm({
  defaults,
  applicationId,
  candidateName,
  opportunities,
}: {
  defaults: { country: string | null; city: string | null; category: string | null; opportunityId?: string | null; positions?: string[] };
  applicationId?: string | null;
  candidateName?: string | null;
  opportunities: Array<{ id: string; title: string }>;
}) {
  const { t } = useI18n();
  const o = useFootballOptions();
  const router = useRouter();
  const { push } = useToast();
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [v, setV] = React.useState({
    title: "", description: "", location: "", city: defaults.city ?? "", country: defaults.country ?? "ES",
    starts_at: "", ends_at: "", category: defaults.category ?? "", positions: defaults.positions ?? ([] as string[]),
    age_min: "", age_max: "", slots: "", requirements: "", documentation: "", cost_info: "", instructions: "",
    opportunity_id: defaults.opportunityId ?? "",
  });
  const set = (k: keyof typeof v, val: unknown) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: string) => (errors[k] ? t(`trials.err.${errors[k]}`) : null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const payload = {
        ...v,
        age_min: v.age_min || null, age_max: v.age_max || null, slots: v.slots || null,
        opportunity_id: v.opportunity_id || null, country: v.country || null,
      };
      const res = await createTrialAction(payload, applicationId ?? null);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return push({ tone: "error", title: t(res.error) });
      }
      if (res.message) push({ tone: "warning", title: t(res.message) });
      else push({ tone: "success", title: applicationId ? t("trials.proposed") : t("trials.created") });
      router.push(res.data?.conversationId ? `/chats/${res.data.conversationId}` : `/trials/${res.data!.id}`);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {candidateName ? <p className="glass glass-tint-green rounded-2xl p-3 text-sm">{t("trials.forCandidate", { name: candidateName })}</p> : null}
      <GlassField label={t("trials.title")} error={err("title")}>
        <GlassInput required minLength={4} maxLength={140} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder={t("trials.titlePh")} />
      </GlassField>
      <div className="grid gap-4 sm:grid-cols-2">
        <GlassField label={t("trials.startsAt")} error={err("starts_at")}>
          <GlassInput type="datetime-local" required value={v.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
        </GlassField>
        <GlassField label={t("trials.endsAt")} optional={t("common.optional")} error={err("ends_at")}>
          <GlassInput type="datetime-local" value={v.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
        </GlassField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassField label={t("trials.location")}>
          <GlassInput value={v.location} onChange={(e) => set("location", e.target.value)} placeholder={t("trials.locationPh")} />
        </GlassField>
        <GlassField label={t("onboarding.city")}>
          <GlassInput value={v.city} onChange={(e) => set("city", e.target.value)} />
        </GlassField>
        <GlassField label={t("onboarding.country")}>
          <GlassSelect value={v.country} onChange={(e) => set("country", e.target.value)}>
            {o.countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </GlassSelect>
        </GlassField>
      </div>
      <GlassField label={t("onboarding.category")}>
        <GlassSelect value={v.category} onChange={(e) => set("category", e.target.value)}>
          <option value="">—</option>
          {o.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </GlassSelect>
      </GlassField>
      <GlassField label={t("onboarding.oppPositions")}>
        <GlassChips multiple options={o.positionsShort} value={v.positions} onChange={(x) => set("positions", x)} />
      </GlassField>
      <div className="grid grid-cols-3 gap-4">
        <GlassField label={t("onboarding.ageMin")}><GlassInput type="number" inputMode="numeric" min={6} max={50} value={v.age_min} onChange={(e) => set("age_min", e.target.value)} /></GlassField>
        <GlassField label={t("onboarding.ageMax")} error={err("age_max")}><GlassInput type="number" inputMode="numeric" min={6} max={50} value={v.age_max} onChange={(e) => set("age_max", e.target.value)} /></GlassField>
        <GlassField label={t("opportunities.slots")}><GlassInput type="number" inputMode="numeric" min={1} max={500} value={v.slots} onChange={(e) => set("slots", e.target.value)} /></GlassField>
      </div>
      {opportunities.length ? (
        <GlassField label={t("trials.linkedOpportunity")} optional={t("common.optional")}>
          <GlassSelect value={v.opportunity_id} onChange={(e) => set("opportunity_id", e.target.value)}>
            <option value="">—</option>
            {opportunities.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </GlassSelect>
        </GlassField>
      ) : null}
      <GlassField label={t("onboarding.description")}><GlassTextarea rows={4} maxLength={4000} value={v.description} onChange={(e) => set("description", e.target.value)} /></GlassField>
      <GlassField label={t("trials.requirements")} optional={t("common.optional")}><GlassTextarea rows={3} maxLength={2000} value={v.requirements} onChange={(e) => set("requirements", e.target.value)} /></GlassField>
      <GlassField label={t("trials.documentation")} optional={t("common.optional")}><GlassTextarea rows={2} maxLength={2000} value={v.documentation} onChange={(e) => set("documentation", e.target.value)} placeholder={t("trials.documentationPh")} /></GlassField>
      <div className="grid gap-4 sm:grid-cols-2">
        <GlassField label={t("trials.cost")} optional={t("common.optional")}><GlassInput maxLength={500} value={v.cost_info} onChange={(e) => set("cost_info", e.target.value)} placeholder={t("trials.costPh")} /></GlassField>
        <GlassField label={t("trials.instructions")} optional={t("common.optional")}><GlassInput maxLength={2000} value={v.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder={t("trials.instructionsPh")} /></GlassField>
      </div>
      <GlassButton type="submit" size="lg" loading={pending}>{applicationId ? t("trials.createAndPropose") : t("trials.publish")}</GlassButton>
    </form>
  );
}
