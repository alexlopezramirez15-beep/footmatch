import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "./config";
import { interpolate } from "./define";
import { registry } from "./registry";

export type Messages = Record<string, string>;
type Registry = typeof registry;
export type MessageKey = {
  [N in keyof Registry]: `${N & string}.${keyof Registry[N]["es"] & string}`;
}[keyof Registry];

const cache = new Map<Locale, Messages>();

/** Aplana todos los namespaces ("ns.key") con el español como respaldo. */
export function buildMessages(locale: Locale): Messages {
  const hit = cache.get(locale);
  if (hit) return hit;
  const out: Messages = {};
  for (const [ns, m] of Object.entries(registry)) {
    const base = m.es as Record<string, string>;
    const loc = (m as Record<string, Record<string, string | undefined>>)[locale] ?? {};
    for (const k of Object.keys(base)) out[`${ns}.${k}`] = loc[k] ?? base[k];
  }
  cache.set(locale, out);
  return out;
}

export type TFunction = (key: MessageKey | (string & {}), vars?: Record<string, string | number | null | undefined>) => string;

export function createT(messages: Messages): TFunction {
  return (key, vars) => interpolate(messages[key] ?? key, vars);
}

export function formatters(locale: Locale = DEFAULT_LOCALE) {
  const l = INTL_LOCALE[locale];
  return {
    date: (d: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
      new Intl.DateTimeFormat(l, opts).format(new Date(d)),
    time: (d: string | Date) => new Intl.DateTimeFormat(l, { hour: "2-digit", minute: "2-digit" }).format(new Date(d)),
    relative: (d: string | Date) => {
      const diff = (new Date(d).getTime() - Date.now()) / 1000;
      const rtf = new Intl.RelativeTimeFormat(l, { numeric: "auto" });
      const abs = Math.abs(diff);
      if (abs < 60) return rtf.format(Math.round(diff), "second");
      if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
      if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
      if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
      return new Intl.DateTimeFormat(l, { day: "numeric", month: "short" }).format(new Date(d));
    },
    number: (n: number) => new Intl.NumberFormat(l).format(n),
  };
}
