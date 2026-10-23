import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { EmptyState, GlassButton } from "@/components/glass/primitives";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4">
      <Logo size={30} />
      <EmptyState icon={<Compass className="size-7" />} title={t("common.notFound")} body={t("common.notFoundBody")} action={<Link href="/home"><GlassButton>{t("common.goHome")}</GlassButton></Link>} />
    </div>
  );
}
