"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { APPLICATION_STATUSES } from "@/domains/football/catalog";
import type { ActionResult } from "@/lib/types";

const uuid = z.string().uuid();

async function memberCtx(applicationId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from("applications").select("id, organization_id").eq("id", applicationId).maybeSingle();
  const member = data ? session.memberships.find((m) => m.organization.id === data.organization_id) : null;
  return { session, supabase, app: data, member };
}

export async function setApplicationStatusAction(id: string, status: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success || !(APPLICATION_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "common.invalidData" };
  const { supabase, member } = await memberCtx(id);
  if (!member) return { ok: false, error: "discover.notAllowed" };
  const { error } = await supabase.from("applications").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "pipeline.cannotChange" };
  revalidatePath("/club/pipeline");
  return { ok: true };
}

export async function assignApplicationAction(id: string, userId: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(id).success || (userId && !uuid.safeParse(userId).success)) return { ok: false, error: "common.invalidData" };
  const { supabase, member } = await memberCtx(id);
  if (!member) return { ok: false, error: "discover.notAllowed" };
  const { error } = await supabase.from("applications").update({ assigned_to: userId }).eq("id", id);
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/club/pipeline");
  return { ok: true };
}

export async function addApplicationNoteAction(id: string, body: string): Promise<ActionResult<{ id: string; created_at: string }>> {
  const text = body.trim();
  if (!uuid.safeParse(id).success || text.length < 1 || text.length > 4000) return { ok: false, error: "common.invalidData" };
  const { session, supabase, app, member } = await memberCtx(id);
  if (!member || !app) return { ok: false, error: "discover.notAllowed" };
  const { data, error } = await supabase
    .from("application_notes")
    .insert({ application_id: id, organization_id: app.organization_id, author_id: session.userId, body: text })
    .select("id, created_at")
    .single();
  if (error) return { ok: false, error: "common.error" };
  return { ok: true, data };
}

export type ApplicationDetail = {
  notes: Array<{ id: string; body: string; created_at: string; author: string }>;
  history: Array<{ id: number; from_status: string | null; to_status: string; created_at: string }>;
};

export async function applicationDetailAction(id: string): Promise<ActionResult<ApplicationDetail>> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "common.invalidData" };
  const { supabase, member } = await memberCtx(id);
  if (!member) return { ok: false, error: "discover.notAllowed" };
  const [notes, history] = await Promise.all([
    supabase.from("application_notes").select("id, body, created_at, author_id").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("application_status_history").select("id, from_status, to_status, created_at").eq("application_id", id).order("created_at", { ascending: true }),
  ]);
  const authorIds = [...new Set((notes.data ?? []).map((n) => n.author_id as string))];
  const { data: people } = authorIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", authorIds) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id as string, p.display_name as string]));
  return {
    ok: true,
    data: {
      notes: (notes.data ?? []).map((n) => ({ id: n.id, body: n.body, created_at: n.created_at, author: names.get(n.author_id) ?? "—" })),
      history: history.data ?? [],
    },
  };
}

export async function contactApplicantAction(id: string): Promise<ActionResult<{ conversationId: string }>> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "common.invalidData" };
  const { supabase, member } = await memberCtx(id);
  if (!member) return { ok: false, error: "discover.notAllowed" };
  const { data, error } = await supabase.rpc("start_conversation_from_application", { p_application: id });
  if (error) {
    if (error.message.includes("autorización parental")) return { ok: false, error: "pipeline.needsGuardian" };
    if (error.message.includes("bloqueado")) return { ok: false, error: "pipeline.blocked" };
    return { ok: false, error: "common.error" };
  }
  revalidatePath("/club/pipeline");
  revalidatePath("/chats");
  return { ok: true, data: { conversationId: data as string } };
}
