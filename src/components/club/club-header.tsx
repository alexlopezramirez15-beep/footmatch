import { BadgeCheck, Globe, MapPin, Trophy } from "lucide-react";
import { DemoBadge, GlassBadge, GlassCard } from "@/components/glass/primitives";
import { countryName } from "@/domains/football/catalog";
import type { OrganizationRow } from "@/lib/types";
import type { TFunction } from "@/i18n";

export function ClubHeader({ org, t, intl, crest, actions }: { org: OrganizationRow; t: TFunction; intl: string; crest: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <GlassCard material="elevated" radius="xl" className="relative overflow-hidden">
      <div className="fm-pitch pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        {crest}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <GlassBadge tone="neutral">{t(`football.org.${org.type}`)}</GlassBadge>
            {org.verification_status === "verified" ? (
              <GlassBadge tone="blue" icon={<BadgeCheck className="size-3" />}>{t("common.verified")}</GlassBadge>
            ) : (
              <GlassBadge tone="neutral">{t(`home.verif.${org.verification_status}`)}</GlassBadge>
            )}
            {org.is_demo ? <DemoBadge /> : null}
          </div>
          <h1 className="fm-display mt-2 text-[30px] sm:text-[38px]">{org.name}</h1>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-ink-2">
            {org.city || org.country ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{[org.city, org.region, countryName(org.country, intl)].filter(Boolean).join(" · ")}</span> : null}
            {org.competition ? <span className="inline-flex items-center gap-1"><Trophy className="size-3.5" />{t(`football.cat.${org.competition}`)}</span> : null}
            {org.website ? <a href={org.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-ink"><Globe className="size-3.5" />{org.website.replace(/^https?:\/\//, "")}</a> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </GlassCard>
  );
}
