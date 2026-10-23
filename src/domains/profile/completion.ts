/** Porcentaje de perfil completado y siguiente acción sugerida (determinista). */
export type CompletionInput = {
  full_name?: string | null;
  birth_date?: string | null;
  country?: string | null;
  city?: string | null;
  avatar_path?: string | null;
  position?: string | null;
  category?: string | null;
  dominant_foot?: string | null;
  height_cm?: number | null;
  current_club?: string | null;
  goals?: string | null;
  languages?: string[] | null;
  careers: number;
  videos: number;
};

const ITEMS: Array<{ key: string; weight: number; done: (i: CompletionInput) => boolean }> = [
  { key: "basics", weight: 15, done: (i) => Boolean(i.full_name && i.birth_date && i.country) },
  { key: "photo", weight: 15, done: (i) => Boolean(i.avatar_path) },
  { key: "position", weight: 15, done: (i) => Boolean(i.position && i.category) },
  { key: "physical", weight: 10, done: (i) => Boolean(i.dominant_foot && i.height_cm) },
  { key: "club", weight: 5, done: (i) => Boolean(i.current_club) },
  { key: "career", weight: 10, done: (i) => i.careers > 0 },
  { key: "video", weight: 15, done: (i) => i.videos > 0 },
  { key: "goals", weight: 10, done: (i) => Boolean(i.goals && i.goals.length > 10) },
  { key: "languages", weight: 5, done: (i) => Boolean(i.languages?.length) },
];

export function profileCompletion(i: CompletionInput) {
  let score = 0;
  let next: string | null = null;
  for (const item of ITEMS) {
    if (item.done(i)) score += item.weight;
    else if (!next || item.weight > (ITEMS.find((x) => x.key === next)?.weight ?? 0)) next = item.key;
  }
  return { score, next };
}
