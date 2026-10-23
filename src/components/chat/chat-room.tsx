"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Archive, BellOff, CalendarDays, Check, CheckCheck, FileText, Lock, Paperclip, SendHorizontal, ShieldCheck, Sparkles, Unlock } from "lucide-react";
import { DemoBadge, GlassAvatar, GlassButton, GlassCard } from "@/components/glass/primitives";
import { GlassBottomSheet, GlassModal, useToast } from "@/components/glass/overlays";
import { ReportSheet } from "@/components/profile/safety";
import { useI18n } from "@/i18n/client";
import { getBrowserClient } from "@/lib/supabase/client";
import { haptic } from "@/lib/haptics";
import { optimizeImage } from "@/lib/image";
import { cn } from "@/lib/cn";
import type { MessageRow } from "@/lib/types";
import { markReadAction, sendMessageAction, setConversationBlockedAction, setConversationPrefsAction, signAttachmentAction } from "@/domains/chat/actions";

export type ChatRoomProps = {
  conversationId: string;
  me: string;
  other: { title: string; imageUrl: string | null; seed: string; href: string; isDemo: boolean };
  names: Record<string, string>;
  initialMessages: MessageRow[];
  attachments: Record<string, string>;
  othersReadAt: string | null;
  canSend: boolean;
  blocked: boolean;
  blockedByMe: boolean;
  supervised: boolean;
  guardianPending: boolean;
  muted: boolean;
  archived: boolean;
  isOrgSide: boolean;
};

