import { TriangleAlert } from "lucide-react";
import { getI18n } from "@/i18n/server";

export async function SetupNotice() {
  const { t } = await getI18n();
  return (
    <div role="status" className="glass glass-tint-amber mb-4 flex gap-3 rounded-[22px] p-4 text-sm">
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn" />
      <div>
        <p className="font-semibold">{t("common.setupTitle")}</p>
        <p className="mt-0.5 text-ink-2">{t("common.setupBody")}</p>
      </div>
    </div>
  );
}
