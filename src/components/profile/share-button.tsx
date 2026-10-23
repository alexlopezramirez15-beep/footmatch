"use client";

import { Share2 } from "lucide-react";
import { GlassButton } from "@/components/glass/primitives";
import { useToast } from "@/components/glass/overlays";
import { useI18n } from "@/i18n/client";

export function ShareButton({ path, title }: { path: string; title: string }) {
  const { t } = useI18n();
  const { push } = useToast();
  const share = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        push({ tone: "success", title: t("common.copied") });
      }
    } catch {
      /* el usuario canceló */
    }
  };
  return (
    <GlassButton variant="glass" size="icon" aria-label={t("common.share")} onClick={share}>
      <Share2 className="size-4" />
    </GlassButton>
  );
}
