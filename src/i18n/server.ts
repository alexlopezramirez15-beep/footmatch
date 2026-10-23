import "server-only";
import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "./config";
import { buildMessages, createT, formatters } from "./index";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return negotiateLocale((await headers()).get("accept-language"));
}

export async function getI18n() {
  const locale = await getLocale();
  const messages = buildMessages(locale);
  return { locale, messages, t: createT(messages), f: formatters(locale) };
}
