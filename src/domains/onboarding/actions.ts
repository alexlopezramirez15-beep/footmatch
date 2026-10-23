"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, ORG_COOKIE } from "@/lib/session";
import type { ActionResult, AppRole } from "@/lib/types";
import {
  agentSchema, careerSchema, coachSchema, guardianSchema, isAdult, orgSteps, playerSteps, proPersonalSchema, scoutSchema, teamSchema, videoSchema,
} from "./schemas";

const ROLES: AppRole[] = ["player", "club", "coach", "agent", "scout", "academy"];

function fail(error = "onboarding.errorSave", issues?: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues?.issues ?? []) fieldErrors[String(i.path[0])] ??= i.message;
  return { ok: false, error, fieldErrors };
}

async function ctx() {
  const session = await getSession();
  if (!session) redirect("/login");
  return { session, supabase: await createClient() };
}

/* ------------------------------------------------------------------ */
/* Selección de rol                                                    */
/* ------------------------------------------------------------------ */
export async function chooseRoleAction(role: AppRole): Promise<ActionResult> {
  if (!ROLES.includes(role)) return fail();
  const { session, supabase } = await ctx();
  await supabase.from("user_roles").upsert({ user_id: session.userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
  await supabase.from("profiles").update({ primary_role: role, onboarding_step: 1 }).eq("id", session.userId);

  // Consentimiento de términos/privacidad aceptado en el registro (RGPD: registro probatorio)
  const { data: existing } = await supabase.from("legal_consents").select("id").eq("user_id", session.userId).eq("consent_type", "terms").limit(1);
  if (!existing?.length) {
    await supabase.from("legal_consents").insert([
      { user_id: session.userId, granted_by: session.userId, consent_type: "terms", version: "2026-10", granted: true },
      { user_id: session.userId, granted_by: session.userId, consent_type: "privacy", version: "2026-10", granted: true },
    ]);
  }
  redirect(`/onboarding/${role === "academy" ? "club" : role}`);
}

/* ------------------------------------------------------------------ */
/* Futbolista                                                          */
/* ------------------------------------------------------------------ */
export async function savePlayerStepAction(step: number, payload: unknown): Promise<ActionResult> {
  const schema = playerSteps[step as keyof typeof playerSteps];
  if (!schema) return fail();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return fail("onboarding.errorSave", parsed.error);
  const { session, supabase } = await ctx();
  const uid = session.userId;
  const d = parsed.data as Record<string, unknown>;

  if (step === 1) {
    const { nationality, ...profile } = d;
    const { error } = await supabase.from("profiles").update({ ...profile }).eq("id", uid);
    if (error) return fail(error.message.includes("tutor") ? "onboarding.errorSave" : "onboarding.errorSave");
    // Crea la ficha deportiva vacía para poder ir guardando borradores
    await supabase.from("player_profiles").upsert({ user_id: uid, nationality: nationality ?? profile.country }, { onConflict: "user_id" });
  } else if (step === 2 || step === 5 || step === 6 || step === 7) {
    const { error } = await supabase.from("player_profiles").upsert({ user_id: uid, ...d }, { onConflict: "user_id" });
    if (error) return fail();
  }
  await supabase.from("profiles").update({ onboarding_step: Math.max(step + 1, session.profile.onboarding_step) }).eq("id", uid);
  return { ok: true };
}

export async function addCareerAction(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = careerSchema.safeParse(payload);
  if (!parsed.success) return fail("onboarding.errorSave", parsed.error);
  const { session, supabase } = await ctx();
  const { data, error } = await supabase.from("player_careers").insert({ player_id: session.userId, ...parsed.data }).select("id").single();
  if (error) return fail();
  revalidatePath("/profile");
  return { ok: true, data: { id: data.id } };
}

export async function removeCareerAction(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  await supabase.from("player_careers").delete().eq("id", id);
  revalidatePath("/profile");
  return { ok: true };
}

export async function addVideoAction(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = videoSchema.safeParse(payload);
  if (!parsed.success) return fail("onboarding.errorSave", parsed.error);
  const { session, supabase } = await ctx();
  const { data, error } = await supabase
    .from("media_assets")
    .insert({ owner_id: session.userId, kind: parsed.data.kind, external_url: parsed.data.external_url, title: parsed.data.title })
    .select("id")
    .single();
  if (error) return fail();
  revalidatePath("/profile");
  return { ok: true, data: { id: data.id } };
}

export async function removeMediaAction(id: string): Promise<ActionResult> {
  const { session, supabase } = await ctx();
  const { data } = await supabase.from("media_assets").select("storage_path").eq("id", id).eq("owner_id", session.userId).maybeSingle();
  if (data?.storage_path) await supabase.storage.from("player-media").remove([data.storage_path]);
  await supabase.from("media_assets").delete().eq("id", id).eq("owner_id", session.userId);
  revalidatePath("/profile");
  return { ok: true };
}

/** Tras subir la foto desde el navegador (RLS de storage: carpeta = uid). */
export async function setAvatarAction(path: string): Promise<ActionResult> {
  const { session, supabase } = await ctx();
  if (!path.startsWith(`${session.userId}/`) || path.includes("..")) return fail();
  const prev = session.profile.avatar_path;
  await supabase.from("media_assets").update({ is_primary: false }).eq("owner_id", session.userId).eq("kind", "photo");
  await supabase.from("media_assets").insert({ owner_id: session.userId, kind: "photo", storage_path: path, is_primary: true });
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", session.userId);
  if (error) return fail();
  if (prev && prev !== path) {
    await supabase.storage.from("player-media").remove([prev]);
    await supabase.from("media_assets").delete().eq("owner_id", session.userId).eq("storage_path", prev);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function requestGuardianAction(payload: unknown): Promise<ActionResult<{ token: string }>> {
  const parsed = guardianSchema.safeParse(payload);
  if (!parsed.success) return fail("onboarding.errorSave", parsed.error);
  const { session, supabase } = await ctx();
  if (parsed.data.guardian_email === session.email?.toLowerCase()) return fail("onboarding.errorSave");
  const { data, error } = await supabase
    .from("guardian_relationships")
    .insert({ minor_id: session.userId, ...parsed.data })
    .select("token")
    .single();
  if (error) {
    // Ya solicitada: devolver la existente
    const { data: existing } = await supabase
      .from("guardian_relationships")
      .select("token")
      .eq("minor_id", session.userId)
      .eq("guardian_email", parsed.data.guardian_email)
      .maybeSingle();
    if (existing) return { ok: true, data: { token: existing.token } };
    return fail();
  }
  return { ok: true, data: { token: data.token } };
}

export async function completeOnboardingAction(): Promise<ActionResult> {
  const { session, supabase } = await ctx();
  await supabase.from("profiles").update({ onboarding_completed: true, onboarding_step: 99 }).eq("id", session.userId);
  revalidatePath("/", "layout");
  redirect("/home?welcome=1");
}

export async function saveDraftAction(draft: Record<string, unknown>): Promise<ActionResult> {
  const { session, supabase } = await ctx();
  const json = JSON.stringify(draft ?? {});
  if (json.length > 20000) return fail();
  await supabase.from("profiles").update({ onboarding_draft: JSON.parse(json) }).eq("id", session.userId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Club / academia                                                     */
/* ------------------------------------------------------------------ */
export async function saveOrgStepAction(step: number, payload: unknown): Promise<ActionResult<{ organizationId?: string }>> {
  const schema = orgSteps[step as keyof typeof orgSteps];
  if (!schema) return fail();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return fail("onboarding.errorSave", parsed.error);
  const { session, supabase } = await ctx();
  const d = parsed.data as Record<string, unknown>;
  let orgId = session.activeOrg?.organization.id;

  if (step === 1) {
    const { founded_year, ...org } = d as { founded_year?: number | null; type: "club" | "academy" };
    if (!orgId) {
      const { data, error } = await supabase.from("organizations").insert({ ...org, created_by: session.userId }).select("id").single();
      if (error) return fail();
      orgId = data.id;
      (await cookies()).set(ORG_COOKIE, data.id, { path: "/", maxAge: 31536000, sameSite: "lax" });
      if (org.type === "academy") {
        await supabase.from("user_roles").upsert({ user_id: session.userId, role: "academy" }, { onConflict: "user_id,role", ignoreDuplicates: true });
        await supabase.from("profiles").update({ primary_role: "academy" }).eq("id", session.userId);
      }
    } else {
      const { type: _type, ...rest } = org as Record<string, unknown>;
      void _type;
      await supabase.from("organizations").update(rest).eq("id", orgId);
    }
    if (org.type === "club" && founded_year) await supabase.from("clubs").update({ founded_year }).eq("organization_id", orgId);
  } else if (!orgId) {
    return fail();
  } else if (step === 2 || step === 4) {
    const clean = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === "" ? null : v]));
    const { error } = await supabase.from("organizations").update(clean).eq("id", orgId);
    if (error) return fail();
  } else if (step === 5) {
    const { title, ...personal } = d as { title?: string | null; full_name: string; birth_date: string };
    if (!isAdult(personal.birth_date)) return fail("onboarding.tooYoungForRole");
    await supabase.from("profiles").update(personal).eq("id", session.userId);
    await supabase.from("organization_members").update({ title }).eq("organization_id", orgId).eq("user_id", session.userId);
  } else if (step === 6) {
    const evidence = (d as { evidence?: string | null }).evidence;
    if (evidence) {
      await supabase.from("verification_requests").insert({ subject: "organization", organization_id: orgId, requested_by: session.userId, evidence });
    }
  }
  await supabase.from("profiles").update({ onboarding_step: Math.max(step + 1, session.profile.onboarding_step) }).eq("id", session.userId);
  return { ok: true, data: { organizationId: orgId } };
}

export async function addTeamAction(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = teamSchema.safeParse(payload);
  if (!parsed.success) return fail("onboarding.errorSave", parsed.error);
  const { session, supabase } = await ctx();
  const orgId = session.activeOrg?.organization.id;
  if (!orgId) return fail();
  const { data, error } = await supabase.from("team_profiles").insert({ organization_id: orgId, ...parsed.data }).select("id").single();
  if (error) return fail();
  return { ok: true, data: { id: data.id } };
}

export async function removeTeamAction(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  await supabase.from("team_profiles").delete().eq("id", id);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Entrenador / agente / scout                                         */
/* ------------------------------------------------------------------ */
export async function saveProProfileAction(role: "coach" | "agent" | "scout", personal: unknown, payload: unknown): Promise<ActionResult> {
  const p = proPersonalSchema.safeParse(personal);
  if (!p.success) return fail("onboarding.errorSave", p.error);
  if (!isAdult(p.data.birth_date)) return fail("onboarding.tooYoungForRole");
  const schema = role === "coach" ? coachSchema : role === "agent" ? agentSchema : scoutSchema;
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return fail("onboarding.errorSave", parsed.error);
  const { session, supabase } = await ctx();
  await supabase.from("profiles").update(p.data).eq("id", session.userId);
  const table = role === "coach" ? "coach_profiles" : role === "agent" ? "agent_profiles" : "scout_profiles";
  const { error } = await supabase.from(table).upsert({ user_id: session.userId, ...parsed.data }, { onConflict: "user_id" });
  if (error) return fail();
  if (role === "agent") {
    const { data: pending } = await supabase.from("verification_requests").select("id").eq("user_id", session.userId).eq("subject", "agent").limit(1);
    if (!pending?.length) {
      await supabase.from("verification_requests").insert({ subject: "agent", user_id: session.userId, requested_by: session.userId,
        evidence: `${(parsed.data as { license_authority?: string }).license_authority ?? ""} ${(parsed.data as { license_number?: string }).license_number ?? ""}`.trim() || null });
    }
  }
  await supabase.from("profiles").update({ onboarding_completed: true, onboarding_step: 99 }).eq("id", session.userId);
  revalidatePath("/", "layout");
  redirect("/home?welcome=1");
}
