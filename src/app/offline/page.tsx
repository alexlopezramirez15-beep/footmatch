import { WifiOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { EmptyState } from "@/components/glass/primitives";
import { getI18n } from "@/i18n/server";

export const metadata = { title: "Sin conexión" };

export default async function Offline() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4">
      <Logo size={30} />
      <EmptyState icon={<WifiOff className="size-7" />} title={t("common.offline")} body={t("app.offlineBody")} />
    </div>
  );
}
