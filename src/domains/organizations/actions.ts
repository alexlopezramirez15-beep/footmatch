"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE, requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

/** Guarda la ruta del escudo ya subido a public-assets/{orgId}/… (la política de storage valida la carpeta). */
export async function setCrestAction(orgId: string, path: string): Promise<ActionResult> {
  const session = await requireSession();
  const m = session.memberships.find((x) => x.organization.id === orgId);
  if (!m || (m.role !== "owner" && m.role !== "admin")) return { ok: false, error: "discover.notAllowed" };
  if (!path.startsWith(`${orgId}/`)) return { ok: false, error: "common.invalidData" };
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ crest_path: path }).eq("id", orgId);
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function switchOrgAction(orgId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.memberships.some((m) => m.organization.id === orgId)) return { ok: false, error: "discover.notAllowed" };
  (await cookies()).set(ORG_COOKIE, orgId, { path: "/", maxAge: 31536000, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true };
}
