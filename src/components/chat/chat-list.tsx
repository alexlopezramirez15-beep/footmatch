"use client";

import * as React from "react";
import Link from "next/link";
import { BellOff, Lock, MessageCircle, ShieldCheck } from "lucide-react";
import { DemoBadge, EmptyState, GlassAvatar, GlassButton, GlassCard, GlassSegmentedControl } from "@/components/glass/primitives";
import { GlassInput } from "@/components/glass/forms";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import type { ConversationVM } from "@/domains/chat/queries";

export function ChatList({ items }: { items: ConversationVM[] }) {
  const { t, f } = useI18n();
  const [filter, setFilter] = React.useState<"all" | "unread" | "archived">("all");
  const [q, setQ] = React.useState("");
  const shown = items.filter((c) => {
    if (filter === "archived" ? !c.archived : c.archived) return false;
    if (filter === "unread" && !c.unread) return false;
    if (q && !c.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const preview = (c: ConversationVM) => {
    const m = c.lastMessage;
    if (!m) return t("chat.noMessages");
    if (m.kind === "system") return t("chat.systemNew");
    if (m.kind === "trial_proposal") return t("chat.trialProposal");
    if (m.kind === "file") return `📎 ${t("chat.attachment")}`;
    return `${m.senderIsMe ? `${t("chat.you")}: ` : ""}${m.body ?? ""}`;
  };
  if (!items.length) {
    return <EmptyState icon={<MessageCircle className="size-7" />} title={t("chat.emptyTitle")} body={t("chat.emptyBody")} action={<Link href="/discover"><GlassButton>{t("home.ctaDiscover")}</GlassButton></Link>} />;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:flex-1"><GlassInput type="search" placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <GlassSegmentedControl
          id="chat-filter"
          options={[
            { value: "all", label: t("chat.all") },
            { value: "unread", label: t("chat.unread"), badge: items.filter((c) => c.unread && !c.archived).length || undefined },
            { value: "archived", label: t("chat.archived") },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      {shown.length === 0 ? <p className="py-8 text-center text-sm text-ink-2">{t("chat.noneInFilter")}</p> : null}
      <GlassCard material="regular" padded={false} className="divide-y divide-[var(--fm-hairline)] overflow-hidden">
        {shown.map((c) => (
          <Link key={c.id} href={c.href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/5">
            <div className="relative">
              <GlassAvatar src={c.imageUrl} name={c.title} seed={c.seed} size={52} />
              {c.unread ? <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white tabular">{c.unread}</span> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className={cn("truncate text-[15px]", c.unread ? "font-bold" : "font-semibold")}>{c.title}</p>
                {c.supervised ? <ShieldCheck className="size-3.5 shrink-0 text-warn" aria-label={t("chat.supervised")} /> : null}
                {c.blocked ? <Lock className="size-3.5 shrink-0 text-ink-3" aria-label={t("chat.blocked")} /> : null}
                {c.muted ? <BellOff className="size-3.5 shrink-0 text-ink-3" aria-label={t("chat.muted")} /> : null}
                {c.isDemo ? <DemoBadge /> : null}
              </div>
              <p className={cn("truncate text-[13px]", c.unread ? "text-ink" : "text-ink-2")}>{preview(c)}</p>
            </div>
            {c.lastMessage ? <span className="shrink-0 self-start pt-1 text-[11px] text-ink-3">{f.relative(c.lastMessage.at)}</span> : null}
          </Link>
        ))}
      </GlassCard>
    </div>
  );
}
