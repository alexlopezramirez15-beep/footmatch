"use client";

import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LOCALES } from "@/i18n/config";
import { setLocaleAction } from "@/domains/settings/actions";

export function LocaleSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  return (
    <label className="glass glass-thin inline-flex h-9 items-center gap-1.5 rounded-full pr-2 pl-3 text-sm">
      <Globe className="size-4 text-ink-2" aria-hidden />
      <span className="sr-only">{t("settings.language")}</span>
      <select value={locale} onChange={async (e) => { await setLocaleAction(e.target.value); router.refresh(); }} className="bg-transparent font-medium uppercase outline-none">
        {LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
      </select>
    </label>
  );
}
