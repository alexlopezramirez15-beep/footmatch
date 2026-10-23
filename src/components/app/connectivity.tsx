"use client";

import * as React from "react";
import { useToast } from "@/components/glass/overlays";
import { useI18n } from "@/i18n/client";

/** Gestión de conectividad (PWA) + registro del service worker. */
export function ConnectivityWatcher() {
  const { push } = useToast();
  const { t } = useI18n();
  React.useEffect(() => {
    const off = () => push({ tone: "warning", title: t("common.offline") });
    const on = () => push({ tone: "success", title: t("common.backOnline") });
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, [push, t]);
  return null;
}
