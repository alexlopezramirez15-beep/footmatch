"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import type { ActionResult, MessageRow } from "@/lib/types";

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().max(4000).optional().nullable(),
  attachmentPath: z.string().max(400).optional().nullable(),
  attachmentName: z.string().max(200).optional().nullable(),
});

export async function sendMessageAction(payload: unknown): Promise<ActionResult<MessageRow>> {
  const session = await requireSession();
  const p = sendSchema.safeParse(payload);
  if (!p.success) return { ok: false, error: "common.invalidData" };
  const { conversationId, body, attachmentPath, attachmentName } = p.data;
  if (!body && !attachmentPath) return { ok: false, error: "common.invalidData" };
  if (attachmentPath && !attachmentPath.startsWith(`${conversationId}/`)) return { ok: false, error: "common.invalidData" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: session.userId,
      kind: attachmentPath ? "file" : "text",
      body: body || null,
      attachment_path: attachmentPath || null,
      metadata: attachmentName ? { name: attachmentName } : {},
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: "chat.cannotSend" };
  return { ok: true, data: data as MessageRow };
}

export async function markReadAction(conversationId: string): Promise<ActionResult> {
  await requireSession();
  if (!z.string().uuid().safeParse(conversationId).success) return { ok: false, error: "common.invalidData" };
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
  return { ok: true };
}

export async function setConversationBlockedAction(conversationId: string, blocked: boolean): Promise<ActionResult> {
  await requireSession();
  if (!z.string().uuid().safeParse(conversationId).success) return { ok: false, error: "common.invalidData" };
  const supabase = await createClient();
  const { error } = await supabase.rpc(blocked ? "block_conversation" : "unblock_conversation", { p_conversation: conversationId });
  if (error) return { ok: false, error: "common.error" };
  revalidatePath(`/chats/${conversationId}`);
  revalidatePath("/chats");
  return { ok: true };
}

export async function setConversationPrefsAction(conversationId: string, prefs: { archived?: boolean; muted?: boolean }): Promise<ActionResult> {
  const session = await requireSession();
  if (!z.string().uuid().safeParse(conversationId).success) return { ok: false, error: "common.invalidData" };
  const clean: Record<string, boolean> = {};
  if (typeof prefs.archived === "boolean") clean.archived = prefs.archived;
  if (typeof prefs.muted === "boolean") clean.muted = prefs.muted;
  const supabase = await createClient();
  const { error } = await supabase.from("conversation_members").update(clean).eq("conversation_id", conversationId).eq("user_id", session.userId);
  if (error) return { ok: false, error: "common.error" };
  revalidatePath("/chats");
  return { ok: true };
}

export async function signAttachmentAction(path: string): Promise<ActionResult<{ url: string }>> {
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("chat-files").createSignedUrl(path, 3600);
  if (error || !data) return { ok: false, error: "common.error" };
  return { ok: true, data: { url: data.signedUrl } };
}
