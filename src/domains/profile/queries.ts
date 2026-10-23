import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signPlayerMedia } from "@/lib/media";
import type { PlayerCardRow } from "@/lib/types";
import type { PlayerProfileData } from "@/components/profile/player-profile";

/** Carga la ficha visible para el usuario actual. RLS y la vista player_cards deciden qué se ve (menores enmascarados). */
export async function loadPlayerProfile(supabase: SupabaseClient, card: PlayerCardRow): Promise<PlayerProfileData> {
  const id = card.user_id;
  const [careers, stats, media] = await Promise.all([
    supabase.from("player_careers").select("id, club_name, season, category, role_note").eq("player_id", id).order("season", { ascending: false }),
    supabase.from("player_statistics").select("id, season, competition, matches, minutes, goals, assists, clean_sheets, source").eq("player_id", id).order("season", { ascending: false }),
    supabase.from("media_assets").select("id, kind, storage_path, external_url, title").eq("owner_id", id).order("created_at", { ascending: false }),
  ]);
  const rows = media.data ?? [];
  const photoRows = rows.filter((m) => m.kind === "photo" && m.storage_path && m.storage_path !== card.avatar_path);
  const signed = await signPlayerMedia(supabase, [card.avatar_path, ...photoRows.map((m) => m.storage_path)]);
  return {
    id,
    name: card.display_name,
    age: card.age,
    isMinor: card.is_minor,
    isDemo: card.is_demo,
    photoUrl: card.avatar_path ? signed[card.avatar_path] ?? null : null,
    position: card.position,
    secondary: card.secondary_positions ?? [],
    nationality: card.nationality,
    country: card.country,
    region: card.region,
    city: card.city,
    currentClub: card.current_club,
    category: card.category,
    heightCm: card.height_cm,
    weightKg: card.weight_kg,
    foot: card.dominant_foot,
    experienceYears: card.experience_years,
    availability: card.availability,
    mobility: card.mobility,
    relocate: card.willing_to_relocate,
    languages: card.languages ?? [],
    goals: card.goals,
    bio: card.bio,
    strengths: card.strengths ?? [],
    careers: careers.data ?? [],
    stats: stats.data ?? [],
    videos: rows.filter((m) => m.kind.startsWith("video") && m.external_url).map((m) => ({ id: m.id, title: m.title, external_url: m.external_url, kind: m.kind })),
    photos: photoRows.map((m) => ({ id: m.id, url: signed[m.storage_path!] })).filter((x) => x.url),
  };
}
