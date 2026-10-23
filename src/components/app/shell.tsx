"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, Briefcase, CalendarDays, Compass, Heart, House, KanbanSquare, LogOut, MessageCircle, Search, Settings, Shield, Trophy, UserRound, FileText,
} from "lucide-react";
import { GlassSidebar, GlassTabBar, type NavItem } from "@/components/glass/navigation";
import { GlassAvatar } from "@/components/glass/primitives";
import { Logo } from "@/components/brand/logo";
import { useI18n } from "@/i18n/client";
import { getBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/glass/overlays";
import { haptic } from "@/lib/haptics";
import type { NotificationRow } from "@/lib/types";
import { SelfProvider } from "./self-context";

export type ShellProps = {
  mode: "player" | "organization" | "professional";
  userId: string;
  name: string;
  avatarUrl: string | null;
  orgName?: string | null;
  isAdmin: boolean;
  unreadNotifications: number;
  unreadChats: number;
  children: React.ReactNode;
};

export function AppShell(props: ShellProps) {
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();
  // Conversación abierta: pantalla completa sin barra de pestañas (como Mensajes de iOS)
  const immersive = /^\/chats\/[^/]+$/.test(path);
  const { push } = useToast();
  const [unread, setUnread] = React.useState(props.unreadNotifications);
  const [chats, setChats] = React.useState(props.unreadChats);

  React.useEffect(() => setUnread(props.unreadNotifications), [props.unreadNotifications]);
  React.useEffect(() => setChats(props.unreadChats), [props.unreadChats]);

  // Notificaciones en tiempo real (Supabase Realtime, filtradas por RLS)
  React.useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`notifications:${props.userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${props.userId}` },
        (payload) => {
          const n = payload.new as NotificationRow;
          setUnread((u) => u + 1);
          if (n.type.startsWith("messages.")) {
            setChats((c) => c + 1);
            if (typeof window !== "undefined" && window.location.pathname.startsWith("/chats/")) return;
          }
          if (n.type === "matches.new") haptic("match");
          push({ tone: n.type.startsWith("matches") ? "success" : "info", title: n.title, body: n.body ?? undefined });
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [props.userId, push, router]);

  const org = props.mode === "organization";
  const primary: NavItem[] = [
    { href: "/home", label: t("nav.home"), icon: <House className="size-[22px]" strokeWidth={1.8} /> },
    { href: "/discover", label: t("nav.discover"), icon: <Compass className="size-[22px]" strokeWidth={1.8} /> },
    { href: "/opportunities", label: t("nav.opportunities"), icon: <Briefcase className="size-[22px]" strokeWidth={1.8} /> },
    { href: "/chats", label: t("nav.chats"), icon: <MessageCircle className="size-[22px]" strokeWidth={1.8} />, badge: chats || undefined },
    { href: "/profile", label: t("nav.profile"), icon: <UserRound className="size-[22px]" strokeWidth={1.8} />, match: ["/profile", "/club"] },
  ];

  const secondary: NavItem[] = [
    ...(org
      ? [
          { href: "/club", label: t("nav.club"), icon: <Trophy className="size-5" strokeWidth={1.8} />, match: ["/club"] },
          { href: "/club/pipeline", label: t("nav.pipeline"), icon: <KanbanSquare className="size-5" strokeWidth={1.8} /> },
        ]
      : [{ href: "/applications", label: t("nav.applications"), icon: <FileText className="size-5" strokeWidth={1.8} /> }]),
    { href: "/trials", label: t("nav.trials"), icon: <CalendarDays className="size-5" strokeWidth={1.8} /> },
    { href: "/search", label: t("nav.search"), icon: <Search className="size-5" strokeWidth={1.8} /> },
    { href: "/favorites", label: t("nav.favorites"), icon: <Heart className="size-5" strokeWidth={1.8} /> },
    { href: "/notifications", label: t("nav.notifications"), icon: <Bell className="size-5" strokeWidth={1.8} />, badge: unread || undefined },
    { href: "/settings", label: t("nav.settings"), icon: <Settings className="size-5" strokeWidth={1.8} /> },
    ...(props.isAdmin ? [{ href: "/admin", label: t("nav.admin"), icon: <Shield className="size-5" strokeWidth={1.8} /> }] : []),
  ];

  const self = React.useMemo(() => ({ id: props.userId, name: props.name, avatarUrl: props.avatarUrl, mode: props.mode }), [props.userId, props.name, props.avatarUrl, props.mode]);

  return (
    <SelfProvider value={self}>
      <GlassSidebar
        primary={primary}
        secondary={secondary}
        header={
          <Link href="/home" className="inline-flex">
            <Logo />
          </Link>
        }
        footer={
          <div className="glass glass-thin flex items-center gap-3 rounded-2xl p-2.5">
            <GlassAvatar src={props.avatarUrl} name={props.name} seed={props.userId} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{props.name || "—"}</p>
              {props.orgName ? <p className="truncate text-xs text-ink-2">{props.orgName}</p> : null}
            </div>
            <form action="/auth/signout" method="post">
              <button aria-label={t("nav.logout")} className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:text-ink">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        }
      />
      <div className="lg:pl-[284px]">
        <main id="main" className={`${immersive ? "" : "fm-safe-bottom "}mx-auto w-full max-w-3xl px-4 sm:px-6 lg:max-w-5xl lg:px-8`}>
          {props.children}
        </main>
      </div>
      {immersive ? null : <GlassTabBar items={primary} />}
      <UnreadSetter onNotifications={setUnread} />
    </SelfProvider>
  );
}

/** Permite a las páginas (p. ej. Notificaciones) restablecer el contador. */
const UnreadCtx = React.createContext<((n: number) => void) | null>(null);
function UnreadSetter({ onNotifications }: { onNotifications: (n: number) => void }) {
  React.useEffect(() => {
    const h = (e: Event) => onNotifications((e as CustomEvent<number>).detail);
    window.addEventListener("fm:unread", h);
    return () => window.removeEventListener("fm:unread", h);
  }, [onNotifications]);
  return <UnreadCtx.Provider value={onNotifications}>{null}</UnreadCtx.Provider>;
}
