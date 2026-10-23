import type { CandidateFacts, CriterionKey, TargetSpec } from "./engine";
import { requirementsFromRows } from "./engine";
import type { OpportunityRow, OrganizationRow, PlayerCardRow, RequirementRow } from "@/lib/types";

export function playerToFacts(p: PlayerCardRow): CandidateFacts {
  return {
    position: p.position,
    secondaryPositions: p.secondary_positions ?? [],
    age: p.age,
    category: p.category,
    experienceYears: p.experience_years,
    country: p.country,
    region: p.region,
    city: p.city,
    mobility: p.mobility,
    willingToRelocate: p.willing_to_relocate,
    availability: p.availability,
    languages: p.languages ?? [],
    foot: p.dominant_foot,
    heightCm: p.height_cm,
  };
}

export function opportunityToSpec(o: Pick<OpportunityRow,
  "type" | "positions" | "age_min" | "age_max" | "category" | "country" | "region" | "city" | "languages">,
  requirements: RequirementRow[] = []): TargetSpec {
  return {
    kind: o.type,
    positions: o.positions ?? [],
    ageMin: o.age_min,
    ageMax: o.age_max,
    category: o.category,
    country: o.country,
    region: o.region,
    city: o.city,
    languages: o.languages ?? [],
    requirements: requirementsFromRows(requirements),
  };
}

/** Cuando un club explora sin oportunidad concreta, se usa su perfil como referencia. */
export function organizationToSpec(org: Pick<OrganizationRow, "country" | "region" | "city" | "categories">): TargetSpec {
  return {
    kind: "club",
    country: org.country,
    region: org.region,
    city: org.city,
    category: org.categories?.[0] ?? null,
  };
}

export async function loadWeights(
  supabase: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<{ weights: Partial<Record<CriterionKey, number>>; enabled: Partial<Record<CriterionKey, boolean>> }> {
  const { data } = await supabase.from("matching_criteria").select("criterion, weight, enabled");
  const weights: Partial<Record<CriterionKey, number>> = {};
  const enabled: Partial<Record<CriterionKey, boolean>> = {};
  for (const row of (data ?? []) as Array<{ criterion: CriterionKey; weight: number; enabled: boolean }>) {
    weights[row.criterion] = row.weight;
    enabled[row.criterion] = row.enabled;
  }
  return { weights, enabled };
}
