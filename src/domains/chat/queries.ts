import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/lib/session";
import { publicAssetUrl, signPlayerMedia } from "@/lib/media";
import type { ConversationRow, MessageRow } from "@/lib/types";

export type ConversationVM = {
  id: string;
  title: string;
  imageUrl: string | null;
  seed: string;
  href: string;
  supervised: boolean;
  blocked: boolean;
  lastMessage: { body: string | null; kind: string; senderIsMe: boolean; at: string } | null;
  unread: number;
  archived: boolean;
  muted: boolean;
  isDemo: boolean;
};

/** Datos del interlocutor: el club para el jugador/tutor, el jugador para el club. */
export async function counterparts(supabase: SupabaseClient, session: Session, convs: ConversationRow[]) {
  const orgIds = [...new Set(convs.map((c) => c.organization_id))];
  const playerIds = [...new Set(convs.map((c) => c.player_id))];
  const [{ data: orgs }, { data: players }] = await Promise.all([
    orgIds.length ? supabase.from("organizations").select("id, name, crest_path, is_demo").in("id", orgIds) : Promise.resolve({ data: [] }),
    playerIds.length ? supabase.from("public_profiles").select("id, display_name, avatar_path, is_demo").in("id", playerIds) : Promise.resolve({ data: [] }),
  ]);
  const signed = await signPlayerMedia(supabase, (players ?? []).map((p) => p.avatar_path));
  const orgMap = new Map((orgs ?? []).map((o) => [o.id as string, o]));
  const playerMap = new Map((players ?? []).map((p) => [p.id as string, p]));
  const memberOf = new Set(session.memberships.map((m) => m.organization.id));
  return (c: ConversationRow) => {
    if (memberOf.has(c.organization_id)) {
      const p = playerMap.get(c.player_id);
      return { title: (p?.display_name as string) ?? "—", imageUrl: p?.avatar_path ? signed[p.avatar_path as string] ?? null : null, seed: c.player_id, profileHref: `/players/${c.player_id}`, isDemo: Boolean(p?.is_demo), otherUserId: c.player_id as string | null };
    }
    const o = orgMap.get(c.organization_id);
    return { title: (o?.name as string) ?? "—", imageUrl: publicAssetUrl(o?.crest_path as string | null), seed: c.organization_id, profileHref: `/clubs/${c.organization_id}`, isDemo: Boolean(o?.is_demo), otherUserId: null };
  };
}

export async function listConversations(supabase: SupabaseClient, session: Session): Promise<ConversationVM[]> {
  const { data } = await supabase.from("conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false }).limit(100);
  const convs = (data ?? []) as ConversationRow[];
  if (!convs.length) return [];
  const ids = convs.map((c) => c.id);
  const [{ data: mine }, { data: msgs }, who] = await Promise.all([
    supabase.from("conversation_members").select("conversation_id, last_read_at, archived, muted").eq("user_id", session.userId).in("conversation_id", ids),
    supabase.from("messages").select("conversation_id, sender_id, body, kind, created_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(1000),
    counterparts(supabase, session, convs),
  ]);
  const memberMap = new Map((mine ?? []).map((m) => [m.conversation_id as string, m]));
  const byConv = new Map<string, Array<Pick<MessageRow, "sender_id" | "body" | "kind" | "created_at">>>();
  for (const m of msgs ?? []) {
    const l = byConv.get(m.conversation_id) ?? [];
    l.push(m);
    byConv.set(m.conversation_id, l);
  }
  return convs.map((c) => {
    const me = memberMap.get(c.id);
    const list = byConv.get(c.id) ?? [];
    const last = list[0];
    const readAt = me?.last_read_at ? new Date(me.last_read_at).getTime() : 0;
    const unread = list.filter((m) => m.sender_id !== session.userId && m.kind !== "system" && new Date(m.created_at).getTime() > readAt).length;
    const w = who(c);
    return {
      id: c.id,
      title: w.title,
      imageUrl: w.imageUrl,
      seed: w.seed,
      href: `/chats/${c.id}`,
      supervised: c.supervised,
      blocked: Boolean(c.blocked_at),
      lastMessage: last ? { body: last.body, kind: last.kind, senderIsMe: last.sender_id === session.userId, at: last.created_at } : null,
      unread,
      archived: Boolean(me?.archived),
      muted: Boolean(me?.muted),
      isDemo: w.isDemo,
    };
  });
}
