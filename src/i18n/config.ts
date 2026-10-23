export const LOCALES = ["es", "ca", "en", "pl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "fm_locale";
export const LOCALE_LABELS: Record<Locale, string> = { es: "Español", ca: "Català", en: "English", pl: "Polski" };
export const INTL_LOCALE: Record<Locale, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", pl: "pl-PL" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Elige idioma a partir de Accept-Language. */
export function negotiateLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const code = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}
