"use client";

import { useRouter } from "next/navigation";
import { GlassSelect } from "@/components/glass/forms";
import { useToast } from "@/components/glass/overlays";
import { useI18n } from "@/i18n/client";
import { switchOrgAction } from "@/domains/organizations/actions";

export function OrgSwitcher({ current, orgs }: { current: string; orgs: Array<{ id: string; name: string }> }) {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  if (orgs.length < 2) return null;
  return (
    <GlassSelect
      aria-label={t("club.switchOrg")}
      value={current}
      onChange={async (e) => {
        const res = await switchOrgAction(e.target.value);
        if (!res.ok) return push({ tone: "error", title: t(res.error) });
        router.refresh();
      }}
    >
      {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </GlassSelect>
  );
}
