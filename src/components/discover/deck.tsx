"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { Heart, Info, RotateCcw, SlidersHorizontal, Star, X, Compass, ArrowUpRight, MapPin, Users, CalendarDays } from "lucide-react";
import { GlassProfileCard, MatchPill, MatchReasons, type OpportunityCardVM, type PlayerCardVM } from "@/components/cards/cards";
import { DemoBadge, EmptyState, GlassAvatar, GlassBadge, GlassButton } from "@/components/glass/primitives";
import { GlassBottomSheet, useToast } from "@/components/glass/overlays";
import { MatchOverlay, type MatchOverlayData } from "./match-overlay";
import { useI18n } from "@/i18n/client";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import { orgInterestAction, playerInterestAction, toggleFavoriteAction, undoPassAction } from "@/domains/interests/actions";
import { countryName } from "@/domains/football/catalog";
import { INTL_LOCALE } from "@/i18n/config";

export type DeckItem =
  | { kind: "player"; id: string; player: PlayerCardVM }
  | { kind: "opportunity"; id: string; opp: OpportunityCardVM & { description?: string | null } };

type Decision = "like" | "pass";
const SWIPE_X = 110;
const SWIPE_V = 600;

export function DiscoverDeck({ items, onOpenFilters, filtersActive }: { items: DeckItem[]; onOpenFilters?: () => void; filtersActive?: boolean }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [queue, setQueue] = React.useState(items);
  const [lastPass, setLastPass] = React.useState<{ item: DeckItem; interestId: string } | null>(null);
  const [detail, setDetail] = React.useState<DeckItem | null>(null);
  const [match, setMatch] = React.useState<MatchOverlayData | null>(null);
  const [glow, setGlow] = React.useState(false);
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set());
  const busy = React.useRef(false);
  const topControls = React.useRef<{ fling: (d: Decision) => void } | null>(null);

  React.useEffect(() => setQueue(items), [items]);

  const decide = React.useCallback(
    async (item: DeckItem, decision: Decision) => {
      setQueue((q) => q.filter((x) => x.id !== item.id));
      haptic(decision === "like" ? "success" : "light");
      const res =
        item.kind === "player"
          ? await orgInterestAction(item.id, decision)
          : await playerInterestAction({ opportunityId: item.id }, decision);
      busy.current = false;
      if (!res.ok) {
        if (res.error !== "discover.alreadyActed") {
          push({ tone: "error", title: t(res.error) });
          setQueue((q) => [item, ...q]);
        }
        return;
      }
      if (decision === "pass") setLastPass({ item, interestId: res.data!.interestId });
      else setLastPass(null);
      if (res.data?.matched) {
        const other =
          item.kind === "player"
            ? { otherName: item.player.name, otherImage: item.player.photoUrl ?? null, otherId: item.id, profileHref: `/players/${item.id}` }
            : { otherName: item.opp.orgName, otherImage: item.opp.crestUrl ?? null, otherId: item.opp.orgId, profileHref: `/clubs/${item.opp.orgId}` };
        setMatch({ ...other, conversationId: res.data.conversationId });
      }
    },
    [push, t],
  );

  const undo = async () => {
    if (!lastPass) return;
    const res = await undoPassAction(lastPass.interestId);
    if (!res.ok) return push({ tone: "warning", title: t(res.error) });
    setQueue((q) => [lastPass.item, ...q]);
    setLastPass(null);
    haptic("light");
  };

  const favorite = async (item: DeckItem) => {
    const type = item.kind === "player" ? "player" : "opportunity";
    const res = await toggleFavoriteAction({ type, id: item.id });
    if (!res.ok) return push({ tone: "error", title: t(res.error) });
    setFavorites((s) => {
      const n = new Set(s);
      if (res.data?.favorite) n.add(item.id);
      else n.delete(item.id);
      return n;
    });
    if (res.data?.favorite) {
      setGlow(true);
      haptic("success");
      setTimeout(() => setGlow(false), 700);
      push({ tone: "success", title: t("discover.savedFavorite") });
    }
  };

  // Teclado: ← descartar, → me interesa, ↑ ficha
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (detail || match || !queue.length) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") topControls.current?.fling("pass");
      if (e.key === "ArrowRight") topControls.current?.fling("like");
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setDetail(queue[0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue, detail, match]);

  const top = queue[0];
  const visible = queue.slice(0, 3);

  return (
    <div className="flex flex-col">
      <div className="relative mx-auto aspect-[3/4.25] max-h-[calc(100dvh-300px)] min-h-[380px] w-full max-w-[440px]">
        {/* Halo de favorito */}
        <AnimatePresence>
          {glow ? (
            <motion.div
              className="pointer-events-none absolute -inset-3 z-0 rounded-[40px]"
              style={{ boxShadow: "0 0 60px 10px rgb(251 191 36 / 0.45)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          ) : null}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {visible
            .map((item, i) => (
              <SwipeCard
                key={item.id}
                item={item}
                depth={i}
                controlsRef={i === 0 ? topControls : undefined}
                onDecision={(d) => {
                  if (busy.current) return;
                  busy.current = true;
                  decide(item, d);
                }}
                onOpen={() => setDetail(item)}
              />
            ))
            .reverse()}
        </AnimatePresence>
        {!top ? (
          <div className="absolute inset-0 flex items-center">
            <EmptyState
              className="w-full"
              icon={<Compass className="size-7" />}
              title={t("discover.emptyTitle")}
              body={t("discover.emptyBody")}
              action={onOpenFilters ? <GlassButton onClick={onOpenFilters}><SlidersHorizontal className="size-4" /> {t("discover.adjustFilters")}</GlassButton> : null}
            />
          </div>
        ) : null}
      </div>

      {/* Botones flotantes circulares */}
      <div className="relative z-10 mt-5 flex items-center justify-center gap-3 sm:gap-4">
        <RoundAction label={t("discover.undo")} size="sm" disabled={!lastPass} onClick={undo}>
          <RotateCcw className="size-5" />
        </RoundAction>
        <RoundAction label={t("discover.pass")} size="lg" tone="red" disabled={!top} onClick={() => topControls.current?.fling("pass")}>
          <X className="size-8" strokeWidth={2.5} />
        </RoundAction>
        <RoundAction label={t("discover.favorite")} size="md" tone="amber" disabled={!top} active={top ? favorites.has(top.id) : false} onClick={() => top && favorite(top)}>
          <Star className={cn("size-6", top && favorites.has(top.id) && "fill-current")} />
        </RoundAction>
        <RoundAction label={t("discover.like")} size="lg" tone="green" disabled={!top} onClick={() => topControls.current?.fling("like")}>
          <Heart className="size-8 fill-current" />
        </RoundAction>
        <RoundAction label={t("discover.info")} size="sm" disabled={!top} onClick={() => top && setDetail(top)}>
          <Info className="size-5" />
        </RoundAction>
      </div>
      <p className="mt-3 hidden text-center text-xs text-ink-3 lg:block">{t("discover.keyboardHint")}</p>

      <GlassBottomSheet open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.kind === "player" ? detail.player.name : detail?.kind === "opportunity" ? detail.opp.title : ""}>
        {detail ? <DetailContent item={detail} onClose={() => setDetail(null)} /> : null}
      </GlassBottomSheet>
      <MatchOverlay data={match} onClose={() => setMatch(null)} />
    </div>
  );
}

function RoundAction({
  children, label, onClick, disabled, size = "md", tone = "neutral", active,
}: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; size?: "sm" | "md" | "lg"; tone?: "neutral" | "red" | "green" | "amber"; active?: boolean;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.86 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn(
        "glass glass-elevated relative flex items-center justify-center rounded-full disabled:opacity-40",
        size === "sm" && "size-12",
        size === "md" && "size-14",
        size === "lg" && "size-[72px]",
        tone === "red" && "text-danger",
        tone === "green" && "text-accent",
        tone === "amber" && "text-warn",
        tone === "neutral" && "text-ink-2",
        active && "shadow-[0_0_24px_rgb(251_191_36/0.55)]",
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "radial-gradient(70% 60% at 30% 20%, rgb(255 255 255 / 0.45), transparent 60%)" }} />
      <span className="relative">{children}</span>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Tarjeta con gestos táctiles reales (arrastre con el dedo)           */
/* ------------------------------------------------------------------ */
function SwipeCard({
  item, depth, onDecision, onOpen, controlsRef,
}: {
  item: DeckItem;
  depth: number;
  onDecision: (d: Decision) => void;
  onOpen: () => void;
  controlsRef?: React.RefObject<{ fling: (d: Decision) => void } | null>;
}) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-14, 0, 14]);
  const likeOpacity = useTransform(x, [20, SWIPE_X], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_X, -20], [1, 0]);
  const glowLike = useTransform(x, [0, SWIPE_X * 1.5], ["0 0 0 0 rgb(16 185 129 / 0)", "0 0 70px 6px rgb(16 185 129 / 0.55)"]);
  const isTop = depth === 0;
  const exitDir = React.useRef(0);

  const fling = React.useCallback(
    (d: Decision) => {
      exitDir.current = d === "like" ? 1 : -1;
      const w = typeof window !== "undefined" ? window.innerWidth : 800;
      if (reduce) {
        onDecision(d);
        return;
      }
      animate(x, exitDir.current * (w + 200), { duration: 0.32, ease: [0.32, 0.72, 0, 1] });
      animate(y, 40, { duration: 0.32 });
      setTimeout(() => onDecision(d), 180);
    },
    [x, y, onDecision, reduce],
  );

  React.useEffect(() => {
    if (controlsRef) controlsRef.current = { fling };
  }, [controlsRef, fling]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_X || info.velocity.x > SWIPE_V) return fling("like");
    if (info.offset.x < -SWIPE_X || info.velocity.x < -SWIPE_V) return fling("pass");
    if (info.offset.y < -120 && Math.abs(info.offset.x) < 60) onOpen();
    animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
    animate(y, 0, { type: "spring", stiffness: 500, damping: 30 });
  };

  return (
    <motion.div
      className={cn("absolute inset-0 touch-none", isTop ? "z-20 cursor-grab active:cursor-grabbing" : "z-10")}
      style={isTop ? { x, y, rotate } : undefined}
      drag={isTop}
      dragElastic={0.7}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={isTop ? onDragEnd : undefined}
      initial={{ scale: 0.9, y: 30, opacity: 0 }}
      animate={{ scale: 1 - depth * 0.045, y: depth * 16, opacity: depth > 1 ? 0.6 : 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      aria-hidden={!isTop}
    >
      <motion.div className="relative h-full w-full rounded-[32px]" style={isTop ? { boxShadow: glowLike } : undefined}>
        {item.kind === "player" ? <GlassProfileCard player={item.player} /> : <OpportunityDeckCard opp={item.opp} />}
        {isTop ? (
          <>
            <motion.div style={{ opacity: likeOpacity }} className="pointer-events-none absolute top-24 left-6 -rotate-12 rounded-2xl border-4 border-emerald-400 px-4 py-1.5">
              <span className="fm-display text-[34px] text-emerald-400">{t("discover.stampLike")}</span>
            </motion.div>
            <motion.div style={{ opacity: passOpacity }} className="pointer-events-none absolute top-24 right-6 rotate-12 rounded-2xl border-4 border-red-400 px-4 py-1.5">
              <span className="fm-display text-[34px] text-red-400">{t("discover.stampPass")}</span>
            </motion.div>
            <motion.div style={{ opacity: likeOpacity }} className="pointer-events-none absolute inset-0 rounded-[32px] bg-gradient-to-tr from-emerald-500/30 to-transparent" />
            <motion.div style={{ opacity: passOpacity }} className="pointer-events-none absolute inset-0 rounded-[32px] bg-gradient-to-tl from-red-500/25 to-transparent" />
          </>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

function OpportunityDeckCard({ opp }: { opp: OpportunityCardVM & { description?: string | null } }) {
  const { t, f, locale } = useI18n();
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[32px] text-white shadow-[var(--shadow-4)] select-none">
      <div className="fm-pitch absolute inset-0" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 50% at 50% 30%, rgb(52 211 153 / 0.35), transparent 70%)" }} />
      <div className="fm-photo-scrim absolute inset-0" />
      <div className="absolute top-4 right-4 left-4 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <GlassBadge tone="dark">{t(`football.opp.${opp.type}`)}</GlassBadge>
          {opp.isDemo ? <DemoBadge /> : null}
        </div>
        {opp.match ? <MatchPill score={opp.match.score} eligible={opp.match.eligible} /> : null}
      </div>
      <div className="absolute inset-x-0 top-[18%] flex flex-col items-center">
        <GlassAvatar src={opp.crestUrl} name={opp.orgName} seed={opp.orgId} size={112} square className="ring-4 ring-white/40 shadow-[0_20px_60px_rgb(0_0_0/0.45)]" />
        <p className="mt-3 text-[15px] font-semibold text-white/90">{opp.orgName}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 pb-6">
        <h2 className="fm-display text-[28px] uppercase sm:text-[32px]">{opp.title}</h2>
        {opp.category ? <p className="mt-1.5 text-[15px] text-white/85">{t(`football.cat.${opp.category}`)}</p> : null}
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] text-white/85">
          {opp.city || opp.country ? (
            <span className="glass glass-dark inline-flex items-center gap-1 rounded-full px-2.5 py-1">
              <MapPin className="size-3" /> {[opp.city, countryName(opp.country, INTL_LOCALE[locale])].filter(Boolean).join(" · ")}
            </span>
          ) : null}
          {opp.ageMin || opp.ageMax ? (
            <span className="glass glass-dark inline-flex items-center gap-1 rounded-full px-2.5 py-1">
              <Users className="size-3" /> {t("discover.ageRange", { min: opp.ageMin ?? "–", max: opp.ageMax ?? "–" })}
            </span>
          ) : null}
          {opp.deadline ? (
            <span className="glass glass-dark inline-flex items-center gap-1 rounded-full px-2.5 py-1">
              <CalendarDays className="size-3" /> {f.date(opp.deadline)}
            </span>
          ) : null}
          {opp.positions.slice(0, 3).map((p) => (
            <span key={p} className="glass glass-dark rounded-full px-2.5 py-1">{t(`football.pos.${p}`)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailContent({ item, onClose }: { item: DeckItem; onClose: () => void }) {
  const { t } = useI18n();
  const match = item.kind === "player" ? item.player.match : item.opp.match;
  const href = item.kind === "player" ? `/players/${item.id}` : `/opportunities/${item.id}`;
  return (
    <div className="flex flex-col gap-5 pb-2">
      {item.kind === "opportunity" && item.opp.description ? <p className="text-[15px] leading-relaxed text-ink-2">{item.opp.description}</p> : null}
      {item.kind === "player" ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            [t("profile.age"), item.player.age ?? "—"],
            [t("profile.height"), item.player.heightCm ? `${item.player.heightCm} cm` : "—"],
            [t("profile.foot"), item.player.foot ? t(`football.foot.${item.player.foot}`) : "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="glass glass-thin rounded-2xl p-3 text-center">
              <p className="text-[11px] font-semibold text-ink-3 uppercase">{k}</p>
              <p className="fm-number mt-0.5 text-lg">{v}</p>
            </div>
          ))}
        </div>
      ) : null}
      {match ? (
        <div className="glass glass-thin rounded-[24px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">{t("reasons.why")}</p>
            <MatchPill score={match.score} eligible={match.eligible} size="sm" />
          </div>
          <MatchReasons match={match} max={6} />
          <p className="mt-3 text-[11px] text-ink-3">{t("reasons.method")}</p>
        </div>
      ) : null}
      <Link href={href} onClick={onClose} className="glass glass-regular inline-flex h-12 items-center justify-center gap-2 rounded-full font-semibold">
        {item.kind === "player" ? t("discover.fullProfile") : t("discover.fullOpportunity")} <ArrowUpRight className="size-4" />
      </Link>
    </div>
  );
}