export function ChatRoom(props: ChatRoomProps) {
  const { t, f } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [messages, setMessages] = React.useState(props.initialMessages);
  const [attachments, setAttachments] = React.useState(props.attachments);
  const [readAt, setReadAt] = React.useState(props.othersReadAt);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [typing, setTyping] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const [report, setReport] = React.useState(false);
  const [confirmBlock, setConfirmBlock] = React.useState(false);
  const scroller = React.useRef<HTMLDivElement>(null);
  const file = React.useRef<HTMLInputElement>(null);
  const channelRef = React.useRef<ReturnType<ReturnType<typeof getBrowserClient>["channel"]> | null>(null);
  const lastTypingSent = React.useRef(0);

  const scrollToEnd = React.useCallback((smooth = true) => {
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: smooth ? "smooth" : "auto" }));
  }, []);

  React.useEffect(() => {
    scrollToEnd(false);
    markReadAction(props.conversationId);
  }, [props.conversationId, scrollToEnd]);

  // Tiempo real: mensajes nuevos, lectura y "escribiendo…"
  React.useEffect(() => {
    const supabase = getBrowserClient();
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase
      .channel(`conversation:${props.conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${props.conversationId}` }, async (payload) => {
        const m = payload.new as MessageRow;
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        if (m.attachment_path) {
          const r = await signAttachmentAction(m.attachment_path);
          if (r.ok) setAttachments((a) => ({ ...a, [m.attachment_path!]: r.data!.url }));
        }
        if (m.sender_id !== props.me) {
          setTyping(false);
          haptic("light");
          markReadAction(props.conversationId);
        }
        scrollToEnd();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${props.conversationId}` }, (payload) => {
        const row = payload.new as { user_id: string; last_read_at: string | null };
        if (row.user_id !== props.me && row.last_read_at) setReadAt((prev) => (!prev || row.last_read_at! > prev ? row.last_read_at : prev));
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        if ((payload.payload as { user?: string })?.user === props.me) return;
        setTyping(true);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => setTyping(false), 3500);
      })
      .subscribe();
    channelRef.current = ch;
    return () => {
      clearTimeout(typingTimer);
      supabase.removeChannel(ch);
    };
  }, [props.conversationId, props.me, scrollToEnd]);

  const emitTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { user: props.me } });
  };

  const send = async (payload: { body?: string; attachmentPath?: string; attachmentName?: string }) => {
    setSending(true);
    const res = await sendMessageAction({ conversationId: props.conversationId, ...payload });
    setSending(false);
    if (!res.ok) {
      push({ tone: "error", title: t(res.error) });
      return false;
    }
    setMessages((list) => (list.some((x) => x.id === res.data!.id) ? list : [...list, res.data!]));
    haptic("light");
    scrollToEnd();
    return true;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setText("");
    const ok = await send({ body });
    if (!ok) setText(body);
  };

  const onFile = async (f0: File | undefined) => {
    if (!f0) return;
    const isImage = f0.type.startsWith("image/");
    if (!(isImage || f0.type === "application/pdf") || f0.size > 10 * 1024 * 1024) return push({ tone: "error", title: t("chat.fileInvalid") });
    setSending(true);
    try {
      const blob = isImage ? await optimizeImage(f0, 1600) : f0;
      const ext = isImage ? "webp" : "pdf";
      const path = `${props.conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await getBrowserClient().storage.from("chat-files").upload(path, blob, { contentType: isImage ? "image/webp" : "application/pdf" });
      if (error) throw error;
      const r = await signAttachmentAction(path);
      if (r.ok) setAttachments((a) => ({ ...a, [path]: r.data!.url }));
      await send({ attachmentPath: path, attachmentName: f0.name.slice(0, 200) });
    } catch {
      push({ tone: "error", title: t("chat.uploadError") });
    } finally {
      setSending(false);
      if (file.current) file.current.value = "";
    }
  };

  const toggleBlock = async (blocked: boolean) => {
    const res = await setConversationBlockedAction(props.conversationId, blocked);
    if (!res.ok) return push({ tone: "error", title: t(res.error) });
    setConfirmBlock(false);
    setMenu(false);
    router.refresh();
  };
  const pref = async (p: { muted?: boolean; archived?: boolean }) => {
    const res = await setConversationPrefsAction(props.conversationId, p);
    if (!res.ok) return push({ tone: "error", title: t(res.error) });
    setMenu(false);
    push({ tone: "success", title: t("common.saved") });
    if (p.archived) router.push("/chats");
    else router.refresh();
  };

  const myLast = [...messages].reverse().find((m) => m.sender_id === props.me && m.kind !== "system");
  const seen = Boolean(myLast && readAt && readAt >= myLast.created_at);

  // Agrupar por día
  const groups: Array<{ day: string; items: MessageRow[] }> = [];
  for (const m of messages) {
    const day = m.created_at.slice(0, 10);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.items.push(m);
    else groups.push({ day, items: [m] });
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="fm-safe-top sticky top-0 z-20 -mx-4 px-3 pt-2 pb-2 sm:-mx-6 lg:-mx-8">
        <div className="glass glass-elevated flex items-center gap-2 rounded-full p-1.5 pr-2">
          <Link href="/chats" aria-label={t("common.back")} className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:text-ink">
            <ArrowLeft className="size-5" />
          </Link>
          <Link href={props.other.href} className="flex min-w-0 flex-1 items-center gap-2.5">
            <GlassAvatar src={props.other.imageUrl} name={props.other.title} seed={props.other.seed} size={38} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">{props.other.title}{props.other.isDemo ? <DemoBadge /> : null}</p>
              <p className="truncate text-[12px] text-ink-2">{typing ? t("chat.typing") : props.supervised ? t("chat.supervised") : t("chat.viewProfile")}</p>
            </div>
          </Link>
          <GlassButton variant="ghost" size="sm" onClick={() => setMenu(true)}>{t("chat.options")}</GlassButton>
        </div>
      </header>

      <div ref={scroller} className="no-scrollbar flex-1 overflow-y-auto px-1 py-3" aria-live="polite">
        {props.supervised ? (
          <GlassCard material="tint-amber" className="mx-auto mb-4 flex max-w-md items-start gap-2.5 p-3 text-[13px]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-warn" />
            <p>{props.guardianPending ? t("chat.supervisedPending") : t("chat.supervisedBody")}</p>
          </GlassCard>
        ) : null}
        {groups.map((g) => (
          <div key={g.day} className="flex flex-col gap-1.5">
            <p className="my-3 text-center text-[11px] font-medium text-ink-3">{f.date(g.day, { weekday: "long", day: "numeric", month: "long" })}</p>
            {g.items.map((m, i) => {
              const mine = m.sender_id === props.me;
              const prev = g.items[i - 1];
              const showName = !mine && !props.isOrgSide && m.kind !== "system" && (!prev || prev.sender_id !== m.sender_id);
              if (m.kind === "system") return <SystemMessage key={m.id} m={m} />;
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.22 }} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className="max-w-[78%]">
                    {showName ? <p className="mb-0.5 px-3 text-[11px] text-ink-3">{props.names[m.sender_id] ?? ""}</p> : null}
                    {m.kind === "trial_proposal" ? (
                      <TrialBubble m={m} mine={mine} />
                    ) : (
                      <div className={cn("rounded-[22px] px-4 py-2.5 text-[15px] leading-snug", mine ? "rounded-br-md bg-accent text-white shadow-[var(--shadow-glow)]" : "glass glass-regular rounded-bl-md")}>
                        {m.attachment_path ? <Attachment url={attachments[m.attachment_path]} name={(m.metadata?.name as string) ?? t("chat.attachment")} path={m.attachment_path} /> : null}
                        {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                        <p className={cn("mt-0.5 text-right text-[10px]", mine ? "text-white/75" : "text-ink-3")}>{f.time(m.created_at)}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
        {myLast ? (
          <p className="mt-1 flex items-center justify-end gap-1 px-2 text-[11px] text-ink-3">
            {seen ? <><CheckCheck className="size-3.5 text-accent" /> {t("chat.seen")}</> : <><Check className="size-3.5" /> {t("chat.sent")}</>}
          </p>
        ) : null}
        <AnimatePresence>
          {typing ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass glass-regular mt-2 inline-flex gap-1 rounded-full px-4 py-3" aria-label={t("chat.typing")}>
              {[0, 1, 2].map((d) => <motion.span key={d} className="size-1.5 rounded-full bg-[var(--fm-text-2)]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="pb-[max(env(safe-area-inset-bottom),10px)] lg:pb-4">
        {props.canSend ? (
          <form onSubmit={submit} className="glass glass-elevated flex items-end gap-1.5 rounded-[26px] p-1.5">
            <input ref={file} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            <GlassButton type="button" variant="ghost" size="icon" aria-label={t("chat.attach")} onClick={() => file.current?.click()} disabled={sending}>
              <Paperclip className="size-5" />
            </GlassButton>
            <label htmlFor="chat-input" className="sr-only">{t("chat.placeholder")}</label>
            <textarea
              id="chat-input"
              rows={1}
              value={text}
              maxLength={4000}
              placeholder={t("chat.placeholder")}
              onChange={(e) => { setText(e.target.value); emitTyping(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
              className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-ink-3"
            />
            <GlassButton type="submit" size="icon" aria-label={t("common.send")} disabled={!text.trim()} loading={sending}>
              <SendHorizontal className="size-5" />
            </GlassButton>
          </form>
        ) : (
          <GlassCard material="thin" className="flex items-center justify-center gap-2 py-3 text-center text-sm text-ink-2">
            <Lock className="size-4" /> {props.blocked ? t("chat.blockedBody") : props.guardianPending ? t("chat.supervisedPending") : t("chat.cannotSend")}
          </GlassCard>
        )}
      </div>

      <GlassBottomSheet open={menu} onClose={() => setMenu(false)} title={t("chat.options")}>
        <div className="flex flex-col gap-2 pb-2">
          <GlassButton variant="glass" size="lg" className="justify-start" onClick={() => pref({ muted: !props.muted })}><BellOff className="size-4" /> {props.muted ? t("chat.unmute") : t("chat.mute")}</GlassButton>
          <GlassButton variant="glass" size="lg" className="justify-start" onClick={() => pref({ archived: !props.archived })}><Archive className="size-4" /> {props.archived ? t("chat.unarchive") : t("chat.archive")}</GlassButton>
          <GlassButton variant="glass" size="lg" className="justify-start" onClick={() => { setMenu(false); setReport(true); }}>{t("common.report")}</GlassButton>
          {props.blocked ? (
            props.blockedByMe ? <GlassButton variant="glass" size="lg" className="justify-start" onClick={() => toggleBlock(false)}><Unlock className="size-4" /> {t("common.unblock")}</GlassButton> : null
          ) : (
            <GlassButton variant="glass" size="lg" className="justify-start text-danger" onClick={() => { setMenu(false); setConfirmBlock(true); }}><Lock className="size-4" /> {t("chat.block")}</GlassButton>
          )}
        </div>
      </GlassBottomSheet>
      <ReportSheet open={report} onClose={() => setReport(false)} target={{ type: "conversation", id: props.conversationId }} />
      <GlassModal open={confirmBlock} onClose={() => setConfirmBlock(false)} title={t("chat.blockTitle")}>
        <p className="text-[15px] text-ink-2">{t("chat.blockConfirm")}</p>
        <div className="mt-5 flex gap-3">
          <GlassButton variant="ghost" className="flex-1" onClick={() => setConfirmBlock(false)}>{t("common.cancel")}</GlassButton>
          <GlassButton variant="danger" className="flex-1" onClick={() => toggleBlock(true)}>{t("chat.block")}</GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}

function SystemMessage({ m }: { m: MessageRow }) {
  const { t } = useI18n();
  const event = (m.metadata?.event as string) ?? m.body;
  return (
    <div className="my-3 flex justify-center">
      <span className="glass glass-tint-green inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium">
        <Sparkles className="size-3.5" /> {t(`chat.sys.${event === "application_contact" ? "application" : event === "trial" ? "trial" : "match"}`)}
      </span>
    </div>
  );
}

function TrialBubble({ m, mine }: { m: MessageRow; mine: boolean }) {
  const { t, f } = useI18n();
  const md = m.metadata as { trial_id?: string; title?: string; starts_at?: string; location?: string };
  return (
    <Link href={md.trial_id ? `/trials/${md.trial_id}` : "/trials"} className="block">
      <GlassCard material={mine ? "tint-green" : "elevated"} interactive className="flex flex-col gap-1.5 p-4">
        <p className="fm-eyebrow flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {t("chat.trialProposal")}</p>
        <p className="fm-title text-[16px]">{md.title ?? t("nav.trials")}</p>
        {md.starts_at ? <p className="text-sm text-ink-2">{f.date(md.starts_at, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{md.location ? ` · ${md.location}` : ""}</p> : null}
        {m.body ? <p className="text-sm">{m.body}</p> : null}
        <span className="mt-1 text-sm font-semibold text-accent-strong dark:text-accent">{t("chat.viewTrial")}</span>
      </GlassCard>
    </Link>
  );
}

function Attachment({ url, name, path }: { url?: string; name: string; path: string }) {
  const isImage = path.endsWith(".webp") || path.endsWith(".png") || path.endsWith(".jpg");
  if (!url) return <p className="mb-1 text-sm opacity-70">…</p>;
  return isImage ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="-mx-2 -mt-0.5 mb-1.5 block overflow-hidden rounded-[16px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} className="max-h-72 w-full object-cover" />
    </a>
  ) : (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-2 underline-offset-2 hover:underline">
      <FileText className="size-4 shrink-0" /> <span className="truncate">{name}</span>
    </a>
  );
}
