"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { BadgeCheck, CalendarDays, Flame, MapPin, ShieldCheck, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n/client";
import { countryName, flag } from "@/domains/football/catalog";
import { INTL_LOCALE } from "@/i18n/config";
import { DemoBadge, GlassAvatar, GlassBadge, GlassButton, GlassCard } from "@/components/glass/primitives";
import type { MatchResult } from "@/domains/matching/engine";

export type PlayerCardVM = {
  id: string;
  name: string;
  age: number | null;
  position: string;
  secondary?: string[];
  nationality?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  currentClub?: string | null;
  category?: string | null;
  availability: string;
  photoUrl?: string | null;
  isDemo?: boolean;
  isMinor?: boolean;
  heightCm?: number | null;
  foot?: string | null;
  match?: MatchResult | null;
};

export type OpportunityCardVM = {
  id: string;
  title: string;
  type: string;
  orgId: string;
  orgName: string;
  crestUrl?: string | null;
  verified?: boolean;
  category?: string | null;
  positions: string[];
  country?: string | null;
  city?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  deadline?: string | null;
  status: string;
  isDemo?: boolean;
  match?: MatchResult | null;
  applied?: boolean;
};

/* ------------------------------------------------------------------ */
/* Indicador de compatibilidad                                         */
/* ------------------------------------------------------------------ */
export function MatchPill({ score, eligible = true, size = "md", className }: { score: number; eligible?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "glass inline-flex items-center gap-1.5 rounded-full font-semibold tabular",
        eligible && score >= 70 ? "glass-tint-green" : eligible ? "glass-thin" : "glass-tint-amber text-warn",
        size === "sm" && "h-7 px-2.5 text-[12px]",
        size === "md" && "h-8 px-3 text-[13px]",
        size === "lg" && "h-10 px-4 text-[15px]",
        className,
      )}
      title={t("reasons.method")}
    >
      <Sparkles className={size === "lg" ? "size-4" : "size-3.5"} aria-hidden />
      <span>{score} %</span>
      <span className="font-medium opacity-80">MATCH</span>
    </span>
  );
}

