"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireSession } from "@/lib/session";
import { TRIAL_APPLICATION_STATUSES } from "@/domains/football/catalog";
import type { ActionResult } from "@/lib/types";

const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

const trialSchema = z
  .object({
    title: z.string().trim().min(4).max(140),
    description: optText(4000),
    location: optText(200),
    city: optText(120),
    country: z.string().length(2).optional().nullable(),
    starts_at: z.string().min(10),
    ends_at: z.string().optional().nullable().transform((v) => v || null),
    category: z.string().optional().nullable().transform((v) => v || null),
    positions: z.array(z.string()).max(15).default([]),
    age_min: z.coerce.number().int().min(6).max(50).optional().nullable(),
    age_max: z.coerce.number().int().min(6).max(50).optional().nullable(),
    slots: z.coerce.number().int().min(1).max(500).optional().nullable(),
    requirements: optText(2000),
    documentation: optText(2000),
    cost_info: optText(500),
    instructions: optText(2000),
    opportunity_id: z.string().uuid().optional().nullable(),
  })
  .refine((v) => !v.age_min || !v.age_max || v.age_min <= v.age_max, { path: ["age_max"], message: "range" })
  .refine((v) => !Number.isNaN(Date.parse(v.starts_at)) && Date.parse(v.starts_at) > Date.now(), { path: ["starts_at"], message: "future" })
  .refine((v) => !v.ends_at || Date.parse(v.ends_at) > Date.parse(v.starts_at), { path: ["ends_at"], message: "after" });

async function orgMember() {
  const session = await requireSession();
  const m = session.activeOrg;
  return { session, m, supabase: await createClient() };
}

/** Publica una prueba. Con applicationId, además la propone en el chat con el candidato. */
export async function createTrialAction(payload: unknown, applicationId?: string | null): Promise<ActionResult<{ id: string; conversationId?: string }>> {
  const parsed = trialSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= ["range", "future", "after"].includes(i.message) ? i.message : "invalid";
    return { ok: false, error: "trials.invalid", fieldErrors };
  }
  const { session, m, supabase } = await orgMember();
  if (!m || m.role === "scout") return { ok: false, error: "discover.notAllowed" };
  const d = parsed.data;
  const { data, error } = await supabase
    .from("trials")
    .insert({ ...d, starts_at: new Date(d.starts_at).toISOString(), ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null, organization_id: m.organization.id, created_by: session.userId, status: "open" })
    .select("id, title, starts_at, location")
    .single();
  if (error) return { ok: false, error: "common.error" };
  let conversationId: string | undefined;
  if (applicationId) {
    const res = await proposeTrialForApplication(data.id, applicationId);
    if (!res.ok) return { ok: true, data: { id: data.id }, message: res.error };
    conversationId = res.data!.conversationId;
  }
  revalidatePath("/trials");
  return { ok: true, data: { id: data.id, conversationId } };
}

async function proposeTrialForApplication(trialId: string, applicationId: string): Promise<ActionResult<{ conversationId: string }>> {
  const supabase = await createClient();
  const session = await getSession();
  const { data: conv, error } = await supabase.rpc("start_conversation_from_application", { p_application: applicationId });
  if (error || !conv) return { ok: false, error: "pipeline.needsGuardian" };
  const res = await insertProposal(trialId, conv as string, session!.userId);
  if (!res.ok) return res as ActionResult<{ conversationId: string }>;
  await supabase.from("applications").update({ status: "trial_scheduled" }).eq("id", applicationId);
  revalidatePath("/club/pipeline");
  return { ok: true, data: { conversationId: conv as string } };
}

async function insertProposal(trialId: string, conversationId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: trial } = await supabase.from("trials").select("id, title, starts_at, location, city").eq("id", trialId).maybeSingle();
  if (!trial) return { ok: false, error: "common.error" };
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    kind: "trial_proposal",
    metadata: { trial_id: trial.id, title: trial.title, starts_at: trial.starts_at, location: [trial.location, trial.city].filter(Boolean).join(", ") },
  });
  if (error) return { ok: false, error: "chat.cannotSend" };
  return { ok: true };
}

