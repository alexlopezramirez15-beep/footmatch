import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/lib/session";
import { signPlayerMedia } from "@/lib/media";
import type { PlayerWizardInitial } from "@/components/onboarding/player-wizard";

/** Datos iniciales del asistente de perfil de jugador (onboarding y edición). */
export async function loadPlayerWizardInitial(supabase: SupabaseClient, s: Session, step: number): Promise<PlayerWizardInitial> {
  const [careers, videos, guardian] = await Promise.all([
    supabase.from("player_careers").select("id, club_name, season, category").eq("player_id", s.userId).order("season", { ascending: false }),
    supabase.from("media_assets").select("id, title, external_url, kind").eq("owner_id", s.userId).neq("kind", "photo").order("created_at", { ascending: false }),
    supabase.from("guardian_relationships").select("status, token, guardian_email").eq("minor_id", s.userId).in("status", ["pending", "approved"]).limit(1).maybeSingle(),
  ]);
  const signed = await signPlayerMedia(supabase, [s.profile.avatar_path]);
  const p = s.player;
  const draft = (s.profile.onboarding_draft ?? {}) as Record<string, unknown>;
  const values: Record<string, unknown> = {
    ...draft,
    full_name: s.profile.full_name,
    birth_date: s.profile.birth_date ?? draft.birth_date ?? "",
    country: s.profile.country ?? draft.country ?? "ES",
    region: s.profile.region ?? draft.region ?? "",
    city: s.profile.city ?? draft.city ?? "",
    ...(p
      ? {
          nationality: p.nationality, position: p.position, secondary_positions: p.secondary_positions, dominant_foot: p.dominant_foot,
          height_cm: p.height_cm ?? "", weight_kg: p.weight_kg ?? "", category: p.category ?? "", current_club: p.current_club ?? "",
          experience_years: p.experience_years, availability: p.availability, mobility: p.mobility, willing_to_relocate: p.willing_to_relocate,
          goals: p.goals ?? "", strengths: p.strengths, languages: p.languages, visibility: p.visibility, allow_agent_contact: p.allow_agent_contact,
        }
      : {}),
  };
  return {
    userId: s.userId,
    step,
    values,
    careers: careers.data ?? [],
    videos: videos.data ?? [],
    avatarPath: s.profile.avatar_path,
    avatarUrl: s.profile.avatar_path ? signed[s.profile.avatar_path] ?? null : null,
    guardian: guardian.data ?? null,
  };
}
