import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeMatch, type MatchResult } from "@/domains/matching/engine";
import { loadWeights, opportunityToSpec, organizationToSpec, playerToFacts } from "@/domains/matching/adapters";
import { publicAssetUrl, signPlayerMedia } from "@/lib/media";
import type { DiscoverOpportunityRow, OrganizationRow, PlayerCardRow, PlayerProfileRow, ProfileRow, RequirementRow } from "@/lib/types";
import type { OpportunityCardVM, PlayerCardVM } from "@/components/cards/cards";

/** Datos del jugador autenticado en el formato de player_cards (para el motor). */
export function selfAsCard(profile: ProfileRow, player: PlayerProfileRow): PlayerCardRow {
  const b = profile.birth_date ? new Date(profile.birth_date) : null;
  let age: number | null = null;
  if (b) {
    const t = new Date();
    age = t.getFullYear() - b.getFullYear() - (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate()) ? 1 : 0);
  }
  return {
    ...player,
    display_name: profile.full_name,
    avatar_path: profile.avatar_path,
    age,
    is_minor: age == null || age < 18,
    country: profile.country,
    region: profile.region,
    city: profile.city,
  };
}

export async function requirementsByOpportunity(supabase: SupabaseClient, ids: string[]) {
  const map = new Map<string, RequirementRow[]>();
  if (!ids.length) return map;
  const { data } = await supabase.from("opportunity_requirements").select("opportunity_id, criterion, mandatory, weight, value").in("opportunity_id", ids);
  for (const r of (data ?? []) as RequirementRow[]) {
    const list = map.get(r.opportunity_id!) ?? [];
    list.push(r);
    map.set(r.opportunity_id!, list);
  }
  return map;
}

export function toOpportunityVM(o: DiscoverOpportunityRow, match: MatchResult | null, applied = false): OpportunityCardVM {
  return {
    id: o.id,
    title: o.title,
    type: o.type,
    orgId: o.organization_id,
    orgName: o.org_name,
    crestUrl: publicAssetUrl(o.org_crest_path),
    verified: o.org_verification === "verified",
    category: o.category,
    positions: o.positions ?? [],
    country: o.country,
    city: o.city,
    ageMin: o.age_min,
    ageMax: o.age_max,
    deadline: o.deadline,
    status: o.status,
    isDemo: o.is_demo,
    match,
    applied,
  };
}

/** Oportunidades abiertas no vistas, ordenadas por compatibilidad real con el jugador. */
export async function rankedOpportunitiesForPlayer(supabase: SupabaseClient, me: PlayerCardRow, limit = 100) {
  const [{ data }, weights] = await Promise.all([
    supabase.rpc("discover_opportunities", { p_limit: limit }),
    loadWeights(supabase),
  ]);
  const rows = (data ?? []) as DiscoverOpportunityRow[];
  const reqs = await requirementsByOpportunity(supabase, rows.map((r) => r.id));
  const facts = playerToFacts(me);
  return rows
    .filter((o) => o.type !== "coach" && o.type !== "staff")
    .map((o) => ({ row: o, match: computeMatch(facts, opportunityToSpec(o, reqs.get(o.id)), weights.weights, weights.enabled) }))
    .sort((a, b) => Number(b.match.eligible) - Number(a.match.eligible) || b.match.score - a.match.score);
}

/** Jugadores aún no evaluados por la organización, ordenados por compatibilidad. */
export async function rankedPlayersForOrg(
  supabase: SupabaseClient,
  org: OrganizationRow,
  opportunity: (DiscoverOpportunityRow | null),
  requirements: RequirementRow[] = [],
  limit = 150,
) {
  const [{ data, error }, weights] = await Promise.all([
    supabase.rpc("discover_players", { p_org: org.id, p_limit: limit }),
    loadWeights(supabase),
  ]);
  if (error) return [];
  const rows = (data ?? []) as PlayerCardRow[];
  const spec = opportunity ? opportunityToSpec(opportunity, requirements) : organizationToSpec(org);
  return rows
    .map((p) => ({ row: p, match: computeMatch(playerToFacts(p), spec, weights.weights, weights.enabled) }))
    .sort((a, b) => Number(b.match.eligible) - Number(a.match.eligible) || b.match.score - a.match.score);
}

export async function toPlayerVMs(supabase: SupabaseClient, items: Array<{ row: PlayerCardRow; match?: MatchResult | null }>): Promise<PlayerCardVM[]> {
  const signed = await signPlayerMedia(supabase, items.map((i) => i.row.avatar_path));
  return items.map(({ row: p, match }) => ({
    id: p.user_id,
    name: p.display_name,
    age: p.age,
    position: p.position,
    secondary: p.secondary_positions,
    nationality: p.nationality,
    country: p.country,
    region: p.region,
    city: p.city,
    currentClub: p.current_club,
    category: p.category,
    availability: p.availability,
    photoUrl: p.avatar_path ? signed[p.avatar_path] ?? null : null,
    isDemo: p.is_demo,
    isMinor: p.is_minor,
    heightCm: p.height_cm,
    foot: p.dominant_foot,
    match: match ?? null,
  }));
}

const OPP_WITH_ORG = "*, organization:organizations(id, name, crest_path, verification_status, type, city, country, is_demo)";

type OppJoin = DiscoverOpportunityRow & { organization: { id: string; name: string; crest_path: string | null; verification_status: string; type: string } | null };

export function flattenOpp(o: OppJoin): DiscoverOpportunityRow {
  return {
    ...o,
    org_name: o.organization?.name ?? "—",
    org_crest_path: o.organization?.crest_path ?? null,
    org_verification: (o.organization?.verification_status ?? "unverified") as DiscoverOpportunityRow["org_verification"],
    org_type: (o.organization?.type ?? "club") as DiscoverOpportunityRow["org_type"],
  };
}

/** Todas las oportunidades abiertas (también las ya vistas), con compatibilidad si hay perfil de jugador. */
export async function listOpenOpportunities(supabase: SupabaseClient, me: PlayerCardRow | null, opts: { type?: string | null; userId?: string } = {}) {
  let q = supabase.from("opportunities").select(OPP_WITH_ORG).eq("status", "open").order("created_at", { ascending: false }).limit(200);
  if (opts.type) q = q.eq("type", opts.type);
  const [{ data }, weights, applied] = await Promise.all([
    q,
    loadWeights(supabase),
    opts.userId ? supabase.from("applications").select("opportunity_id").eq("applicant_id", opts.userId) : Promise.resolve({ data: [] as { opportunity_id: string }[] }),
  ]);
  const rows = ((data ?? []) as OppJoin[]).map(flattenOpp);
  const appliedSet = new Set((applied.data ?? []).map((a) => a.opportunity_id));
  const reqs = me ? await requirementsByOpportunity(supabase, rows.map((r) => r.id)) : new Map<string, RequirementRow[]>();
  const facts = me ? playerToFacts(me) : null;
  const out = rows.map((o) => {
    const match = facts ? computeMatch(facts, opportunityToSpec(o, reqs.get(o.id)), weights.weights, weights.enabled) : null;
    return toOpportunityVM(o, match, appliedSet.has(o.id));
  });
  if (facts) out.sort((a, b) => Number(b.match!.eligible) - Number(a.match!.eligible) || b.match!.score - a.match!.score);
  return out;
}

export async function getOpportunity(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("opportunities").select(OPP_WITH_ORG).eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as OppJoin & { conditions: string | null; slots: number | null; created_by: string | null };
  const reqs = await requirementsByOpportunity(supabase, [id]);
  return { row: flattenOpp(row), raw: row, requirements: reqs.get(id) ?? [] };
}
