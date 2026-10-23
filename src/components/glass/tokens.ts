// Footmatch Glass UI · tokens de movimiento compartidos por todos los componentes.
import type { Transition, Variants } from "motion/react";

export const springPress: Transition = { type: "spring", stiffness: 520, damping: 30, mass: 0.6 };
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 28 };
export const springSheet: Transition = { type: "spring", stiffness: 340, damping: 34 };
export const easeOut = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.42, ease: easeOut } },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const materials = ["ultra-thin", "thin", "regular", "elevated", "dark", "tint-green", "tint-blue", "tint-amber", "tint-red", "solid"] as const;
export type Material = (typeof materials)[number];

export function materialClass(m: Material): string {
  return m === "solid" ? "surface-solid" : `glass glass-${m}`;
}
