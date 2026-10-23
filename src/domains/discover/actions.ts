"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { discoverFiltersSchema } from "./filters";

export async function saveDiscoverFiltersAction(payload: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = discoverFiltersSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "common.invalidData" };
  const f = parsed.data;
  if (f.ageMin != null && f.ageMax != null && f.ageMin > f.ageMax) return { ok: false, error: "discover.ageRangeInvalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("discover_preferences")
    .upsert({ user_id: session.userId, filters: f, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/discover");
  return { ok: true };
}
