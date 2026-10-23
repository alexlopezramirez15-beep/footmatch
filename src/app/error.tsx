"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { EmptyState, GlassButton } from "@/components/glass/primitives";
import { useI18n } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4">
      <EmptyState icon={<AlertTriangle className="size-7" />} title={t("common.error")} body={t("common.errorBody")} action={<GlassButton onClick={reset}>{t("common.retry")}</GlassButton>} />
      {error.digest ? <p className="mt-3 text-xs text-ink-3">ref: {error.digest}</p> : null}
    </div>
  );
}
