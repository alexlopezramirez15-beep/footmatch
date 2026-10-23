"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
  if (ids?.length) q = q.in("id", ids.slice(0, 200));
  const { error } = await q;
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/", "layout");
  return { ok: true };
}
