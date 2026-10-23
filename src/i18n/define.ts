import type { Locale } from "./config";

export type Flat = Record<string, string>;
export type NamespaceMessages<T extends Flat> = { es: T } & { [L in Exclude<Locale, "es">]: Partial<Record<keyof T, string>> };

/** Define un namespace: el español es la referencia y el resto de idiomas se valida contra él. */
export function defineMessages<T extends Flat>(m: NamespaceMessages<T>) {
  return m;
}

export function interpolate(s: string, vars?: Record<string, string | number | null | undefined>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "").toString());
}
