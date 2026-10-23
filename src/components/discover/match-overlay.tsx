"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MessageCircle, X } from "lucide-react";
import { GlassAvatar } from "@/components/glass/primitives";
import { LogoMark } from "@/components/brand/logo";
import { useSelf } from "@/components/app/self-context";
import { useI18n } from "@/i18n/client";
import { haptic } from "@/lib/haptics";

export type MatchOverlayData = {
  otherName: string;
  otherImage: string | null;
  otherId: string;
  conversationId: string | null;
  profileHref?: string;
};

// Partículas con posiciones fijas (deterministas): sin parpadeos ni hidratación inestable.
const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const r = 120 + (i % 3) * 38;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r * 0.8, s: 3 + (i % 4), d: 0.15 + (i % 6) * 0.05 };
});

export function MatchOverlay({ data, onClose }: { data: MatchOverlayData | null; onClose: () => void }) {
  const { t } = useI18n();
  const self = useSelf();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!data) return;
    haptic("match");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data, onClose]);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {data ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="IT'S A FOOTMATCH!"
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden px-6 text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          {/* Fondo: iluminación ambiental oscura */}
          <div className="absolute inset-0 bg-[#05080c]/80 backdrop-blur-2xl" onClick={onClose} />
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(50% 40% at 50% 42%, rgb(52 211 153 / 0.35), transparent 70%), radial-gradient(60% 50% at 20% 90%, rgb(96 165 250 / 0.18), transparent 70%)" }} />

          <button onClick={onClose} aria-label={t("common.close")} className="glass glass-dark absolute top-[max(env(safe-area-inset-top),16px)] right-4 z-10 flex size-11 items-center justify-center rounded-full">
            <X className="size-5" />
          </button>

          <div className="relative z-10 flex w-full max-w-md flex-col items-center">
            <div className="relative flex h-56 w-full items-center justify-center">
              {/* Halo */}
              <motion.div
                className="absolute size-56 rounded-full"
                style={{ background: "radial-gradient(circle, rgb(52 211 153 / 0.55), transparent 65%)" }}
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: [0.2, 1.25, 1], opacity: [0, 1, 0.8] }}
                transition={{ duration: reduce ? 0 : 0.9, delay: 0.35, ease: "easeOut" }}
              />
              {!reduce &&
                PARTICLES.map((p, i) => (
                  <motion.span
                    key={i}
                    className="absolute rounded-full bg-white"
                    style={{ width: p.s, height: p.s, boxShadow: "0 0 10px rgb(52 211 153)" }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                    animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0, 1, 0.4] }}
                    transition={{ duration: 1.1, delay: 0.45 + p.d, ease: "easeOut" }}
                  />
                ))}
              <motion.div
                initial={reduce ? { opacity: 0 } : { x: -140, rotate: -14, opacity: 0 }}
                animate={{ x: -46, rotate: -6, opacity: 1 }}
                transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.1 }}
                className="absolute"
              >
                <GlassAvatar src={self?.avatarUrl} name={self?.name ?? "Yo"} seed={self?.id} size={124} className="ring-4 ring-white/80 shadow-[0_20px_60px_rgb(0_0_0/0.5)]" />
              </motion.div>
              <motion.div
                initial={reduce ? { opacity: 0 } : { x: 140, rotate: 14, opacity: 0 }}
                animate={{ x: 46, rotate: 6, opacity: 1 }}
                transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.18 }}
                className="absolute"
              >
                <GlassAvatar src={data.otherImage} name={data.otherName} seed={data.otherId} size={124} className="ring-4 ring-white/80 shadow-[0_20px_60px_rgb(0_0_0/0.5)]" />
              </motion.div>
              <motion.div
                className="glass glass-dark absolute bottom-0 flex size-14 items-center justify-center rounded-full"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.55 }}
              >
                <LogoMark size={30} variant="on-dark" />
              </motion.div>
            </div>

            <motion.div
              className="glass glass-dark mt-6 w-full rounded-[32px] px-6 py-7 text-center"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.4 }}
            >
              <h2 className="fm-display bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-[38px] text-transparent italic sm:text-[44px]">
                IT&apos;S A FOOTMATCH!
              </h2>
              <p className="mt-2 text-[15px] text-white/80">{t("match.subtitle")}</p>
              <p className="mt-1 text-[13px] text-white/60">{t("match.with", { name: data.otherName })}</p>
              <div className="mt-6 flex flex-col gap-2.5">
                {data.conversationId ? (
                  <Link href={`/chats/${data.conversationId}`} onClick={onClose} className="glass glass-tint-green inline-flex h-14 items-center justify-center gap-2 rounded-full text-[15px] font-bold tracking-wide uppercase shadow-[var(--shadow-glow)]">
                    <MessageCircle className="size-5" /> {t("match.sendMessage")}
                  </Link>
                ) : null}
                {data.profileHref ? (
                  <Link href={data.profileHref} onClick={onClose} className="glass glass-dark inline-flex h-12 items-center justify-center rounded-full text-[14px] font-semibold">
                    {t("match.viewProfile")}
                  </Link>
                ) : null}
                <button onClick={onClose} className="inline-flex h-12 items-center justify-center rounded-full text-[14px] font-semibold tracking-wide text-white/80 uppercase hover:text-white">
                  {t("match.keepDiscovering")}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
