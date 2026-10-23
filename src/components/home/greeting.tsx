"use client";

import * as React from "react";
import { useI18n } from "@/i18n/client";

type Part = "morning" | "afternoon" | "evening";
const noopSubscribe = () => () => {};
const partOfDay = (): Part => {
  const h = new Date().getHours();
  return h < 6 ? "evening" : h < 13 ? "morning" : h < 20 ? "afternoon" : "evening";
};

/** Saludo según la hora local del dispositivo (en servidor, "buenos días" hasta hidratar). */
export function Greeting({ name }: { name: string }) {
  const { t } = useI18n();
  const key = React.useSyncExternalStore(noopSubscribe, partOfDay, () => "morning" as Part);
  return <span suppressHydrationWarning>{t(`home.greet.${key}`, { name })}</span>;
}
