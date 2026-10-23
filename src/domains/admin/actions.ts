"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

const uuid = z.string().uuid();
const verif = z.enum(["unverified", "pending", "verified", "rejected"]);

async function run(fn: string, args: Record<string, unknown>): Promise<ActionResult<unknown>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/admin");
  return { ok: true, data };
}

export async function adminOrgVerificationAction(orgId: string, status: string, note: string | null) {
  if (!uuid.safeParse(orgId).success || !verif.safeParse(status).success) return { ok: false, error: "common.invalidData" } as ActionResult;
  return run("admin_set_org_verification", { p_org: orgId, p_status: status, p_note: note?.slice(0, 500) || null });
}

export async function adminAgentVerificationAction(userId: string, status: string, note: string | null) {
  if (!uuid.safeParse(userId).success || !verif.safeParse(status).success) return { ok: false, error: "common.invalidData" } as ActionResult;
  return run("admin_set_agent_verification", { p_agent: userId, p_status: status, p_note: note?.slice(0, 500) || null });
}

export async function adminUserSuspensionAction(userId: string, suspended: boolean) {
  if (!uuid.safeParse(userId).success) return { ok: false, error: "common.invalidData" } as ActionResult;
  return run("admin_set_user_suspension", { p_user: userId, p_suspended: suspended });
}

export async function adminOrgSuspensionAction(orgId: string, suspended: boolean) {
  if (!uuid.safeParse(orgId).success) return { ok: false, error: "common.invalidData" } as ActionResult;
  return run("admin_set_org_suspension", { p_org: orgId, p_suspended: suspended });
}

export async function adminResolveReportAction(id: string, status: string, note: string | null) {
  if (!uuid.safeParse(id).success || !z.enum(["open", "reviewing", "resolved", "dismissed"]).safeParse(status).success) return { ok: false, error: "common.invalidData" } as ActionResult;
  return run("admin_resolve_report", { p_report: id, p_status: status, p_note: note?.slice(0, 1000) || null });
}

export async function adminPurgeDemoAction(confirm: string) {
  if (confirm !== "PURGE") return { ok: false, error: "admin.purgeConfirmError" } as ActionResult;
  return run("purge_demo_data", {});
}

export async function adminSaveWeightsAction(rows: Array<{ criterion: string; weight: number; enabled: boolean }>): Promise<ActionResult> {
  await requireAdmin();
  const p = z.array(z.object({ criterion: z.string(), weight: z.number().int().min(0).max(100), enabled: z.boolean() })).max(20).safeParse(rows);
  if (!p.success) return { ok: false, error: "common.invalidData" };
  const supabase = await createClient();
  for (const r of p.data) {
    const { error } = await supabase.from("matching_criteria").update({ weight: r.weight, enabled: r.enabled, updated_at: new Date().toISOString() }).eq("criterion", r.criterion);
    if (error) return { ok: false, error: "common.error" };
  }
  revalidatePath("/admin");
  return { ok: true };
}
