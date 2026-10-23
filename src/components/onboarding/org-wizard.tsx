"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ChevronLeft, GraduationCap, Plus, Shield, Trash2 } from "lucide-react";
import { GlassButton, GlassCard } from "@/components/glass/primitives";
import { GlassChips, GlassField, GlassInput, GlassSelect, GlassStepper, GlassTextarea } from "@/components/glass/forms";
import { useToast } from "@/components/glass/overlays";
import { useFootballOptions } from "@/components/app/options";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { useI18n } from "@/i18n/client";
import { addTeamAction, completeOnboardingAction, removeTeamAction, saveOrgStepAction } from "@/domains/onboarding/actions";
import { cn } from "@/lib/cn";

export type OrgWizardInitial = {
  step: number;
  values: Record<string, unknown>;
  teams: Array<{ id: string; name: string; category: string | null }>;
  hasOrg: boolean;
  verificationRequested: boolean;
};

const TOTAL = 7;

/** mode "edit": edición del club ya creado (sin el paso de primera oportunidad). */
export function OrgWizard({ initial, mode = "onboarding" }: { initial: OrgWizardInitial; mode?: "onboarding" | "edit" }) {
  const { t } = useI18n();
  const editing = mode === "edit";
  const LAST = editing ? 6 : TOTAL;
  const o = useFootballOptions();
  const { push } = useToast();
  const router = useRouter();
  const [step, setStep] = React.useState(initial.hasOrg ? Math.min(Math.max(initial.step, 1), mode === "edit" ? 6 : TOTAL) : 1);
  const [dir, setDir] = React.useState(1);
  const [v, setV] = React.useState<Record<string, unknown>>(initial.values);
  const [teams, setTeams] = React.useState(initial.teams);
  const [team, setTeam] = React.useState({ name: "", category: "" });
  const [pending, start] = React.useTransition();
  const [verificationSent, setVerificationSent] = React.useState(initial.verificationRequested);

  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));
  const str = (k: string) => (v[k] as string | null | undefined) ?? "";
  const arr = (k: string) => (v[k] as string[] | undefined) ?? [];
  const orgType = (str("type") || "club") as "club" | "academy";

  const payloadFor = (s: number) => {
    const pick = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, v[k] === "" ? null : v[k]]));
    switch (s) {
      case 1: return { ...pick("name", "description", "founded_year"), type: orgType };
      case 2: return pick("country", "region", "city", "facilities", "website", "contact_email");
      case 4: return { competition: v.competition || null, categories: arr("categories") };
      case 5: return pick("full_name", "title", "birth_date");
      case 6: return { evidence: verificationSent ? null : v.evidence || null };
      default: return {};
    }
  };

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () =>
    start(async () => {
      const res = await saveOrgStepAction(step, payloadFor(step));
      if (!res.ok) {
        push({ tone: "error", title: t(res.error) });
        return;
      }
      if (step === 6 && v.evidence && !verificationSent) {
        setVerificationSent(true);
        push({ tone: "success", title: t("onboarding.verificationSent") });
      }
      if (step === 1) router.refresh();
      if (editing) {
        push({ tone: "success", title: t("common.saved") });
        if (step === LAST) {
          router.push("/club");
          router.refresh();
          return;
        }
      }
      go(step + 1);
    });

  return (
    <div>
      {editing ? (
        <nav aria-label={t("profile.sections")} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {Array.from({ length: LAST }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-current={n === step ? "step" : undefined}
              onClick={() => go(n)}
              className={n === step ? "glass glass-tint-green h-9 shrink-0 rounded-full px-4 text-sm font-medium" : "glass glass-thin h-9 shrink-0 rounded-full px-4 text-sm text-ink-2"}
            >
              {t(`onboarding.c.s${n}`)}
            </button>
          ))}
        </nav>
      ) : (
        <GlassStepper step={step - 1} total={TOTAL} label={t("onboarding.stepOf", { n: step, total: TOTAL })} />
      )}
      <div className="mt-6 mb-6">
        <h1 className="fm-display text-[32px]">{t(`onboarding.c.s${step}`)}</h1>
        <p className="mt-1.5 text-[15px] text-ink-2">{t(`onboarding.c.s${step}d`)}</p>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
          <GlassCard material="regular" radius="xl" className="flex flex-col gap-5 p-5 sm:p-6">
            {step === 1 && (
              <>
                <GlassField label={t("onboarding.orgType")}>
                  <div className="grid grid-cols-2 gap-3">
                    {(["club", "academy"] as const).map((ty) => (
                      <button
                        key={ty}
                        type="button"
                        disabled={initial.hasOrg}
                        onClick={() => set("type", ty)}
                        className={cn("glass flex items-center gap-3 rounded-2xl p-4 text-left disabled:opacity-60", orgType === ty ? "glass-elevated shadow-[var(--shadow-glow)]" : "glass-thin")}
                        aria-pressed={orgType === ty}
                      >
                        {ty === "club" ? <Shield className="size-5 text-accent" /> : <GraduationCap className="size-5 text-accent" />}
                        <span className="font-semibold">{t(`football.org.${ty}`)}</span>
                      </button>
                    ))}
                  </div>
                </GlassField>
                <GlassField label={t("onboarding.orgName")} htmlFor="name">
                  <GlassInput id="name" value={str("name")} onChange={(e) => set("name", e.target.value)} />
                </GlassField>
                <GlassField label={t("onboarding.description")} htmlFor="description" optional={t("common.optional")}>
                  <GlassTextarea id="description" value={str("description")} maxLength={3000} onChange={(e) => set("description", e.target.value)} />
                </GlassField>
                {orgType === "club" ? (
                  <GlassField label={t("onboarding.founded")} htmlFor="founded_year" optional={t("common.optional")}>
                    <GlassInput id="founded_year" type="number" inputMode="numeric" value={str("founded_year")} onChange={(e) => set("founded_year", e.target.value)} />
                  </GlassField>
                ) : null}
              </>
            )}
            {step === 2 && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <GlassField label={t("onboarding.country")}>
                    <GlassSelect value={str("country") || "ES"} onChange={(e) => set("country", e.target.value)}>
                      {o.countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </GlassSelect>
                  </GlassField>
                  <GlassField label={t("onboarding.region")}>
                    <GlassInput value={str("region")} onChange={(e) => set("region", e.target.value)} />
                  </GlassField>
                  <GlassField label={t("onboarding.city")}>
                    <GlassInput value={str("city")} onChange={(e) => set("city", e.target.value)} />
                  </GlassField>
                </div>
                <GlassField label={t("onboarding.facilities")} optional={t("common.optional")}>
                  <GlassTextarea rows={3} value={str("facilities")} onChange={(e) => set("facilities", e.target.value)} />
                </GlassField>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <GlassField label={t("onboarding.website")} optional={t("common.optional")}>
                    <GlassInput type="url" placeholder="https://" value={str("website")} onChange={(e) => set("website", e.target.value)} />
                  </GlassField>
                  <GlassField label={t("onboarding.contactEmail")} optional={t("common.optional")}>
                    <GlassInput type="email" value={str("contact_email")} onChange={(e) => set("contact_email", e.target.value)} />
                  </GlassField>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <GlassInput aria-label={t("onboarding.teamName")} placeholder={t("onboarding.teamName")} value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} />
                  <GlassSelect aria-label={t("onboarding.teamCategory")} value={team.category} onChange={(e) => setTeam({ ...team, category: e.target.value })}>
                    <option value="">{t("onboarding.teamCategory")}</option>
                    {o.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </GlassSelect>
                  <GlassButton
                    disabled={team.name.length < 2}
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await addTeamAction({ name: team.name, category: team.category || null });
                        if (!res.ok) return push({ tone: "error", title: t(res.error) });
                        setTeams((s) => [...s, { id: res.data!.id, name: team.name, category: team.category || null }]);
                        setTeam({ name: "", category: "" });
                      })
                    }
                  >
                    <Plus className="size-4" /> {t("onboarding.addTeam")}
                  </GlassButton>
                </div>
                <ul className="flex flex-col gap-2">
                  {teams.length === 0 ? <li className="text-sm text-ink-3">{t("onboarding.noTeams")}</li> : null}
                  {teams.map((tm) => (
                    <li key={tm.id} className="glass glass-thin flex items-center justify-between rounded-2xl px-4 py-3">
                      <div>
                        <p className="font-semibold">{tm.name}</p>
                        {tm.category ? <p className="text-[13px] text-ink-2">{t(`football.cat.${tm.category}`)}</p> : null}
                      </div>
                      <button aria-label={t("common.delete")} className="flex size-9 items-center justify-center rounded-full text-ink-3 hover:text-danger" onClick={() => start(async () => { await removeTeamAction(tm.id); setTeams((s) => s.filter((x) => x.id !== tm.id)); })}>
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {step === 4 && (
              <>
                <GlassField label={t("onboarding.competition")}>
                  <GlassSelect value={str("competition")} onChange={(e) => set("competition", e.target.value)}>
                    <option value="">—</option>
                    {o.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </GlassSelect>
                </GlassField>
                <GlassField label={t("onboarding.categories")}>
                  <GlassChips multiple options={o.categories} value={arr("categories")} onChange={(x) => set("categories", x)} />
                </GlassField>
              </>
            )}
            {step === 5 && (
              <>
                <GlassField label={t("auth.fullName")}>
                  <GlassInput value={str("full_name")} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" />
                </GlassField>
                <GlassField label={t("onboarding.yourRole")}>
                  <GlassInput value={str("title")} placeholder={t("onboarding.yourRolePh")} onChange={(e) => set("title", e.target.value)} />
                </GlassField>
                <GlassField label={t("onboarding.birthDate")} hint={t("onboarding.tooYoungForRole")}>
                  <GlassInput type="date" value={str("birth_date")} onChange={(e) => set("birth_date", e.target.value)} />
                </GlassField>
              </>
            )}
            {step === 6 && (
              verificationSent ? (
                <div className="glass glass-tint-green flex items-center gap-3 rounded-2xl p-4">
                  <BadgeCheck className="size-6" />
                  <p className="font-medium">{t("onboarding.verificationSent")}</p>
                </div>
              ) : (
                <GlassField label={t("onboarding.evidence")}>
                  <GlassTextarea value={str("evidence")} placeholder={t("onboarding.evidencePh")} onChange={(e) => set("evidence", e.target.value)} />
                </GlassField>
              )
            )}
            {step === 7 && (
              <OpportunityForm
                compact
                defaults={{ country: str("country"), region: str("region"), city: str("city"), category: str("competition") || null }}
                submitLabel={t("onboarding.createAndFinish")}
                onDone={() => start(async () => { await completeOnboardingAction(); })}
              />
            )}
          </GlassCard>
        </motion.div>
      </AnimatePresence>
      <div className="sticky bottom-0 z-10 mt-6 flex items-center gap-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        {step > 1 ? (
          <GlassButton size="icon" aria-label={t("common.back")} onClick={() => go(step - 1)} disabled={pending}>
            <ChevronLeft className="size-5" />
          </GlassButton>
        ) : null}
        {step === TOTAL && !editing ? (
          <GlassButton variant="glass" size="lg" className="flex-1 justify-center" loading={pending} onClick={() => start(async () => { await completeOnboardingAction(); })}>
            {t("onboarding.skip")}
          </GlassButton>
        ) : (
          <GlassButton variant="primary" size="lg" className="flex-1 justify-center" loading={pending} onClick={next} disabled={step === 1 && str("name").length < 2}>
            {step === 6 && !verificationSent && v.evidence ? t("onboarding.requestVerification") : editing ? (step === LAST ? t("profile.done") : t("profile.saveContinue")) : t("common.next")}
          </GlassButton>
        )}
      </div>
    </div>
  );
}
