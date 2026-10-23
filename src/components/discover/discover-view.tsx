"use client";

import * as React from "react";
import { useOnChange } from "@/lib/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { GlassButton, GlassSegmentedControl } from "@/components/glass/primitives";
import { GlassBottomSheet, useToast } from "@/components/glass/overlays";
import { GlassChips, GlassField, GlassInput, GlassSelect, GlassSwitch } from "@/components/glass/forms";
import { useFootballOptions } from "@/components/app/options";
import { useI18n } from "@/i18n/client";
import { saveDiscoverFiltersAction } from "@/domains/discover/actions";
import { EMPTY_FILTERS, activeFilterCount, type DiscoverFilters } from "@/domains/discover/filters";
import { DiscoverDeck, type DeckItem } from "./deck";

export function DiscoverView({
  mode,
  items,
  filters,
  opportunities,
  selectedOpportunity,
  total,
}: {
  mode: "player" | "organization";
  items: DeckItem[];
  filters: DiscoverFilters;
  opportunities?: Array<{ id: string; title: string }>;
  selectedOpportunity?: string | null;
  total: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const count = activeFilterCount(filters);

  const selectOpportunity = (id: string) => {
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("opportunity", id);
    else sp.delete("opportunity");
    router.replace(`/discover${sp.size ? `?${sp}` : ""}`);
  };

  return (
    <>
      <GlassNavbar
        title={t("nav.discover")}
        subtitle={mode === "organization" ? t("discover.orgSubtitle", { n: total }) : t("discover.playerSubtitle", { n: total })}
        actions={
          <GlassButton variant="glass" size="sm" onClick={() => setOpen(true)} aria-label={t("common.filters")}>
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">{t("common.filters")}</span>
            {count ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-white tabular">{count}</span> : null}
          </GlassButton>
        }
      />
      {mode === "organization" && opportunities ? (
        <div className="mb-4">
          <GlassField label={t("discover.rankFor")}>
            <GlassSelect value={selectedOpportunity ?? ""} onChange={(e) => selectOpportunity(e.target.value)}>
              <option value="">{t("discover.rankForClub")}</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>{o.title}</option>
              ))}
            </GlassSelect>
          </GlassField>
        </div>
      ) : null}
      <DiscoverDeck items={items} onOpenFilters={() => setOpen(true)} />
      <FiltersSheet mode={mode} open={open} onClose={() => setOpen(false)} initial={filters} />
    </>
  );
}

function FiltersSheet({ mode, open, onClose, initial }: { mode: "player" | "organization"; open: boolean; onClose: () => void; initial: DiscoverFilters }) {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const opts = useFootballOptions();
  const [f, setF] = React.useState<DiscoverFilters>(initial);
  const [saving, setSaving] = React.useState(false);
  useOnChange(open, (o) => o && setF(initial));
  const set = <K extends keyof DiscoverFilters>(k: K, v: DiscoverFilters[K]) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => (v === "" ? null : Math.max(10, Math.min(50, Number(v))));

  const save = async (next: DiscoverFilters) => {
    setSaving(true);
    const res = await saveDiscoverFiltersAction(next);
    setSaving(false);
    if (!res.ok) return push({ tone: "error", title: t(res.error) });
    onClose();
    router.refresh();
  };

  return (
    <GlassBottomSheet open={open} onClose={onClose} title={t("common.filters")}>
      <div className="flex flex-col gap-5 pb-2">
        {mode === "player" ? (
          <GlassField label={t("discover.fTypes")}>
            <GlassChips multiple options={opts.opportunityTypes} value={f.types} onChange={(v) => set("types", v)} />
          </GlassField>
        ) : null}
        <GlassField label={t("discover.fPositions")}>
          <GlassChips multiple options={opts.positionsShort} value={f.positions} onChange={(v) => set("positions", v)} />
        </GlassField>
        {mode === "organization" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <GlassField label={t("discover.fAgeMin")}>
                <GlassInput type="number" inputMode="numeric" min={10} max={50} value={f.ageMin ?? ""} onChange={(e) => set("ageMin", num(e.target.value))} />
              </GlassField>
              <GlassField label={t("discover.fAgeMax")}>
                <GlassInput type="number" inputMode="numeric" min={10} max={50} value={f.ageMax ?? ""} onChange={(e) => set("ageMax", num(e.target.value))} />
              </GlassField>
            </div>
            <GlassField label={t("discover.fAvailability")}>
              <GlassChips multiple options={opts.availability} value={f.availability} onChange={(v) => set("availability", v)} />
            </GlassField>
          </>
        ) : null}
        <GlassField label={t("discover.fCountries")}>
          <GlassChips multiple max={10} options={opts.countries.filter((c) => ["ES", "PL", "FR", "PT", "IT", "DE", "GB", "NL", "BE", "AD"].includes(c.value))} value={f.countries} onChange={(v) => set("countries", v)} />
        </GlassField>
        <GlassField label={t("discover.fMinScore")}>
          <GlassSegmentedControl
            id="min-score"
            options={[0, 50, 70, 85].map((n) => ({ value: String(n), label: n ? `${n}%+` : t("discover.fAny") }))}
            value={String(f.minScore)}
            onChange={(v) => set("minScore", Number(v))}
          />
        </GlassField>
        <GlassSwitch checked={f.onlyEligible} onChange={(v) => set("onlyEligible", v)} label={t("discover.fOnlyEligible")} description={t("discover.fOnlyEligibleHint")} />
        <div className="flex gap-3 pt-1">
          <GlassButton variant="ghost" className="flex-1" disabled={saving} onClick={() => save(EMPTY_FILTERS)}>{t("common.reset")}</GlassButton>
          <GlassButton className="flex-1" loading={saving} onClick={() => save(f)}>{t("common.apply")}</GlassButton>
        </div>
      </div>
    </GlassBottomSheet>
  );
}
