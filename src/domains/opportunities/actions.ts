"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { opportunitySchema } from "@/domains/onboarding/schemas";

async function orgCtx() {
  const session = await getSession();
  if (!session) redirect("/login");
  const org = session.activeOrg?.organization;
  return { session, org, supabase: await createClient() };
}

export async function createOpportunityAction(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = opportunitySchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "onboarding.errorSave", fieldErrors };
  }
  const { session, org, supabase } = await orgCtx();
  if (!org) return { ok: false, error: "opportunities.noOrg" };
  const { requirements, ...o } = parsed.data;
  const row = {
    ...o,
    starts_on: o.starts_on || null,
    deadline: o.deadline || null,
    country: o.country ?? org.country,
    region: o.region ?? org.region,
    city: o.city ?? org.city,
    organization_id: org.id,
    created_by: session.userId,
  };
  const { data, error } = await supabase.from("opportunities").insert(row).select("id").single();
  if (error) return { ok: false, error: "onboarding.errorSave" };
  if (requirements.length) {
    await supabase.from("opportunity_requirements").insert(requirements.map((r) => ({ ...r, opportunity_id: data.id })));
  }
  revalidatePath("/opportunities");
  revalidatePath("/club");
  return { ok: true, data: { id: data.id } };
}

export async function updateOpportunityAction(id: string, payload: unknown): Promise<ActionResult> {
  const parsed = opportunitySchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "onboarding.errorSave" };
  const { supabase } = await orgCtx();
  const { requirements, ...o } = parsed.data;
  const { error } = await supabase.from("opportunities").update({ ...o, starts_on: o.starts_on || null, deadline: o.deadline || null }).eq("id", id);
  if (error) return { ok: false, error: "onboarding.errorSave" };
  await supabase.from("opportunity_requirements").delete().eq("opportunity_id", id);
  if (requirements.length) await supabase.from("opportunity_requirements").insert(requirements.map((r) => ({ ...r, opportunity_id: id })));
  revalidatePath(`/opportunities/${id}`);
  return { ok: true };
}

export async function setOpportunityStatusAction(id: string, status: "open" | "closed" | "suspended" | "draft"): Promise<ActionResult> {
  const { supabase } = await orgCtx();
  const { error } = await supabase.from("opportunities").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "common.error" };
  revalidatePath(`/opportunities/${id}`);
  revalidatePath("/club");
  return { ok: true };
}

export async function applyAction(opportunityId: string, message: string | null): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.isMinor && !session.guardianApproved) return { ok: false, error: "opportunities.needsGuardian" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .insert({ opportunity_id: opportunityId, applicant_id: session.userId, message: message?.slice(0, 2000) || null })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "opportunities.alreadyApplied" };
    return { ok: false, error: "opportunities.cannotApply" };
  }
  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/applications");
  return { ok: true, data: { id: data.id } };
}

export async function withdrawApplicationAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("applications").update({ status: "withdrawn" }).eq("id", id);
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/applications");
  return { ok: true };
}
