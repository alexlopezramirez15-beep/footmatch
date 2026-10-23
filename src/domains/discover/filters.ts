import { z } from "zod";
import type { MatchResult } from "@/domains/matching/engine";

/** Filtros de Descubrir, guardados por usuario en discover_preferences.filters. */
export const discoverFiltersSchema = z.object({
  positions: z.array(z.string()).max(20).default([]),
  ageMin: z.number().int().min(10).max(50).nullable().default(null),
  ageMax: z.number().int().min(10).max(50).nullable().default(null),
  countries: z.array(z.string().length(2)).max(20).default([]),
  availability: z.array(z.string()).max(10).default([]),
  types: z.array(z.string()).max(10).default([]),
  onlyEligible: z.boolean().default(false),
  minScore: z.number().int().min(0).max(100).default(0),
});

export type DiscoverFilters = z.infer<typeof discoverFiltersSchema>;
export const EMPTY_FILTERS: DiscoverFilters = discoverFiltersSchema.parse({});

export function parseFilters(raw: unknown): DiscoverFilters {
  const r = discoverFiltersSchema.safeParse(raw ?? {});
  return r.success ? r.data : EMPTY_FILTERS;
}

export function activeFilterCount(f: DiscoverFilters) {
  return (
    (f.positions.length ? 1 : 0) + (f.ageMin != null || f.ageMax != null ? 1 : 0) + (f.countries.length ? 1 : 0) +
    (f.availability.length ? 1 : 0) + (f.types.length ? 1 : 0) + (f.onlyEligible ? 1 : 0) + (f.minScore > 0 ? 1 : 0)
  );
}

type PlayerLike = { position: string; secondary_positions?: string[] | null; age: number | null; country: string | null; availability: string };
type OppLike = { type: string; positions: string[] | null; country: string | null };

function common(match: MatchResult, f: DiscoverFilters) {
  if (f.onlyEligible && !match.eligible) return false;
  if (f.minScore > 0 && match.score < f.minScore) return false;
  return true;
}

export function filterPlayers<T extends { row: PlayerLike; match: MatchResult }>(items: T[], f: DiscoverFilters) {
  return items.filter(({ row, match }) => {
    if (!common(match, f)) return false;
    if (f.positions.length && !f.positions.includes(row.position) && !(row.secondary_positions ?? []).some((p) => f.positions.includes(p))) return false;
    if (f.ageMin != null && (row.age == null || row.age < f.ageMin)) return false;
    if (f.ageMax != null && (row.age == null || row.age > f.ageMax)) return false;
    if (f.countries.length && (!row.country || !f.countries.includes(row.country))) return false;
    if (f.availability.length && !f.availability.includes(row.availability)) return false;
    return true;
  });
}

export function filterOpportunities<T extends { row: OppLike; match: MatchResult }>(items: T[], f: DiscoverFilters) {
  return items.filter(({ row, match }) => {
    if (!common(match, f)) return false;
    if (f.types.length && !f.types.includes(row.type)) return false;
    if (f.positions.length && (row.positions ?? []).length && !(row.positions ?? []).some((p) => f.positions.includes(p))) return false;
    if (f.countries.length && (!row.country || !f.countries.includes(row.country))) return false;
    return true;
  });
}
