"use client";

import { motion, useReducedMotion } from "motion/react";
import { Heart, MapPin, X } from "lucide-react";
import { useI18n } from "@/i18n/client";

/** Ilustración de la interfaz (ejemplo ilustrativo, sin datos de personas reales). */
export function HeroVisual() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto h-[460px] w-full max-w-[340px]" aria-hidden>
      <motion.div
        className="glass glass-thin absolute inset-x-6 top-6 h-[380px] rounded-[34px]"
        initial={reduce ? false : { rotate: -8, opacity: 0 }}
        animate={{ rotate: -6, opacity: 0.7 }}
        transition={{ duration: 0.8, delay: 0.1 }}
      />
      <motion.div
        className="glass glass-elevated absolute inset-x-0 top-0 h-[400px] overflow-hidden rounded-[34px]"
        initial={reduce ? false : { y: 30, opacity: 0, rotate: 3 }}
        animate={{ y: 0, opacity: 1, rotate: 2 }}
        transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.2 }}
      >
        <div className="fm-pitch absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/40 via-sky-500/20 to-transparent" />
        <div className="absolute top-4 left-4 rounded-full border border-dashed border-white/60 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white">{t("landing.example")}</div>
        <div className="absolute top-4 right-4 rounded-full bg-black/35 px-3 py-1.5 text-sm font-bold text-white backdrop-blur-md">87%</div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16 text-white">
          <p className="text-[12px] font-semibold tracking-wider text-white/75 uppercase">{t("football.pos.CM")}</p>
          <p className="fm-display text-[30px]">{t("landing.examplePlayer")}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-white/80"><MapPin className="size-3.5" /> {t("landing.exampleCity")}</p>
        </div>
      </motion.div>
      <div className="absolute inset-x-0 -bottom-1 flex justify-center gap-5">
        <motion.span whileHover={{ scale: 1.08 }} className="glass glass-elevated flex size-16 items-center justify-center rounded-full text-red-400"><X className="size-7" /></motion.span>
        <motion.span whileHover={{ scale: 1.08 }} className="flex size-16 items-center justify-center rounded-full bg-accent text-white shadow-[var(--shadow-glow)]"><Heart className="size-7 fill-current" /></motion.span>
      </div>
    </div>
  );
}
