"use client";

import { motion } from "motion/react";
import { fadeUp, stagger } from "@/components/glass/tokens";

/** Animación de entrada escalonada y discreta (respeta reduced-motion vía MotionConfig). */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}
