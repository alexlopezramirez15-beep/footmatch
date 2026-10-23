"use client";

import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { materialClass, springPress, type Material } from "./tokens";

/* ------------------------------------------------------------------ */
/* GlassCard                                                           */
/* ------------------------------------------------------------------ */
type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  material?: Material;
  radius?: "md" | "lg" | "xl";
  padded?: boolean;
  interactive?: boolean;
};

export const GlassCard = React.forwardRef<HTMLDivElement, CardProps>(function GlassCard(
  { material = "regular", radius = "lg", padded = true, interactive, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        materialClass(material),
        radius === "md" && "rounded-[var(--radius-md)]",
        radius === "lg" && "rounded-[var(--radius-lg)]",
        radius === "xl" && "rounded-[var(--radius-xl)]",
        padded && "p-5",
        interactive &&
          "transition-[transform,box-shadow] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-3)] active:scale-[0.99]",
        className,
      )}
      {...rest}
    />
  );
});

/* ------------------------------------------------------------------ */
/* GlassButton                                                         */
/* ------------------------------------------------------------------ */
type ButtonVariant = "primary" | "glass" | "ghost" | "danger" | "dark";
type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-lg";

export type GlassButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  success?: boolean;
  children?: React.ReactNode;
  hapticFeedback?: boolean;
};

const buttonVariant: Record<ButtonVariant, string> = {
  primary: "glass glass-tint-green font-semibold shadow-[var(--shadow-glow)]",
  glass: "glass glass-regular text-ink",
  ghost: "bg-transparent text-ink hover:bg-[var(--fm-hairline)]",
  danger: "glass glass-tint-red text-danger font-semibold",
  dark: "glass glass-dark font-semibold",
};
const buttonSize: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-14 px-7 text-base gap-2.5",
  icon: "h-11 w-11 justify-center",
  "icon-lg": "h-16 w-16 justify-center",
};

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { variant = "glass", size = "md", loading, success, className, children, disabled, onClick, hapticFeedback = true, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      whileTap={reduce || disabled || loading ? undefined : { scale: 0.95 }}
      whileHover={reduce || disabled ? undefined : { y: -1 }}
      transition={springPress}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (hapticFeedback) haptic("light");
        onClick?.(e);
      }}
      className={cn(
        "group/btn relative inline-flex select-none items-center rounded-full whitespace-nowrap",
        "transition-[opacity,background-color,box-shadow] duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:pointer-events-none disabled:opacity-45",
        buttonVariant[variant],
        buttonSize[size],
        className,
      )}
      {...rest}
    >
      {/* Reflejo dinámico al pulsar */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-active/btn:opacity-100"
        style={{ background: "radial-gradient(80% 120% at 50% 0%, rgb(255 255 255 / 0.45), transparent 60%)" }}
      />
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
      {success ? <span className="sr-only">✓</span> : null}
    </motion.button>
  );
});

/* ------------------------------------------------------------------ */
/* GlassBadge                                                          */
/* ------------------------------------------------------------------ */
type BadgeTone = "neutral" | "green" | "blue" | "amber" | "red" | "demo" | "dark";
const badgeTone: Record<BadgeTone, string> = {
  neutral: "glass glass-thin text-ink-2",
  green: "glass glass-thin text-accent-strong dark:text-accent",
  blue: "glass glass-tint-blue text-info",
  amber: "glass glass-tint-amber text-warn",
  red: "glass glass-tint-red text-danger",
  demo: "border border-dashed border-warn/60 bg-warn/10 text-warn",
  dark: "glass glass-dark",
};

export function GlassBadge({
  tone = "neutral",
  className,
  icon,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; icon?: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold tracking-wide whitespace-nowrap",
        badgeTone[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

export function DemoBadge({ label = "DEMO" }: { label?: string }) {
  return (
    <GlassBadge tone="demo" title="Dato demostrativo, no real">
      {label}
    </GlassBadge>
  );
}

/* ------------------------------------------------------------------ */
/* GlassAvatar                                                         */
/* ------------------------------------------------------------------ */
function hashHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "·"
  );
}

export function GlassAvatar({
  src,
  name,
  seed,
  size = 44,
  ring,
  square,
  className,
}: {
  src?: string | null;
  name: string;
  seed?: string;
  size?: number;
  ring?: boolean;
  square?: boolean;
  className?: string;
}) {
  const hue = hashHue(seed ?? name);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold text-white",
        square ? "rounded-[28%]" : "rounded-full",
        ring && "ring-2 ring-white/70 dark:ring-white/20 shadow-[var(--shadow-2)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.36),
        background: src ? undefined : `linear-gradient(140deg, hsl(${hue} 55% 52%), hsl(${(hue + 40) % 360} 60% 32%))`,
      }}
      aria-hidden={!src}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/25 to-transparent" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* GlassSkeleton                                                       */
/* ------------------------------------------------------------------ */
export function GlassSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("fm-skeleton rounded-2xl", className)} />;
}

/* ------------------------------------------------------------------ */
/* GlassProgress (lineal y anillo)                                     */
/* ------------------------------------------------------------------ */
export function GlassProgress({ value, label, className }: { value: number; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v)}
        aria-label={label}
        className="glass glass-ultra-thin h-2.5 overflow-hidden rounded-full"
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent-strong to-accent shadow-[0_0_12px_var(--fm-accent)]"
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export function GlassRing({ value, size = 64, stroke = 6, children, label }: { value: number; size?: number; stroke?: number; children?: React.ReactNode; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v)} %`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--fm-hairline)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#fm-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="fm-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--fm-accent)" />
            <stop offset="100%" stopColor="var(--fm-accent-strong)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GlassSegmentedControl                                               */
/* ------------------------------------------------------------------ */
export function GlassSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  id,
  className,
  size = "md",
}: {
  options: Array<{ value: T; label: React.ReactNode; badge?: number }>;
  value: T;
  onChange: (v: T) => void;
  id: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("glass glass-thin inline-flex rounded-full p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 rounded-full font-medium whitespace-nowrap transition-colors",
              size === "md" ? "h-9 px-4 text-sm" : "h-8 px-3 text-xs",
              active ? "text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="glass glass-elevated absolute inset-0 rounded-full"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.label}
              {o.badge ? (
                <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 font-bold text-accent-contrast tabular">{o.badge}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GlassTooltip (CSS, accesible por foco)                              */
/* ------------------------------------------------------------------ */
export function GlassTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="glass glass-elevated pointer-events-none absolute -top-2 left-1/2 z-50 -translate-x-1/2 -translate-y-full rounded-xl px-2.5 py-1 text-xs font-medium whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* GlassFloatingPanel                                                  */
/* ------------------------------------------------------------------ */
export function GlassFloatingPanel({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass glass-elevated rounded-[var(--radius-lg)] p-4", className)} {...rest} />;
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard material="thin" className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      {icon ? (
        <div className="glass glass-elevated mb-4 flex size-16 items-center justify-center rounded-[22px] text-accent">{icon}</div>
      ) : null}
      <h3 className="fm-title text-lg">{title}</h3>
      {body ? <p className="mt-1.5 max-w-sm text-sm text-ink-2 text-balance">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </GlassCard>
  );
}

export function SectionHeader({ title, action, eyebrow }: { title: string; action?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div>
        {eyebrow ? <p className="fm-eyebrow mb-0.5">{eyebrow}</p> : null}
        <h2 className="fm-title text-[21px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
