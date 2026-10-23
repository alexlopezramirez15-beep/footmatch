"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { getLocale } from "@/i18n/server";

export type AuthState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; email?: string } | undefined;

const email = z.string().trim().toLowerCase().email("auth.invalidEmail");
const password = z.string().min(8, "auth.weakPassword").regex(/[A-Za-z]/, "auth.weakPassword").regex(/\d/, "auth.weakPassword");

function fieldErrors(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of e.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : SITE_URL;
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "auth.invalidCredentials";
  if (m.includes("not confirmed")) return "auth.emailNotConfirmed";
  if (m.includes("already registered") || m.includes("already exists")) return "auth.userExists";
  if (m.includes("rate") || m.includes("too many")) return "auth.rateLimited";
  if (m.includes("password")) return "auth.weakPassword";
  return "common.error";
}

function safeNext(n: FormDataEntryValue | null, fallback = "/home") {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

export async function loginAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: "common.setupBody" };
  const parsed = z.object({ email, password: z.string().min(1, "auth.weakPassword") }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: mapAuthError(error.message) };
  redirect(safeNext(form.get("next")));
}

export async function registerAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: "common.setupBody" };
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, "auth.nameRequired").max(120),
      email,
      password,
      terms: z.literal("on", { message: "auth.termsRequired" }),
    })
    .safeParse({ full_name: form.get("full_name"), email: form.get("email"), password: form.get("password"), terms: form.get("terms") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const locale = await getLocale();
  const next = safeNext(form.get("next"), "/onboarding");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name: parsed.data.full_name, locale, terms_version: "2026-10", terms_accepted_at: new Date().toISOString() },
    },
  });
  if (error) return { error: mapAuthError(error.message) };
  // Con confirmación de correo desactivada, Supabase devuelve sesión directamente.
  if (data.session) redirect(next);
  return { ok: true, email: parsed.data.email };
}

export async function forgotPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: "common.setupBody" };
  const parsed = z.object({ email }).safeParse({ email: form.get("email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${await origin()}/auth/callback?next=/reset-password` });
  // Respuesta idéntica exista o no la cuenta (evita enumeración de usuarios).
  return { ok: true };
}

export async function resetPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ password }).safeParse({ password: form.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: mapAuthError(error.message) };
  redirect("/home?password=updated");
}

/** Eliminación de cuenta: anonimiza en BD y, si hay service role, borra el usuario de Auth. */
export async function deleteAccountAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (form.get("confirm") !== "DELETE") return { error: "settings.deleteConfirmError" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "common.error" };
  const admin = createAdminClient();
  if (admin) await admin.auth.admin.deleteUser(data.user.id);
  await supabase.auth.signOut();
  redirect("/?account=deleted");
}
