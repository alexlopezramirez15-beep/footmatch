import { LegalDoc } from "@/components/landing/legal-doc";
import { PRIVACY } from "@/domains/legal/texts";
import { getI18n } from "@/i18n/server";

export const metadata = { title: "Política de privacidad" };

export default async function Page() {
  const { locale, t } = await getI18n();
  const doc = locale === "en" ? PRIVACY.en : PRIVACY.es;
  return <LegalDoc doc={doc} notice={locale === "ca" || locale === "pl" ? t("legal.onlyEs") : null} />;
}
