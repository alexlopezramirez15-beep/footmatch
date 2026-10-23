"use client";

import * as React from "react";
import { useSyncedState } from "@/lib/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BriefcaseBusiness, CalendarDays, CheckCheck, Heart, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { EmptyState, GlassButton, GlassCard } from "@/components/glass/primitives";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import type { NotificationRow } from "@/lib/types";
import { markNotificationsReadAction } from "@/domains/notifications/actions";

const ICONS: Record<string, React.ReactNode> = {
  matches: <Sparkles className="size-5" />,
  messages: <MessageCircle className="size-5" />,
  interests: <Heart className="size-5" />,
  applications: <BriefcaseBusiness className="size-5" />,
  trials: <CalendarDays className="size-5" />,
  security: <ShieldCheck className="size-5" />,
};

export function NotificationList({ items }: { items: NotificationRow[] }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [list, setList] = useSyncedState(items);
  const unread = list.filter((n) => !n.read_at).length;

  const markAll = async () => {
    const res = await markNotificationsReadAction();
    if (!res.ok) return;
    setList((l) => l.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    window.dispatchEvent(new CustomEvent("fm:unread", { detail: 0 }));
    router.refresh();
  };
  const open = (n: NotificationRow) => {
    if (!n.read_at) {
      markNotificationsReadAction([n.id]);
      setList((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      window.dispatchEvent(new CustomEvent("fm:unread", { detail: Math.max(0, unread - 1) }));
    }
  };
  // Título traducido por tipo; si no hay traducción, el texto guardado.
  const title = (n: NotificationRow) => {
    const k = `notif.${n.type}`;
    const tr = t(k);
    return tr === k ? n.title : tr;
  };

  if (!list.length) return <EmptyState icon={<Bell className="size-7" />} title={t("notif.emptyTitle")} body={t("notif.emptyBody")} />;
  return (
    <div className="flex flex-col gap-3">
      {unread ? (
        <div className="flex justify-end">
          <GlassButton variant="ghost" size="sm" onClick={markAll}><CheckCheck className="size-4" /> {t("notif.markAll")}</GlassButton>
        </div>
      ) : null}
      <GlassCard material="regular" padded={false} className="divide-y divide-[var(--fm-hairline)] overflow-hidden">
        {list.map((n) => {
          const body = (
            <div className={cn("flex items-start gap-3 px-4 py-3.5", !n.read_at && "bg-accent/5")}>
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", n.read_at ? "glass glass-thin text-ink-2" : "glass glass-tint-green")}>
                {ICONS[n.type.split(".")[0]] ?? <Bell className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[15px]", n.read_at ? "font-medium" : "font-bold")}>{title(n)}</p>
                {n.body ? <p className="line-clamp-2 text-[13px] text-ink-2">{n.body}</p> : null}
                <p className="mt-0.5 text-[11px] text-ink-3">{f.relative(n.created_at)}</p>
              </div>
              {!n.read_at ? <span className="mt-2 size-2.5 shrink-0 rounded-full bg-accent" aria-label={t("chat.unread")} /> : null}
            </div>
          );
          return n.link && n.link.startsWith("/") ? (
            <Link key={n.id} href={n.link} onClick={() => open(n)} className="block hover:bg-white/5">{body}</Link>
          ) : (
            <button key={n.id} type="button" onClick={() => open(n)} className="block w-full text-left">{body}</button>
          );
        })}
      </GlassCard>
    </div>
  );
}
