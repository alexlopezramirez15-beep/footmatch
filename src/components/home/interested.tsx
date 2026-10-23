"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Building2, Users } from "lucide-react";
import { DemoBadge, EmptyState, GlassAvatar, GlassButton, GlassCard } from "@/components/glass/primitives";
import { useToast } from "@/components/glass/overlays";
import { MatchOverlay, type MatchOverlayData } from "@/components/discover/match-overlay";
import { useI18n } from "@/i18n/client";
import { orgInterestAction, playerInterestAction } from "@/domains/interests/actions";
import type { PlayerCardVM } from "@/components/cards/cards";

type OrgVM = { id: string; name: string; crestUrl: string | null; city: string | null; verified: boolean; isDemo: boolean };

export function InterestedOrgs({ orgs }: { orgs: OrgVM[] }) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [match, setMatch] = React.useState<MatchOverlayData | null>(null);
  if (!orgs.length) return <EmptyState icon={<Building2 className="size-7" />} title={t("home.noInterested")} body={t("home.noInterestedBody")} />;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {orgs.map((o) => (
          <GlassCard key={o.id} material="regular" className="flex items-center gap-3 p-4">
            <GlassAvatar src={o.crestUrl} name={o.name} seed={o.id} size={48} square ring />
            <Link href={`/clubs/${o.id}`} className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate font-semibold">
                {o.name} {o.verified ? <BadgeCheck className="size-4 shrink-0 text-info" /> : null}
              </p>
              <p className="truncate text-[13px] text-ink-2">{o.city}</p>
            </Link>
            {o.isDemo ? <DemoBadge /> : null}
            <GlassButton
              size="sm"
              variant="primary"
              loading={pending === o.id}
              onClick={async () => {
                setPending(o.id);
                const res = await playerInterestAction({ organizationId: o.id }, "like");
                setPending(null);
                if (!res.ok) return push({ tone: "error", title: t(res.error) });
                if (res.data?.matched) setMatch({ otherName: o.name, otherImage: o.crestUrl, otherId: o.id, conversationId: res.data.conversationId });
                else router.refresh();
              }}
            >
              {t("home.interestBack")}
            </GlassButton>
          </GlassCard>
        ))}
      </div>
      <MatchOverlay data={match} onClose={() => { setMatch(null); router.refresh(); }} />
    </>
  );
}

export function InterestedPlayers({ players }: { players: PlayerCardVM[] }) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [match, setMatch] = React.useState<MatchOverlayData | null>(null);
  if (!players.length) return <EmptyState icon={<Users className="size-7" />} title={t("home.noInterestedPlayers")} body={t("home.noInterestedPlayersBody")} />;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {players.map((p) => (
          <GlassCard key={p.id} material="regular" className="flex items-center gap-3 p-4">
            <GlassAvatar src={p.photoUrl} name={p.name} seed={p.id} size={48} ring />
            <Link href={`/players/${p.id}`} className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="truncate text-[13px] text-ink-2">
                {p.age != null ? `${t("common.years", { n: p.age })} · ` : ""}{t(`football.pos.${p.position}`)}
              </p>
            </Link>
            {p.isDemo ? <DemoBadge /> : null}
            <GlassButton
              size="sm"
              variant="primary"
              loading={pending === p.id}
              onClick={async () => {
                setPending(p.id);
                const res = await orgInterestAction(p.id, "like");
                setPending(null);
                if (!res.ok) return push({ tone: "error", title: t(res.error) });
                if (res.data?.matched) setMatch({ otherName: p.name, otherImage: p.photoUrl ?? null, otherId: p.id, conversationId: res.data.conversationId });
                else router.refresh();
              }}
            >
              {t("home.interestBack")}
            </GlassButton>
          </GlassCard>
        ))}
      </div>
      <MatchOverlay data={match} onClose={() => { setMatch(null); router.refresh(); }} />
    </>
  );
}
