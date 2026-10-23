import { notFound } from "next/navigation";
import { ChatRoom } from "@/components/chat/chat-room";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { counterparts } from "@/domains/chat/queries";
import type { ConversationRow, MessageRow } from "@/lib/types";

export const metadata = { title: "Conversación" };

export default async function ChatPage(props: PageProps<"/chats/[id]">) {
  const { id } = await props.params;
  const session = await requireApp();
  const supabase = await createClient();
  const { data: conv } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
  if (!conv) notFound();
  const c = conv as ConversationRow;

  const [{ data: msgs }, { data: members }, canSendRes, who, guardian] = await Promise.all([
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("conversation_members").select("user_id, last_read_at, muted, archived").eq("conversation_id", id),
    supabase.rpc("can_send_message", { c: id }),
    counterparts(supabase, session, [c]),
    c.supervised ? supabase.rpc("guardian_approved", { minor: c.player_id }) : Promise.resolve({ data: true }),
  ]);
  const messages = ((msgs ?? []) as MessageRow[]).reverse();
  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const { data: people } = memberIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", memberIds) : { data: [] };
  const names = Object.fromEntries((people ?? []).map((p) => [p.id as string, p.display_name as string]));
  const paths = messages.map((m) => m.attachment_path).filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length ? await supabase.storage.from("chat-files").createSignedUrls(paths, 3600) : { data: [] };
  const attachments = Object.fromEntries((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path!, s.signedUrl as string]));
  const mine = (members ?? []).find((m) => m.user_id === session.userId);
  const othersRead = (members ?? []).filter((m) => m.user_id !== session.userId && m.last_read_at).map((m) => m.last_read_at as string).sort().at(-1) ?? null;
  const w = who(c);
  const isOrgSide = session.memberships.some((m) => m.organization.id === c.organization_id);

  return (
    <ChatRoom
      conversationId={id}
      me={session.userId}
      other={{ title: w.title, imageUrl: w.imageUrl, seed: w.seed, href: w.profileHref, isDemo: w.isDemo }}
      names={names}
      initialMessages={messages}
      attachments={attachments}
      othersReadAt={othersRead}
      canSend={Boolean(canSendRes.data)}
      blocked={Boolean(c.blocked_at)}
      blockedByMe={c.blocked_by === session.userId}
      supervised={c.supervised}
      guardianPending={c.supervised && !guardian.data}
      muted={Boolean(mine?.muted)}
      archived={Boolean(mine?.archived)}
      isOrgSide={isOrgSide}
    />
  );
}
