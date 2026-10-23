import { z } from "zod";
import { AVAILABILITY, CATEGORIES, COUNTRIES, FEET, LANGUAGES, MOBILITY, POSITIONS } from "@/domains/football/catalog";

const opt = <T extends z.ZodTypeAny>(s: T) => s.optional().nullable();
const text = (max: number) => z.string().trim().max(max);
const country = z.string().length(2).toUpperCase().refine((c) => (COUNTRIES as readonly string[]).includes(c), "invalid");
const position = z.enum(POSITIONS);
const category = z.enum(CATEGORIES.map((c) => c.key) as [string, ...string[]]);

export const playerSteps = {
  1: z.object({
    full_name: text(120).min(2),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => {
      const t = new Date(d).getTime();
      return t < Date.now() - 6 * 365 * 864e5 && t > new Date("1940-01-01").getTime();
    }, "invalid"),
    country,
    region: opt(text(80)),
    city: opt(text(80)),
    nationality: opt(country),
  }),
  2: z.object({
    position,
    secondary_positions: z.array(position).max(3).default([]),
    dominant_foot: opt(z.enum(FEET)),
    height_cm: opt(z.coerce.number().int().min(100).max(230)),
    weight_kg: opt(z.coerce.number().int().min(25).max(150)),
    category: opt(category),
    current_club: opt(text(120)),
    experience_years: z.coerce.number().int().min(0).max(40).default(0),
  }),
  3: z.object({}),
  4: z.object({}),
  5: z.object({
    availability: z.enum(AVAILABILITY),
    mobility: z.enum(MOBILITY),
    willing_to_relocate: z.boolean().default(false),
  }),
  6: z.object({
    goals: opt(text(1000)),
    strengths: z.array(text(40)).max(5).default([]),
  }),
  7: z.object({
    languages: z.array(z.enum(LANGUAGES)).max(8).default([]),
    visibility: z.enum(["public", "clubs_only", "hidden"]),
    allow_agent_contact: z.boolean().default(false),
  }),
} as const;

export const careerSchema = z.object({
  club_name: text(120).min(2),
  season: z.string().trim().regex(/^[0-9]{4}(\/[0-9]{2,4})?$/),
  category: opt(category),
});

export const videoSchema = z.object({
  external_url: z.string().trim().url().startsWith("https://").max(500),
  title: opt(text(120)),
  kind: z.enum(["video_highlight", "video_match", "video_clip"]),
});

export const guardianSchema = z.object({
  guardian_email: z.string().trim().toLowerCase().email(),
  guardian_name: opt(text(120)),
  relationship: z.enum(["mother", "father", "legal_guardian", "other"]),
});

export const orgSteps = {
  1: z.object({
    name: text(120).min(2),
    type: z.enum(["club", "academy"]),
    description: opt(text(3000)),
    founded_year: opt(z.coerce.number().int().min(1850).max(2100)),
  }),
  2: z.object({
    country,
    region: opt(text(80)),
    city: opt(text(80)),
    facilities: opt(text(1000)),
    website: opt(z.string().trim().url().max(200).or(z.literal(""))),
    contact_email: opt(z.string().trim().email().or(z.literal(""))),
  }),
  3: z.object({}),
  4: z.object({
    competition: opt(category),
    categories: z.array(category).max(10).default([]),
  }),
  5: z.object({
    full_name: text(120).min(2),
    title: opt(text(80)),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  6: z.object({ evidence: opt(text(2000)) }),
} as const;

export const teamSchema = z.object({ name: text(80).min(2), category: opt(category), gender: z.enum(["male", "female", "mixed"]).default("male") });

export const opportunitySchema = z.object({
  type: z.enum(["player", "coach", "staff", "trial", "campus", "program", "scouting_call"]).default("player"),
  title: text(140).min(4),
  description: opt(text(5000)),
  country: opt(country),
  region: opt(text(80)),
  city: opt(text(80)),
  category: opt(category),
  positions: z.array(position).max(6).default([]),
  age_min: opt(z.coerce.number().int().min(4).max(60)),
  age_max: opt(z.coerce.number().int().min(4).max(60)),
  languages: z.array(z.enum(LANGUAGES)).max(6).default([]),
  conditions: opt(text(2000)),
  slots: opt(z.coerce.number().int().min(1).max(500)),
  starts_on: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(""))),
  deadline: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(""))),
  status: z.enum(["draft", "open", "closed", "suspended"]).default("open"),
  requirements: z
    .array(
      z.object({
        criterion: z.enum(["position", "age", "category", "experience", "location", "mobility", "availability", "languages", "foot", "height"]),
        mandatory: z.boolean(),
        weight: z.coerce.number().int().min(0).max(100),
        value: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .max(10)
    .default([]),
}).refine((o) => o.age_min == null || o.age_max == null || o.age_min <= o.age_max, { message: "age", path: ["age_max"] });

export const coachSchema = z.object({
  licenses: z.array(text(30)).max(8).default([]),
  experience_years: z.coerce.number().int().min(0).max(60).default(0),
  categories: z.array(category).max(10).default([]),
  methodology: opt(text(2000)),
  specialties: z.array(text(40)).max(8).default([]),
  languages: z.array(z.enum(LANGUAGES)).max(8).default([]),
  previous_teams: z.array(text(80)).max(15).default([]),
});
export const agentSchema = z.object({
  agency_name: opt(text(120)),
  license_number: opt(text(60)),
  license_authority: opt(text(60)),
  languages: z.array(z.enum(LANGUAGES)).max(8).default([]),
  markets: z.array(country).max(15).default([]),
});
export const scoutSchema = z.object({
  regions: z.array(text(60)).max(10).default([]),
  focus_positions: z.array(position).max(8).default([]),
});
export const proPersonalSchema = z.object({
  full_name: text(120).min(2),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  country,
  city: opt(text(80)),
});

export function isAdult(birth: string) {
  const b = new Date(birth);
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 18);
  return b <= limit;
}
