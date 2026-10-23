"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Crest } from "@/components/cards/cards";
import { useToast } from "@/components/glass/overlays";
import { useI18n } from "@/i18n/client";
import { getBrowserClient } from "@/lib/supabase/client";
import { optimizeImage } from "@/lib/image";
import { setCrestAction } from "@/domains/organizations/actions";

export function CrestUploader({ orgId, name, url, editable }: { orgId: string; name: string; url: string | null; editable: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const input = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState(url);
  const [busy, setBusy] = React.useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return push({ tone: "error", title: t("club.crestInvalid") });
    setBusy(true);
    try {
      const blob = await optimizeImage(file, 512);
      const path = `${orgId}/crest-${Date.now()}.webp`;
      const { error } = await getBrowserClient().storage.from("public-assets").upload(path, blob, { contentType: "image/webp", upsert: false });
      if (error) throw error;
      const res = await setCrestAction(orgId, path);
      if (!res.ok) throw new Error(res.error);
      setPreview(URL.createObjectURL(blob));
      push({ tone: "success", title: t("club.crestSaved") });
      router.refresh();
    } catch {
      push({ tone: "error", title: t("common.error"), body: t("common.errorBody") });
    } finally {
      setBusy(false);
    }
  };

  if (!editable) return <Crest url={preview} name={name} id={orgId} size={84} />;
  return (
    <button type="button" onClick={() => input.current?.click()} aria-label={t("club.changeCrest")} className="group relative shrink-0 rounded-[26px]" aria-busy={busy}>
      <Crest url={preview} name={name} id={orgId} size={84} />
      <span className="glass glass-elevated absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full">
        <Camera className={busy ? "size-4 animate-pulse" : "size-4"} />
      </span>
      <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
    </button>
  );
}
