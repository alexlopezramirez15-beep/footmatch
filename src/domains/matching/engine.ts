/**
 * FOOTMATCH · Motor de compatibilidad deportiva.
 *
 * Determinista y transparente: el porcentaje sale exclusivamente de los datos
 * del perfil y de los requisitos de la oportunidad, ponderados con pesos
 * configurables (tabla matching_criteria + overrides por oportunidad).
 * Nunca se generan valores aleatorios ni se inventan habilidades.
 *
 * - Requisito obligatorio no cumplido ⇒ eligible = false y la puntuación
 *   se limita a MAX_SCORE_WHEN_INELIGIBLE para que nunca parezca un buen encaje.
 * - Criterio sin datos suficientes en el destino ⇒ no se evalúa (no suma ni resta).
 * - Dato ausente en el candidato ⇒ puntúa 0 en ese criterio y se indica.
 */
import { categoryTier, positionAffinity, type Availability, type Mobility } from "@/domains/football/catalog";

export const CRITERIA = [
  "position", "age", "category", "experience", "location", "mobility", "availability", "languages", "foot", "height",
] as const;
export type CriterionKey = (typeof CRITERIA)[number];

export const DEFAULT_WEIGHTS: Record<CriterionKey, number> = {
  position: 30, age: 15, category: 15, experience: 8, location: 10,
  mobility: 5, availability: 10, languages: 4, foot: 2, height: 1,
};

export const MAX_SCORE_WHEN_INELIGIBLE = 49;

export interface CandidateFacts {
  position: string;
  secondaryPositions?: string[];
  age: number | null;
  category: string | null;
  experienceYears?: number | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  mobility?: Mobility | null;
  willingToRelocate?: boolean | null;
  availability: Availability;
  languages?: string[];
  foot?: "right" | "left" | "both" | null;
  heightCm?: number | null;
}

export interface Requirement {
  mandatory?: boolean;
  weight?: number;
  value?: Record<string, unknown>;
}

export interface TargetSpec {
  kind?: "player" | "coach" | "staff" | "trial" | "campus" | "program" | "scouting_call" | "club";
  positions?: string[];
  ageMin?: number | null;
  ageMax?: number | null;
  category?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  languages?: string[];
  requirements?: Partial<Record<CriterionKey, Requirement>>;
}

export type ReasonCode =
  | "position_exact" | "position_secondary" | "position_related" | "position_mismatch"
  | "age_in_range" | "age_close" | "age_out_of_range" | "age_unknown"
  | "category_compatible" | "category_above" | "category_below" | "category_unknown"
  | "experience_ok" | "experience_short"
  | "location_city" | "location_region" | "location_country" | "location_far" | "location_unknown"
  | "mobility_ok" | "mobility_relocate" | "mobility_insufficient"
  | "availability_ok" | "availability_partial" | "availability_none"
  | "languages_ok" | "languages_none"
  | "foot_ok" | "foot_mismatch" | "foot_unknown"
  | "height_ok" | "height_short" | "height_unknown";

export interface CriterionResult {
  criterion: CriterionKey;
  score: number;            // 0..1
  weight: number;
  mandatory: boolean;
  passed: boolean;
  reason: ReasonCode;
  params?: Record<string, string | number>;
}

