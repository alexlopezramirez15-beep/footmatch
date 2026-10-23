"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

export type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: number; match?: string[] };

function isActive(path: string, item: NavItem) {
  const prefixes = item.match ?? [item.href];
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/* ------------------------------------------------------------------ */
/* GlassTabBar: cápsula flotante inferior (móvil)                      */
/* ------------------------------------------------------------------ */
export function GlassTabBar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="glass glass-elevated pointer-events-auto flex h-[var(--tabbar-h)] w-full max-w-md items-center justify-between rounded-full px-1.5">
        {items.map((item) => {
          const active = isActive(path, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => haptic("light")}
              aria-current={active ? "page" : undefined}
              className="relative flex h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full outline-none"
            >
              {active && (
                <motion.span
                  layoutId="tabbar-active"
                  className="glass glass-thin absolute inset-x-1 inset-y-0 rounded-full"
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                >
                  <span className="absolute -top-px left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_14px_var(--fm-accent)]" />
                </motion.span>
              )}
              <span className={cn("relative z-10 transition-colors", active ? "text-accent-strong dark:text-accent" : "text-ink-2")}>
                {item.icon}
                {item.badge ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] leading-[18px] font-bold text-white tabular">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </span>
              <span className={cn("relative z-10 text-[10px] font-semibold tracking-tight", active ? "text-ink" : "text-ink-2")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* GlassSidebar: navegación profesional de escritorio                  */
/* ------------------------------------------------------------------ */
export function GlassSidebar({
  primary,
  secondary,
  header,
  footer,
}: {
  primary: NavItem[];
  secondary: NavItem[];
  header: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const path = usePathname();
  const renderItem = (item: NavItem) => {
    const active = isActive(path, item);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[14px] font-medium transition-colors",
          active ? "text-ink" : "text-ink-2 hover:text-ink",
        )}
      >
        {active && (
          <motion.span layoutId="sidebar-active" className="glass glass-elevated absolute inset-0 rounded-2xl" transition={{ type: "spring", stiffness: 420, damping: 36 }} />
        )}
        <span className={cn("relative z-10", active && "text-accent-strong dark:text-accent")}>{item.icon}</span>
        <span className="relative z-10 flex-1">{item.label}</span>
        {item.badge ? (
          <span className="relative z-10 rounded-full bg-accent px-2 text-[11px] leading-5 font-bold text-accent-contrast tabular">{item.badge}</span>
        ) : null}
      </Link>
    );
  };
  return (
    <aside className="glass glass-regular fixed top-4 bottom-4 left-4 z-40 hidden w-[260px] flex-col rounded-[var(--radius-xl)] p-3 lg:flex">
      <div className="px-2 pt-2 pb-5">{header}</div>
      <nav aria-label="Principal" className="flex flex-col gap-1">
        {primary.map(renderItem)}
      </nav>
      <div className="mx-3 my-4 h-px bg-[var(--fm-hairline)]" />
      <nav aria-label="Secundaria" className="flex flex-col gap-1 overflow-y-auto">
        {secondary.map(renderItem)}
      </nav>
      <div className="mt-auto pt-3">{footer}</div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* GlassNavbar: cabecera con título grande que se compacta al hacer    */
/* scroll (patrón "large title" de iOS)                                */
/* ------------------------------------------------------------------ */
export function GlassNavbar({
  title,
  subtitle,
  eyebrow,
  leading,
  actions,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const { scrollY } = useScroll();
  const [compact, setCompact] = React.useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setCompact(v > 56));

  return (
    <>
      <motion.div
        initial={false}
        animate={{ opacity: compact ? 1 : 0, y: compact ? 0 : -12 }}
        transition={{ duration: 0.22 }}
        className={cn("pointer-events-none fixed inset-x-0 top-0 z-40 px-3 lg:left-[284px]", compact && "pointer-events-auto")}
        style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}
        aria-hidden={!compact}
      >
        <div className="glass glass-elevated mx-auto flex h-12 max-w-3xl items-center gap-2 rounded-full px-2">
          <div className="flex w-20 items-center">{leading}</div>
          <p className="flex-1 truncate text-center text-[15px] font-semibold">{title}</p>
          <div className="flex w-20 items-center justify-end gap-1">{actions}</div>
        </div>
      </motion.div>
      <header className={cn("fm-safe-top mb-5 flex items-end justify-between gap-3 px-1 pt-3", className)}>
        <div className="min-w-0">
          {leading ? <div className="mb-3">{leading}</div> : null}
          {eyebrow ? <div className="fm-eyebrow mb-1">{eyebrow}</div> : null}
          <h1 className="fm-display text-[34px] sm:text-[40px]">{title}</h1>
          {subtitle ? <div className="mt-1.5 text-[15px] text-ink-2">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div> : null}
      </header>
    </>
  );
}

export function IconLink({ href, label, children, badge }: { href: string; label: string; children: React.ReactNode; badge?: number }) {
  return (
    <Link href={href} aria-label={label} className="glass glass-regular relative flex size-11 items-center justify-center rounded-full transition-transform active:scale-95">
      {children}
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] leading-[18px] font-bold text-white tabular">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
