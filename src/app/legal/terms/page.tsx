import { LegalDoc } from "@/components/landing/legal-doc";
import { TERMS } from "@/domains/legal/texts";
import { getI18n } from "@/i18n/server";

export const metadata = { title: "Términos de uso" };

export default async function Page() {
  const { locale, t } = await getI18n();
  const doc = locale === "en" ? TERMS.en : TERMS.es;
  return <LegalDoc doc={doc} notice={locale === "ca" || locale === "pl" ? t("legal.onlyEs") : null} />;
}