export async function proposeTrialInChatAction(trialId: string, conversationId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!z.string().uuid().safeParse(trialId).success || !z.string().uuid().safeParse(conversationId).success) return { ok: false, error: "common.invalidData" };
  const res = await insertProposal(trialId, conversationId, session.userId);
  if (res.ok) revalidatePath(`/chats/${conversationId}`);
  return res;
}

export async function setTrialStatusAction(id: string, status: "open" | "full" | "closed" | "completed" | "cancelled"): Promise<ActionResult> {
  const { supabase, m } = await orgMember();
  if (!m || m.role === "scout") return { ok: false, error: "discover.notAllowed" };
  const { error } = await supabase.from("trials").update({ status }).eq("id", id).eq("organization_id", m.organization.id);
  if (error) return { ok: false, error: "common.error" };
  revalidatePath(`/trials/${id}`);
  return { ok: true };
}

export async function enrollTrialAction(trialId: string, message: string | null): Promise<ActionResult> {
  const session = await requireSession();
  if (session.isMinor && !session.guardianApproved) return { ok: false, error: "opportunities.needsGuardian" };
  const supabase = await createClient();
  const { error } = await supabase.from("trial_applications").insert({ trial_id: trialId, player_id: session.userId, message: message?.trim().slice(0, 1000) || null });
  if (error) return { ok: false, error: error.code === "23505" ? "trials.alreadyEnrolled" : "trials.cannotEnroll" };
  revalidatePath(`/trials/${trialId}`);
  revalidatePath("/trials");
  return { ok: true };
}

export async function withdrawTrialAction(applicationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("trial_applications").update({ status: "withdrawn" }).eq("id", applicationId).select("trial_id").single();
  if (error) return { ok: false, error: "common.error" };
  revalidatePath(`/trials/${data.trial_id}`);
  return { ok: true };
}

export async function setTrialApplicationStatusAction(id: string, status: string): Promise<ActionResult> {
  if (!(TRIAL_APPLICATION_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "common.invalidData" };
  const { supabase, m } = await orgMember();
  if (!m || m.role === "scout") return { ok: false, error: "discover.notAllowed" };
  const { data, error } = await supabase.from("trial_applications").update({ status }).eq("id", id).eq("organization_id", m.organization.id).select("trial_id").single();
  if (error) return { ok: false, error: "common.error" };
  revalidatePath(`/trials/${data.trial_id}`);
  return { ok: true };
}

const evalSchema = z.object({
  trialApplicationId: z.string().uuid(),
  ratings: z.record(z.string(), z.number().int().min(1).max(5)),
  summary: optText(4000),
  next_steps: optText(1000),
  shared: z.boolean(),
});

export async function saveEvaluationAction(payload: unknown): Promise<ActionResult> {
  const p = evalSchema.safeParse(payload);
  if (!p.success) return { ok: false, error: "common.invalidData" };
  const { session, supabase, m } = await orgMember();
  if (!m) return { ok: false, error: "discover.notAllowed" };
  const { data: ta } = await supabase.from("trial_applications").select("id, player_id, trial_id, organization_id").eq("id", p.data.trialApplicationId).maybeSingle();
  if (!ta || ta.organization_id !== m.organization.id) return { ok: false, error: "discover.notAllowed" };
  const { error } = await supabase.from("evaluations").insert({
    organization_id: ta.organization_id,
    player_id: ta.player_id,
    author_id: session.userId,
    trial_application_id: ta.id,
    ratings: p.data.ratings,
    summary: p.data.summary,
    next_steps: p.data.next_steps,
    shared_with_player: p.data.shared,
  });
  if (error) return { ok: false, error: "common.error" };
  await supabase.from("trial_applications").update({ status: "evaluated" }).eq("id", ta.id);
  revalidatePath(`/trials/${ta.trial_id}`);
  return { ok: true };
}
