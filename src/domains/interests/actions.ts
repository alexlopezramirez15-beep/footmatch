"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

type InterestResult = ActionResult<{ interestId: string; matched: boolean; conversationId: string | null }>;
type Kind = "like" | "pass" | "superlike";

async function hasMatch(supabase: Awaited<ReturnType<typeof createClient>>, playerId: string, orgId: string | null) {
  if (!orgId) return false;
  const { data } = await supabase.from("matches").select("id").eq("player_id", playerId).eq("organization_id", orgId).maybeSingle();
  return Boolean(data);
}

async function resultFor(supabase: Awaited<ReturnType<typeof createClient>>, interestId: string, playerId: string, orgId: string | null, hadMatch: boolean): Promise<InterestResult> {
  if (!orgId) return { ok: true, data: { interestId, matched: false, conversationId: null } };
  const [now, { data: conv }] = await Promise.all([
    hasMatch(supabase, playerId, orgId),
    supabase.from("conversations").select("id").eq("player_id", playerId).eq("organization_id", orgId).maybeSingle(),
  ]);
  // Match nuevo: no existía antes del interés y el trigger de la BD lo acaba de crear
  const fresh = now && !hadMatch;
  return { ok: true, data: { interestId, matched: Boolean(fresh), conversationId: conv?.id ?? null } };
}

/** Futbolista → oportunidad (o club). */
export async function playerInterestAction(target: { opportunityId?: string; organizationId?: string }, kind: Kind): Promise<InterestResult> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.player) return { ok: false, error: "discover.needPlayerProfile" };
  if (kind !== "pass" && session.isMinor && !session.guardianApproved) return { ok: false, error: "opportunities.needsGuardian" };
  const supabase = await createClient();
  let orgId = target.organizationId ?? null;
  if (target.opportunityId) {
    const { data: o } = await supabase.from("opportunities").select("organization_id").eq("id", target.opportunityId).maybeSingle();
    orgId = o?.organization_id ?? null;
  }
  const hadMatch = await hasMatch(supabase, session.userId, orgId);
  const row: Record<string, unknown> = target.opportunityId
    ? { actor_id: session.userId, target_type: "opportunity", target_opportunity_id: target.opportunityId, kind }
    : { actor_id: session.userId, target_type: "organization", target_org_id: target.organizationId, kind };
  const { data, error } = await supabase.from("interests").insert(row).select("id").single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "discover.alreadyActed" };
    return { ok: false, error: "common.error" };
  }
  revalidatePath("/home");
  return kind === "pass" ? { ok: true, data: { interestId: data.id, matched: false, conversationId: null } } : resultFor(supabase, data.id, session.userId, orgId, hadMatch);
}

/** Organización (miembro activo) → futbolista. */
export async function orgInterestAction(playerId: string, kind: Kind): Promise<InterestResult> {
  const session = await getSession();
  if (!session) redirect("/login");
  const org = session.activeOrg?.organization;
  if (!org) return { ok: false, error: "opportunities.noOrg" };
  const supabase = await createClient();
  const hadMatch = await hasMatch(supabase, playerId, org.id);
  const { data, error } = await supabase
    .from("interests")
    .insert({ actor_id: session.userId, actor_org_id: org.id, target_type: "player", target_user_id: playerId, kind })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "discover.alreadyActed" };
    return { ok: false, error: "discover.notAllowed" };
  }
  revalidatePath("/home");
  return kind === "pass" ? { ok: true, data: { interestId: data.id, matched: false, conversationId: null } } : resultFor(supabase, data.id, playerId, org.id, hadMatch);
}

/** Deshacer un descarte reciente (las políticas RLS limitan a 10 minutos). */
export async function undoPassAction(interestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("interests").delete({ count: "exact" }).eq("id", interestId).eq("kind", "pass");
  if (error || !count) return { ok: false, error: "discover.cannotUndo" };
  return { ok: true };
}

export async function toggleFavoriteAction(target: { type: "player" | "organization" | "opportunity"; id: string }): Promise<ActionResult<{ favorite: boolean }>> {
  const session = await getSession();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const col = target.type === "player" ? "target_user_id" : target.type === "organization" ? "target_org_id" : "target_opportunity_id";
  const { data: existing } = await supabase.from("favorites").select("id").eq("user_id", session.userId).eq(col, target.id).maybeSingle();
  if (existing) {
    await supabase.from("favorites").delete().eq("id", existing.id);
    revalidatePath("/favorites");
    return { ok: true, data: { favorite: false } };
  }
  const { error } = await supabase.from("favorites").insert({ user_id: session.userId, target_type: target.type, [col]: target.id });
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/favorites");
  return { ok: true, data: { favorite: true } };
}