/** Lista legible de razones (sólo a partir del cálculo, sin inventar). */
export function MatchReasons({ match, max = 4, dark }: { match: MatchResult; max?: number; dark?: boolean }) {
  const { t } = useI18n();
  const failed = match.failedMandatory.map((c) => t(`reasons.crit.${c}`));
  return (
    <div className="space-y-2">
      {!match.eligible ? (
        <p className={cn("text-[13px] font-semibold", dark ? "text-amber-300" : "text-warn")}>{t("reasons.notEligible", { list: failed.join(", ") })}</p>
      ) : null}
      <ul className="space-y-1.5">
        {match.strengths.slice(0, max).map((r) => (
          <li key={r.criterion} className={cn("flex items-start gap-2 text-[13px]", dark ? "text-white/90" : "text-ink-2")}>
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            {t(`reasons.${r.reason}`)}
          </li>
        ))}
        {match.gaps.slice(0, Math.max(0, max - match.strengths.length)).map((r) => (
          <li key={r.criterion} className={cn("flex items-start gap-2 text-[13px]", dark ? "text-white/70" : "text-ink-3")}>
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
            {t(`reasons.${r.reason}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Crest({ url, name, size = 48, id }: { url?: string | null; name: string; size?: number; id?: string }) {
  return <GlassAvatar src={url} name={name} seed={id ?? name} size={size} square ring />;
}

/* ------------------------------------------------------------------ */
/* GlassProfileCard: tarjeta deportiva grande (Discover)               */
/* ------------------------------------------------------------------ */
export function GlassProfileCard({ player, className, children }: { player: PlayerCardVM; className?: string; children?: React.ReactNode }) {
  const { t, locale } = useI18n();
  const l = INTL_LOCALE[locale];
  const place = player.city || player.region;
  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-[32px] bg-[#0b1220] shadow-[var(--shadow-4)] select-none", className)}>
      {player.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.photoUrl} alt={player.name} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="fm-pitch absolute inset-0 flex items-center justify-center">
          <span className="fm-display text-[120px] text-white/15">{player.position}</span>
        </div>
      )}
      <div className="fm-photo-scrim absolute inset-0" />
      {/* Reflejo superior del cristal */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/15 to-transparent" />
      <div className="absolute top-4 right-4 left-4 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <GlassBadge tone="dark">{t(`football.av.${player.availability}`)}</GlassBadge>
          {player.isMinor ? <GlassBadge tone="dark" icon={<ShieldCheck className="size-3" />}>{t("common.minor")}</GlassBadge> : null}
          {player.isDemo ? <DemoBadge /> : null}
        </div>
        {player.match ? <MatchPill score={player.match.score} eligible={player.match.eligible} /> : null}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 pb-6 text-white">
        <h2 className="fm-display text-[30px] uppercase sm:text-[34px]">{player.name}</h2>
        <p className="mt-1.5 text-[15px] font-medium text-white/90">
          {player.age != null ? `${t("common.years", { n: player.age })} · ` : ""}
          {t(`football.pos.${player.position}`)}
        </p>
        <p className="mt-0.5 text-[14px] text-white/75">
          {flag(player.nationality ?? player.country)} {countryName(player.nationality ?? player.country, l)}
          {player.category ? ` · ${t(`football.cat.${player.category}`)}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] text-white/80">
          {player.currentClub ? <span className="glass glass-dark rounded-full px-2.5 py-1">{player.currentClub}</span> : null}
          {place ? (
            <span className="glass glass-dark inline-flex items-center gap-1 rounded-full px-2.5 py-1">
              <MapPin className="size-3" /> {place}
            </span>
          ) : null}
          {player.heightCm ? <span className="glass glass-dark rounded-full px-2.5 py-1">{player.heightCm} cm</span> : null}
          {player.foot ? <span className="glass glass-dark rounded-full px-2.5 py-1">{t(`football.foot.${player.foot}`)}</span> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GlassOpportunityCard                                                */
/* ------------------------------------------------------------------ */
export function GlassOpportunityCard({
  opp,
  href,
  action,
  compact,
  className,
}: {
  opp: OpportunityCardVM;
  href?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const { t, f, locale } = useI18n();
  const l = INTL_LOCALE[locale];
  const body = (
    <GlassCard material="regular" interactive={Boolean(href)} className={cn("flex h-full flex-col gap-4", compact && "p-4", className)}>
      <div className="flex items-start gap-3">
        <Crest url={opp.crestUrl} name={opp.orgName} id={opp.orgId} size={compact ? 42 : 48} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-[13px] font-medium text-ink-2">
            {opp.orgName}
            {opp.verified ? <BadgeCheck className="size-3.5 shrink-0 text-info" aria-label={t("common.verified")} /> : null}
          </p>
          <h3 className={cn("fm-title mt-0.5 uppercase", compact ? "line-clamp-2 text-[15px]" : "text-[17px]")}>{opp.title}</h3>
        </div>
        {opp.isDemo ? <DemoBadge /> : null}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[12px]">
        <GlassBadge tone="neutral">{t(`football.opp.${opp.type}`)}</GlassBadge>
        {opp.category ? <GlassBadge tone="neutral">{t(`football.cat.${opp.category}`)}</GlassBadge> : null}
        {opp.positions.slice(0, 3).map((p) => (
          <GlassBadge key={p} tone="green">{t(`football.pos.${p}`)}</GlassBadge>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
        {opp.city || opp.country ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> {[opp.city, countryName(opp.country, l)].filter(Boolean).join(" · ")}
          </span>
        ) : null}
        {opp.ageMin || opp.ageMax ? (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {opp.ageMin ?? "–"}–{opp.ageMax ?? "–"}
          </span>
        ) : null}
        {opp.deadline ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" /> {f.date(opp.deadline)}
          </span>
        ) : null}
      </div>
      {(opp.match || action) && (
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          {opp.match ? <MatchPill score={opp.match.score} eligible={opp.match.eligible} size="sm" /> : <span />}
          {action}
        </div>
      )}
    </GlassCard>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-[var(--radius-lg)]">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ------------------------------------------------------------------ */
/* GlassMatchCard: conexión reciente                                   */
/* ------------------------------------------------------------------ */
export function GlassMatchCard({ name, imageUrl, id, subtitle, href, isNew }: { name: string; imageUrl?: string | null; id: string; subtitle?: string; href: string; isNew?: boolean }) {
  return (
    <Link href={href} className="block w-[124px] shrink-0">
      <motion.div whileTap={{ scale: 0.96 }} className="glass glass-regular relative flex flex-col items-center rounded-[26px] px-3 pt-4 pb-3 text-center">
        {isNew ? (
          <span className="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-[var(--shadow-glow)]">
            <Flame className="size-3" />
          </span>
        ) : null}
        <GlassAvatar src={imageUrl} name={name} seed={id} size={64} ring />
        <p className="mt-2.5 line-clamp-1 text-[13px] font-semibold">{name}</p>
        {subtitle ? <p className="line-clamp-1 text-[11px] text-ink-2">{subtitle}</p> : null}
      </motion.div>
    </Link>
  );
}

export function InterestButton({ onClick, pending, done, label, doneLabel }: { onClick: () => void; pending?: boolean; done?: boolean; label: string; doneLabel: string }) {
  return (
    <GlassButton
      size="sm"
      variant={done ? "glass" : "primary"}
      disabled={done}
      loading={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {done ? doneLabel : label}
    </GlassButton>
  );
}
