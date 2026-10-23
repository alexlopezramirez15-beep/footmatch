"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { GlassButton, GlassCard } from "@/components/glass/primitives";
import { GlassChips, GlassField, GlassInput, GlassSelect, GlassTextarea } from "@/components/glass/forms";
import { useToast } from "@/components/glass/overlays";
import { useFootballOptions } from "@/components/app/options";
import { useI18n } from "@/i18n/client";
import { saveProProfileAction } from "@/domains/onboarding/actions";
import { UEFA_LICENSES } from "@/domains/football/catalog";

export function ProForm({ role, personal, values }: { role: "coach" | "agent" | "scout"; personal: Record<string, string>; values: Record<string, unknown> }) {
  const { t } = useI18n();
  const o = useFootballOptions();
  const { push } = useToast();
  const [p, setP] = React.useState(personal);
  const [v, setV] = React.useState<Record<string, unknown>>(values);
  const [pending, start] = React.useTransition();
  const arr = (k: string) => (v[k] as string[] | undefined) ?? [];
  const str = (k: string) => (v[k] as string | undefined) ?? "";
  const set = (k: string, x: unknown) => setV((s) => ({ ...s, [k]: x }));

  const payload = () => {
    if (role === "coach")
      return {
        licenses: arr("licenses"), experience_years: Number(v.experience_years ?? 0), categories: arr("categories"),
        methodology: str("methodology") || null, specialties: arr("specialties"), languages: arr("languages"),
        previous_teams: typeof v.previous_teams === "string" ? (v.previous_teams as string).split(",").map((x) => x.trim()).filter(Boolean) : arr("previous_teams"),
      };
    if (role === "agent")
      return { agency_name: str("agency_name") || null, license_number: str("license_number") || null, license_authority: str("license_authority") || null, languages: arr("languages"), markets: arr("markets") };
    return { regions: typeof v.regions === "string" ? (v.regions as string).split(",").map((x) => x.trim()).filter(Boolean) : arr("regions"), focus_positions: arr("focus_positions") };
  };

  return (
    <div>
      <h1 className="fm-display text-[32px]">{t("onboarding.pro.title")}</h1>
      <p className="mt-1.5 text-[15px] text-ink-2">{t(`football.role.${role}`)}</p>
      <GlassCard material="regular" radius="xl" className="mt-6 flex flex-col gap-5 p-5 sm:p-6">
        <GlassField label={t("auth.fullName")}>
          <GlassInput value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} />
        </GlassField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GlassField label={t("onboarding.birthDate")}>
            <GlassInput type="date" value={p.birth_date} onChange={(e) => setP({ ...p, birth_date: e.target.value })} />
          </GlassField>
          <GlassField label={t("onboarding.country")}>
            <GlassSelect value={p.country} onChange={(e) => setP({ ...p, country: e.target.value })}>
              {o.countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </GlassSelect>
          </GlassField>
          <GlassField label={t("onboarding.city")}>
            <GlassInput value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} />
          </GlassField>
        </div>
        {role === "coach" && (
          <>
            <GlassField label={t("onboarding.licenses")}>
              <GlassChips multiple options={UEFA_LICENSES.map((l) => ({ value: l, label: l.replaceAll("_", " ") }))} value={arr("licenses")} onChange={(x) => set("licenses", x)} />
            </GlassField>
            <GlassField label={t("onboarding.experience")}>
              <GlassInput type="number" inputMode="numeric" value={str("experience_years") || String(v.experience_years ?? "")} onChange={(e) => set("experience_years", e.target.value)} />
            </GlassField>
            <GlassField label={t("onboarding.categories")}>
              <GlassChips multiple options={o.categories} value={arr("categories")} onChange={(x) => set("categories", x)} />
            </GlassField>
            <GlassField label={t("onboarding.methodology")}>
              <GlassTextarea value={str("methodology")} onChange={(e) => set("methodology", e.target.value)} />
            </GlassField>
            <GlassField label={t("onboarding.previousTeams")}>
              <GlassInput value={typeof v.previous_teams === "string" ? (v.previous_teams as string) : arr("previous_teams").join(", ")} onChange={(e) => set("previous_teams", e.target.value)} />
            </GlassField>
          </>
        )}
        {role === "agent" && (
          <>
            <GlassField label={t("onboarding.agencyName")}>
              <GlassInput value={str("agency_name")} onChange={(e) => set("agency_name", e.target.value)} />
            </GlassField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label={t("onboarding.licenseNumber")}>
                <GlassInput value={str("license_number")} onChange={(e) => set("license_number", e.target.value)} />
              </GlassField>
              <GlassField label={t("onboarding.licenseAuthority")}>
                <GlassInput value={str("license_authority")} placeholder="FIFA / RFEF" onChange={(e) => set("license_authority", e.target.value)} />
              </GlassField>
            </div>
            <GlassField label={t("onboarding.markets")}>
              <GlassChips multiple options={o.countries} value={arr("markets")} onChange={(x) => set("markets", x)} />
            </GlassField>
          </>
        )}
        {role === "scout" && (
          <>
            <GlassField label={t("onboarding.regions")}>
              <GlassInput value={typeof v.regions === "string" ? (v.regions as string) : arr("regions").join(", ")} onChange={(e) => set("regions", e.target.value)} />
            </GlassField>
            <GlassField label={t("onboarding.focusPositions")}>
              <GlassChips multiple options={o.positions} value={arr("focus_positions")} onChange={(x) => set("focus_positions", x)} />
            </GlassField>
          </>
        )}
        {role !== "scout" ? (
          <GlassField label={t("onboarding.languages")}>
            <GlassChips multiple options={o.languages} value={arr("languages")} onChange={(x) => set("languages", x)} />
          </GlassField>
        ) : null}
        <div className="glass glass-tint-blue flex gap-3 rounded-2xl p-4 text-[13px] text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-info" /> {t("onboarding.proNotice")}
        </div>
        <GlassButton
          variant="primary"
          size="lg"
          className="justify-center"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await saveProProfileAction(role, p, payload());
              if (res && !res.ok) push({ tone: "error", title: t(res.error) });
            })
          }
        >
          {t("onboarding.finish")}
        </GlassButton>
      </GlassCard>
    </div>
  );
}
