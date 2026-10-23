"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/client";
import {
  AVAILABILITY, CATEGORIES, COUNTRIES, FEET, LANGUAGES, MOBILITY, OPPORTUNITY_TYPES, POSITIONS, countryName, languageName,
} from "@/domains/football/catalog";
import { INTL_LOCALE } from "@/i18n/config";

export function useFootballOptions() {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const l = INTL_LOCALE[locale];
    return {
      positions: POSITIONS.map((p) => ({ value: p, label: t(`football.pos.${p}`) })),
      positionsShort: POSITIONS.map((p) => ({ value: p, label: p })),
      categories: CATEGORIES.map((c) => ({ value: c.key, label: t(`football.cat.${c.key}`) })),
      availability: AVAILABILITY.map((a) => ({ value: a, label: t(`football.av.${a}`) })),
      mobility: MOBILITY.map((m) => ({ value: m, label: t(`football.mob.${m}`) })),
      feet: FEET.map((f) => ({ value: f, label: t(`football.foot.${f}`) })),
      countries: [...COUNTRIES].map((c) => ({ value: c, label: countryName(c, l) })).sort((a, b) => a.label.localeCompare(b.label, l)),
      languages: LANGUAGES.map((c) => ({ value: c, label: languageName(c, l) })),
      opportunityTypes: OPPORTUNITY_TYPES.map((o) => ({ value: o, label: t(`football.opp.${o}`) })),
    };
  }, [t, locale]);
}
