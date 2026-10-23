"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { isAdult } from "@/domains/onboarding/schemas";
import type { ActionResult } from "@/lib/types";

export async function setLocaleAction(locale: string): Promise<ActionResult> {
  if (!isLocale(locale)) return { ok: false, error: "common.invalidData" };
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) await supabase.from("profiles").update({ locale }).eq("id", data.user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

const CATEGORIES = ["matches", "messages", "applications", "opportunities", "interests", "trials"] as const;

export async function saveNotificationPrefsAction(prefs: Record<string, boolean>, readReceipts: boolean): Promise<ActionResult> {
  const session = await requireSession();
  const clean = Object.fromEntries(CATEGORIES.map((c) => [c, prefs[c] !== false]));
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ notification_prefs: clean, read_receipts: Boolean(readReceipts) }).eq("id", session.userId);
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/settings");
  return { ok: true };
}

const privacySchema = z.object({ visibility: z.enum(["public", "clubs_only", "hidden"]), allow_agent_contact: z.boolean() });

export async function savePrivacyAction(payload: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const p = privacySchema.safeParse(payload);
  if (!p.success || !session.player) return { ok: false, error: "common.invalidData" };
  const supabase = await createClient();
  // Los menores no pueden tener perfil público.
  const visibility = session.isMinor && p.data.visibility === "public" ? "clubs_only" : p.data.visibility;
  const { error } = await supabase.from("player_profiles").update({ visibility, allow_agent_contact: session.isMinor ? false : p.data.allow_agent_contact }).eq("user_id", session.userId);
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/settings");
  return { ok: true };
}

/** Tutor legal: completa sus datos (debe ser mayor de edad) y acepta la invitación. */
export async function acceptGuardianAction(token: string, birthDate: string | null): Promise<ActionResult> {
  const session = await requireSession();
  if (!z.string().uuid().safeParse(token).success) return { ok: false, error: "guardian.invalid" };
  const supabase = await createClient();
  const birth = session.profile.birth_date ?? birthDate;
  if (!birth || !isAdult(birth)) return { ok: false, error: "guardian.mustBeAdult" };
  const patch: Record<string, unknown> = {};
  if (!session.profile.birth_date) patch.birth_date = birth;
  if (!session.profile.onboarding_completed) {
    patch.onboarding_completed = true;
    patch.onboarding_step = 99;
    if (!session.profile.primary_role) patch.primary_role = "guardian";
  }
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", session.userId);
    if (error) return { ok: false, error: "common.error" };
  }
  const { error } = await supabase.rpc("accept_guardian_invite", { p_token: token });
  if (error) {
    if (error.message.includes("otra dirección")) return { ok: false, error: "guardian.wrongEmail" };
    if (error.message.includes("mayor de edad")) return { ok: false, error: "guardian.mustBeAdult" };
    return { ok: false, error: "guardian.invalid" };
  }
  revalidatePath("/", "layout");
  redirect("/guardian?accepted=1");
}

export async function rejectGuardianAction(token: string): Promise<ActionResult> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_guardian_invite", { p_token: token });
  if (error) return { ok: false, error: "guardian.invalid" };
  redirect("/guardian?rejected=1");
}

export async function revokeGuardianAction(minorId: string): Promise<ActionResult> {
  await requireSession();
  if (!z.string().uuid().safeParse(minorId).success) return { ok: false, error: "common.invalidData" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_guardian_authorization", { p_minor: minorId });
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/guardian");
  return { ok: true };
}