export interface MatchResult {
  score: number;            // 0..100 entero
  eligible: boolean;
  results: CriterionResult[];
  strengths: CriterionResult[];   // criterios que suman (score ≥ 0.75)
  gaps: CriterionResult[];        // criterios que restan (score < 0.5)
  failedMandatory: CriterionKey[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

type Eval = Omit<CriterionResult, "criterion" | "weight" | "mandatory"> | null;

function evalPosition(c: CandidateFacts, t: TargetSpec): Eval {
  const wanted = t.positions ?? [];
  if (wanted.length === 0) return null;
  if (wanted.includes(c.position)) return { score: 1, passed: true, reason: "position_exact", params: { position: c.position } };
  const secondary = c.secondaryPositions ?? [];
  const sec = secondary.find((p) => wanted.includes(p));
  if (sec) return { score: 0.85, passed: true, reason: "position_secondary", params: { position: sec } };
  let best = 0;
  for (const w of wanted) {
    best = Math.max(best, positionAffinity(c.position, w));
    for (const s of secondary) best = Math.max(best, positionAffinity(s, w) * 0.85);
  }
  if (best >= 0.5) return { score: best * 0.8, passed: true, reason: "position_related" };
  return { score: best * 0.5, passed: false, reason: "position_mismatch" };
}

function evalAge(c: CandidateFacts, t: TargetSpec): Eval {
  if (t.ageMin == null && t.ageMax == null) return null;
  if (c.age == null) return { score: 0, passed: false, reason: "age_unknown" };
  const min = t.ageMin ?? 0;
  const max = t.ageMax ?? 99;
  if (c.age >= min && c.age <= max) return { score: 1, passed: true, reason: "age_in_range", params: { age: c.age } };
  const d = c.age < min ? min - c.age : c.age - max;
  const score = clamp01(1 - 0.35 * d);
  return { score, passed: false, reason: d <= 1 ? "age_close" : "age_out_of_range", params: { age: c.age } };
}

function evalCategory(c: CandidateFacts, t: TargetSpec): Eval {
  const target = categoryTier(t.category);
  if (target == null) return null;
  const cand = categoryTier(c.category);
  if (cand == null) return { score: 0, passed: false, reason: "category_unknown" };
  const diff = cand - target;
  if (diff >= 0) return { score: diff <= 1 ? 1 : 0.85, passed: true, reason: diff <= 1 ? "category_compatible" : "category_above" };
  return { score: clamp01(1 + diff * 0.3), passed: diff >= -1, reason: diff >= -1 ? "category_compatible" : "category_below" };
}

function evalExperience(c: CandidateFacts, t: TargetSpec): Eval {
  const min = Number(t.requirements?.experience?.value?.min_years ?? 0);
  if (!min) return null;
  const years = c.experienceYears ?? 0;
  return years >= min
    ? { score: 1, passed: true, reason: "experience_ok", params: { years } }
    : { score: clamp01(years / min), passed: false, reason: "experience_short", params: { years, min } };
}

function locationLevel(c: CandidateFacts, t: TargetSpec): "city" | "region" | "country" | "far" | null {
  if (!t.country && !t.region && !t.city) return null;
  if (t.city && norm(c.city) === norm(t.city) && (!t.country || c.country === t.country)) return "city";
  if (t.region && norm(c.region) === norm(t.region) && (!t.country || c.country === t.country)) return "region";
  if (t.country && c.country === t.country) return "country";
  if (!c.country) return null;
  return "far";
}

function evalLocation(c: CandidateFacts, t: TargetSpec): Eval {
  const lvl = locationLevel(c, t);
  if (lvl === null) {
    if (!t.country && !t.region && !t.city) return null;
    return { score: 0, passed: false, reason: "location_unknown" };
  }
  switch (lvl) {
    case "city": return { score: 1, passed: true, reason: "location_city", params: { place: t.city ?? "" } };
    case "region": return { score: 0.85, passed: true, reason: "location_region", params: { place: t.region ?? "" } };
    case "country": return { score: 0.6, passed: true, reason: "location_country" };
    default: return { score: 0.15, passed: false, reason: "location_far" };
  }
}

const MOBILITY_REACH: Record<Mobility, number> = { city: 0, region: 1, country: 2, international: 3 };
const NEEDED_REACH = { city: 0, region: 0, country: 2, far: 3 } as const;

function evalMobility(c: CandidateFacts, t: TargetSpec): Eval {
  const lvl = locationLevel(c, t);
  if (lvl === null) return null;
  // Misma región: basta con moverse dentro de la región; misma ciudad: siempre.
  const needed = lvl === "region" && norm(c.city) !== norm(t.city) && t.city ? 1 : NEEDED_REACH[lvl];
  const reach = MOBILITY_REACH[c.mobility ?? "region"];
  if (reach >= needed) return { score: 1, passed: true, reason: "mobility_ok" };
  if (c.willingToRelocate) return { score: 0.8, passed: true, reason: "mobility_relocate" };
  return { score: clamp01(0.25 * reach), passed: false, reason: "mobility_insufficient" };
}

function evalAvailability(c: CandidateFacts, t: TargetSpec): Eval {
  const trialLike = t.kind === "trial" || t.kind === "campus" || t.kind === "program";
  switch (c.availability) {
    case "seeking_club":
    case "open_to_offers":
      return { score: 1, passed: true, reason: "availability_ok" };
    case "seeking_trial":
      return trialLike
        ? { score: 1, passed: true, reason: "availability_ok" }
        : { score: 0.8, passed: true, reason: "availability_partial" };
    case "seeking_agent":
      return { score: 0.6, passed: true, reason: "availability_partial" };
    default:
      return { score: 0, passed: false, reason: "availability_none" };
  }
}

function evalLanguages(c: CandidateFacts, t: TargetSpec): Eval {
  const wanted = t.languages ?? [];
  if (wanted.length === 0) return null;
  const shared = (c.languages ?? []).filter((l) => wanted.includes(l));
  return shared.length
    ? { score: 1, passed: true, reason: "languages_ok", params: { languages: shared.join(", ") } }
    : { score: 0, passed: false, reason: "languages_none" };
}

function evalFoot(c: CandidateFacts, t: TargetSpec): Eval {
  const foot = t.requirements?.foot?.value?.foot as string | undefined;
  if (!foot || foot === "both") return null;
  if (!c.foot) return { score: 0, passed: false, reason: "foot_unknown" };
  return c.foot === foot || c.foot === "both"
    ? { score: 1, passed: true, reason: "foot_ok" }
    : { score: 0, passed: false, reason: "foot_mismatch" };
}

function evalHeight(c: CandidateFacts, t: TargetSpec): Eval {
  const min = Number(t.requirements?.height?.value?.min_cm ?? 0);
  if (!min) return null;
  if (!c.heightCm) return { score: 0, passed: false, reason: "height_unknown" };
  return c.heightCm >= min
    ? { score: 1, passed: true, reason: "height_ok", params: { cm: c.heightCm } }
    : { score: clamp01(1 - (min - c.heightCm) / 10), passed: false, reason: "height_short", params: { cm: c.heightCm, min } };
}

const EVALUATORS: Record<CriterionKey, (c: CandidateFacts, t: TargetSpec) => Eval> = {
  position: evalPosition, age: evalAge, category: evalCategory, experience: evalExperience,
  location: evalLocation, mobility: evalMobility, availability: evalAvailability,
  languages: evalLanguages, foot: evalFoot, height: evalHeight,
};

export function computeMatch(
  candidate: CandidateFacts,
  target: TargetSpec,
  weights: Partial<Record<CriterionKey, number>> = DEFAULT_WEIGHTS,
  enabled: Partial<Record<CriterionKey, boolean>> = {},
): MatchResult {
  const results: CriterionResult[] = [];
  for (const criterion of CRITERIA) {
    if (enabled[criterion] === false) continue;
    const req = target.requirements?.[criterion];
    const ev = EVALUATORS[criterion](candidate, target);
    if (!ev) continue;
    const weight = req?.weight ?? weights[criterion] ?? DEFAULT_WEIGHTS[criterion];
    if (weight <= 0 && !req?.mandatory) continue;
    results.push({ criterion, weight, mandatory: Boolean(req?.mandatory), ...ev });
  }

  const totalWeight = results.reduce((s, r) => s + r.weight, 0);
  let score = totalWeight > 0 ? Math.round((100 * results.reduce((s, r) => s + r.weight * r.score, 0)) / totalWeight) : 0;
  const failedMandatory = results.filter((r) => r.mandatory && !r.passed).map((r) => r.criterion);
  const eligible = failedMandatory.length === 0;
  if (!eligible) score = Math.min(score, MAX_SCORE_WHEN_INELIGIBLE);

  const byImpact = [...results].sort((a, b) => b.weight - a.weight);
  return {
    score,
    eligible,
    results,
    strengths: byImpact.filter((r) => r.score >= 0.75),
    gaps: byImpact.filter((r) => r.score < 0.5),
    failedMandatory,
  };
}

/** Convierte las filas de opportunity_requirements en la forma que usa el motor. */
export function requirementsFromRows(
  rows: Array<{ criterion: string; mandatory: boolean; weight: number; value: unknown }>,
): Partial<Record<CriterionKey, Requirement>> {
  const out: Partial<Record<CriterionKey, Requirement>> = {};
  for (const r of rows) {
    if ((CRITERIA as readonly string[]).includes(r.criterion)) {
      out[r.criterion as CriterionKey] = {
        mandatory: r.mandatory,
        weight: r.weight,
        value: (r.value ?? {}) as Record<string, unknown>,
      };
    }
  }
  return out;
}
