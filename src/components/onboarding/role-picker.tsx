"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Binoculars, Briefcase, GraduationCap, Shield, Shirt, Whistle, Check } from "lucide-react";
import { GlassButton } from "@/components/glass/primitives";
import { stagger, fadeUp } from "@/components/glass/tokens";
import { useI18n } from "@/i18n/client";
import { chooseRoleAction } from "@/domains/onboarding/actions";
import type { AppRole } from "@/lib/types";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

const ROLES: Array<{ role: AppRole; icon: React.ReactNode }> = [
  { role: "player", icon: <Shirt className="size-6" /> },
  { role: "club", icon: <Shield className="size-6" /> },
  { role: "coach", icon: <Whistle className="size-6" /> },
  { role: "agent", icon: <Briefcase className="size-6" /> },
  { role: "scout", icon: <Binoculars className="size-6" /> },
  { role: "academy", icon: <GraduationCap className="size-6" /> },
];

export function RolePicker() {
  const { t } = useI18n();
  const [selected, setSelected] = React.useState<AppRole | null>(null);
  const [pending, start] = React.useTransition();

  return (
    <div>
      <motion.h1 variants={fadeUp} initial="hidden" animate="show" className="fm-display text-[34px] text-balance sm:text-[42px]">
        {t("onboarding.roleTitle")}
      </motion.h1>
      <p className="mt-3 text-[15px] text-ink-2">{t("onboarding.roleSubtitle")}</p>

      <motion.div variants={stagger} initial="hidden" animate="show" role="radiogroup" className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLES.map(({ role, icon }) => {
          const active = selected === role;
          const later = role === "scout";
          return (
            <motion.button
              key={role}
              variants={fadeUp}
              type="button"
              role="radio"
              aria-checked={active}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                haptic("light");
                setSelected(role);
              }}
              className={cn(
                "glass relative flex items-start gap-4 rounded-[var(--radius-lg)] p-5 text-left transition-shadow",
                active ? "glass-elevated shadow-[var(--shadow-glow)]" : "glass-regular",
              )}
            >
              <span className={cn("glass flex size-12 shrink-0 items-center justify-center rounded-[18px]", active ? "glass-tint-green" : "glass-thin text-accent-strong dark:text-accent")}>
                {icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[17px] font-semibold">
                  {t(`football.role.${role}`)}
                  {later ? <span className="text-[11px] font-medium text-ink-3">· {t("onboarding.phase2")}</span> : null}
                </span>
                <span className="mt-1 block text-sm text-ink-2">{t(`onboarding.role.${role}.desc`)}</span>
              </span>
              <motion.span
                initial={false}
                animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
                className="absolute top-4 right-4 flex size-6 items-center justify-center rounded-full bg-accent text-accent-contrast"
              >
                <Check className="size-3.5" strokeWidth={3} />
              </motion.span>
            </motion.button>
          );
        })}
      </motion.div>

      <div className="sticky bottom-0 mt-8 pb-[max(env(safe-area-inset-bottom),12px)]">
        <GlassButton
          variant="primary"
          size="lg"
          className="w-full justify-center"
          disabled={!selected}
          loading={pending}
          onClick={() => selected && start(() => chooseRoleAction(selected).then(() => undefined))}
        >
          {t("onboarding.start")}
        </GlassButton>
      </div>
    </div>
  );
}
