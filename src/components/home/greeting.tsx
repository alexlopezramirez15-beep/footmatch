"use client";

import * as React from "react";
import { useI18n } from "@/i18n/client";

/** Saludo según la hora local del dispositivo. */
export function Greeting({ name }: { name: string }) {
  const { t } = useI18n();
  const [key, setKey] = React.useState<"morning" | "afternoon" | "evening">("morning");
  React.useEffect(() => {
    const h = new Date().getHours();
    setKey(h < 6 ? "evening" : h < 13 ? "morning" : h < 20 ? "afternoon" : "evening");
  }, []);
  return <span suppressHydrationWarning>{t(`home.greet.${key}`, { name })}</span>;
}
