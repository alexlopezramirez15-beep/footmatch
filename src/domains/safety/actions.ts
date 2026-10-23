"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

const reportSchema = z.object({
  target: z.enum(["user", "organization", "opportunity", "message", "conversation"]),
  id: z.string().uuid(),
  reason: z.enum(["spam", "harassment", "inappropriate", "fake_profile", "minor_safety", "scam", "other"]),
  details: z.string().max(2000).optional().nullable(),
});

const targetColumn = {
  user: "target_user_id",
  organization: "target_org_id",
  opportunity: "target_opportunity_id",
  message: "target_message_id",
  conversation: "target_conversation_id",
} as const;

export async function reportAction(payload: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const p = reportSchema.safeParse(payload);
  if (!p.success) return { ok: false, error: "common.invalidData" };
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: session.userId,
    target_type: p.data.target,
    [targetColumn[p.data.target]]: p.data.id,
    reason: p.data.reason,
    details: p.data.details?.trim() || null,
  });
  if (error) return { ok: false, error: "common.error" };
  return { ok: true };
}

export async function blockUserAction(userId: string): Promise<ActionResult> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_user", { p_target: userId });
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function unblockUserAction(userId: string): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("blocks").delete().eq("blocker_id", session.userId).eq("blocked_id", userId);
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/settings");
  return { ok: true };
}
