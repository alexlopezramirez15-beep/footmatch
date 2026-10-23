import { AppShell } from "@/components/app/shell";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { publicAssetUrl, signPlayerMedia } from "@/lib/media";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireApp();
  const supabase = await createClient();
  const mode = appMode(session);

  const [{ count: unreadNotifications }, { data: memberships }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", session.userId).is("read_at", null),
    supabase.from("conversation_members").select("last_read_at, archived, conversation:conversations(last_message_at)").eq("user_id", session.userId),
  ]);
  const unreadChats = (memberships ?? []).filter((m) => {
    const c = m.conversation as unknown as { last_message_at: string | null } | null;
    return !m.archived && c?.last_message_at && (!m.last_read_at || m.last_read_at < c.last_message_at);
  }).length;

  let avatarUrl: string | null = null;
  if (mode === "organization") avatarUrl = publicAssetUrl(session.activeOrg?.organization.crest_path);
  else if (session.profile.avatar_path) avatarUrl = (await signPlayerMedia(supabase, [session.profile.avatar_path]))[session.profile.avatar_path] ?? null;

  return (
    <AppShell
      mode={mode}
      userId={session.userId}
      name={mode === "organization" ? session.activeOrg?.organization.name ?? session.profile.full_name : session.profile.full_name}
      avatarUrl={avatarUrl}
      orgName={mode === "organization" ? session.profile.full_name : null}
      isAdmin={session.isAdmin}
      unreadNotifications={unreadNotifications ?? 0}
      unreadChats={unreadChats}
    >
      {children}
    </AppShell>
  );
}
