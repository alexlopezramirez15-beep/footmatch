// Catálogo deportivo central. Las claves se guardan en base de datos;
// las etiquetas se traducen con el sistema i18n (namespace "football").

export const POSITIONS = [
  "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST",
] as const;
export type Position = (typeof POSITIONS)[number];

/** Líneas del campo: sirven para la afinidad entre posiciones. */
export const POSITION_LINE: Record<Position, "gk" | "def" | "mid" | "att"> = {
  GK: "gk",
  RB: "def", CB: "def", LB: "def", RWB: "def", LWB: "def",
  CDM: "mid", CM: "mid", CAM: "mid", RM: "mid", LM: "mid",
  RW: "att", LW: "att", CF: "att", ST: "att",
};

/** Afinidad deportiva entre posiciones (0-1). Simétrica. */
const AFFINITY: Array<[Position, Position, number]> = [
  ["RB", "RWB", 0.9], ["LB", "LWB", 0.9], ["RB", "CB", 0.5], ["LB", "CB", 0.5], ["RB", "LB", 0.5],
  ["RWB", "RM", 0.7], ["LWB", "LM", 0.7], ["CDM", "CB", 0.6], ["CDM", "CM", 0.85], ["CM", "CAM", 0.8],
  ["CAM", "CF", 0.6], ["RM", "RW", 0.85], ["LM", "LW", 0.85], ["RW", "LW", 0.7], ["RM", "LM", 0.6],
  ["RW", "ST", 0.5], ["LW", "ST", 0.5], ["CF", "ST", 0.9], ["CAM", "RW", 0.5], ["CAM", "LW", 0.5],
  ["CM", "RM", 0.5], ["CM", "LM", 0.5],
];

export function positionAffinity(a: string, b: string): number {
  if (a === b) return 1;
  for (const [x, y, v] of AFFINITY) {
    if ((x === a && y === b) || (x === b && y === a)) return v;
  }
  return 0;
}

/**
 * Competiciones/categorías con un nivel deportivo (tier 1-10) y franja de edad.
 * Centrado en España en la fase 1, con equivalentes genéricos internacionales.
 */
export const CATEGORIES = [
  { key: "senior_pro", tier: 10, group: "senior" },
  { key: "senior_1rfef", tier: 9, group: "senior" },
  { key: "senior_2rfef", tier: 8, group: "senior" },
  { key: "senior_3rfef", tier: 7, group: "senior" },
  { key: "senior_regional_pref", tier: 6, group: "senior" },
  { key: "senior_regional", tier: 4, group: "senior" },
  { key: "senior_amateur", tier: 3, group: "senior" },
  { key: "u19_dh", tier: 8, group: "u19" },
  { key: "u19_nacional", tier: 7, group: "u19" },
  { key: "u19_preferente", tier: 5, group: "u19" },
  { key: "u19_regional", tier: 4, group: "u19" },
  { key: "u16_elite", tier: 7, group: "u16" },
  { key: "u16_preferente", tier: 5, group: "u16" },
  { key: "u16_regional", tier: 3, group: "u16" },
  { key: "u14_elite", tier: 6, group: "u14" },
  { key: "u14_regional", tier: 3, group: "u14" },
  { key: "u12", tier: 2, group: "u12" },
  { key: "academy_program", tier: 4, group: "any" },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export function categoryTier(key: string | null | undefined): number | null {
  if (!key) return null;
  return CATEGORIES.find((c) => c.key === key)?.tier ?? null;
}

export const AVAILABILITY = ["seeking_club", "open_to_offers", "seeking_trial", "seeking_agent", "unavailable"] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const MOBILITY = ["city", "region", "country", "international"] as const;
export type Mobility = (typeof MOBILITY)[number];

export const FEET = ["right", "left", "both"] as const;
export type Foot = (typeof FEET)[number];

export const LANGUAGES = ["es", "ca", "en", "pl", "fr", "pt", "de", "it", "ar", "ro", "uk"] as const;

/** Países disponibles en la fase 1 (nombres vía Intl.DisplayNames). */
export const COUNTRIES = ["ES", "PL", "FR", "PT", "IT", "DE", "GB", "NL", "BE", "AD", "MA", "AR", "BR", "US", "MX", "CO", "UA", "RO"] as const;

export const OPPORTUNITY_TYPES = ["player", "coach", "staff", "trial", "campus", "program", "scouting_call"] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const APPLICATION_STATUSES = [
  "received", "reviewed", "shortlisted", "contacted", "trial_scheduled", "evaluating", "selected", "rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number] | "withdrawn";

export const TRIAL_APPLICATION_STATUSES = [
  "sent", "pending", "accepted", "waitlist", "rejected", "attended", "evaluated",
] as const;

export const UEFA_LICENSES = ["UEFA_C", "UEFA_B", "UEFA_A", "UEFA_ELITE_YOUTH", "UEFA_PRO", "UEFA_GK_B", "UEFA_GK_A", "UEFA_FUTSAL_B"] as const;

export function countryName(code: string | null | undefined, locale: string): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Bandera emoji a partir del código ISO. */
export function flag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export function ageFrom(birthDate: string | null | undefined, today = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}
