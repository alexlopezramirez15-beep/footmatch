import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AppRole, OrganizationRow, PlayerProfileRow, ProfileRow } from "@/lib/types";

export const ORG_COOKIE = "fm_org";

export type Membership = { role: "owner" | "admin" | "staff" | "scout"; organization: OrganizationRow };

export type Session = {
  userId: string;
  email: string | null;
  profile: ProfileRow;
  roles: AppRole[];
  isAdmin: boolean;
  memberships: Membership[];
  activeOrg: Membership | null;
  player: PlayerProfileRow | null;
  isMinor: boolean;
  guardianApproved: boolean;
};

/** Sesión del usuario actual (una vez por petición). null si no hay sesión. */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profileRes, rolesRes, adminRes, memberRes, playerRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("organization_members").select("role, organization:organizations(*)").eq("user_id", user.id),
    supabase.from("player_profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  const profile = profileRes.data as ProfileRow | null;
  if (!profile || profile.deleted_at) return null;

  const memberships = ((memberRes.data ?? []) as unknown as Membership[]).filter((m) => m.organization);
  const wanted = (await cookies()).get(ORG_COOKIE)?.value;
  const activeOrg = memberships.find((m) => m.organization.id === wanted) ?? memberships[0] ?? null;

  const age = profile.birth_date ? ageOf(profile.birth_date) : null;
  const isMinor = age == null ? false : age < 18;
  let guardianApproved = false;
  if (isMinor) {
    const { data } = await supabase.from("guardian_relationships").select("id").eq("minor_id", user.id).eq("status", "approved").limit(1);
    guardianApproved = Boolean(data?.length);
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    roles: (rolesRes.data ?? []).map((r) => r.role as AppRole),
    isAdmin: Boolean(adminRes.data),
    memberships,
    activeOrg,
    player: (playerRes.data as PlayerProfileRow | null) ?? null,
    isMinor,
    guardianApproved,
  };
});

function ageOf(birth: string) {
  const b = new Date(birth);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Exige sesión y onboarding completado. */
export async function requireApp(): Promise<Session> {
  const s = await requireSession();
  if (!s.profile.onboarding_completed) redirect("/onboarding");
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (!s.isAdmin) redirect("/home");
  return s;
}

/** Modo de la app según rol principal: los clubes/academias exploran jugadores. */
export function appMode(s: Session): "player" | "organization" | "professional" {
  if (s.activeOrg && (s.profile.primary_role === "club" || s.profile.primary_role === "academy" || !s.player)) return "organization";
  if (s.player) return "player";
  return "professional";
}
