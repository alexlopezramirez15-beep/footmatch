"use client";

import * as React from "react";
import type { Locale } from "./config";
import { createT, formatters, type Messages, type TFunction } from "./index";

type Ctx = { locale: Locale; t: TFunction; f: ReturnType<typeof formatters> };
const I18nCtx = React.createContext<Ctx | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ locale, t: createT(messages), f: formatters(locale) }), [locale, messages]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const ctx = React.useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n fuera de I18nProvider");
  return ctx;
}
