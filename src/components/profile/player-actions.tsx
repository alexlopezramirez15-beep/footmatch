"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Star, X } from "lucide-react";
import { GlassButton } from "@/components/glass/primitives";
import { useToast } from "@/components/glass/overlays";
import { MatchOverlay, type MatchOverlayData } from "@/components/discover/match-overlay";
import { useI18n } from "@/i18n/client";
import { haptic } from "@/lib/haptics";
import { orgInterestAction, toggleFavoriteAction } from "@/domains/interests/actions";

export function PlayerOrgActions({
  player,
  state,
}: {
  player: { id: string; name: string; photoUrl: string | null };
  state: { interest: "like" | "pass" | "superlike" | null; favorite: boolean; conversationId: string | null };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [interest, setInterest] = React.useState(state.interest);
  const [fav, setFav] = React.useState(state.favorite);
  const [match, setMatch] = React.useState<MatchOverlayData | null>(null);
  const [pending, start] = React.useTransition();

  const act = (kind: "like" | "pass") =>
    start(async () => {
      const res = await orgInterestAction(player.id, kind);
      if (!res.ok) return push({ tone: res.error === "discover.alreadyActed" ? "info" : "error", title: t(res.error) });
      setInterest(kind);
      haptic(kind === "like" ? "success" : "light");
      if (res.data?.matched) setMatch({ otherName: player.name, otherImage: player.photoUrl, otherId: player.id, conversationId: res.data.conversationId, profileHref: `/players/${player.id}` });
      else router.refresh();
    });

  const toggleFav = () =>
    start(async () => {
      const res = await toggleFavoriteAction({ type: "player", id: player.id });
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      setFav(Boolean(res.data?.favorite));
      haptic("light");
    });

  return (
    <>
      {state.conversationId ? (
        <Link href={`/chats/${state.conversationId}`} className="flex-1 sm:flex-none">
          <GlassButton className="w-full"><MessageCircle className="size-4" /> {t("match.sendMessage")}</GlassButton>
        </Link>
      ) : interest === "like" || interest === "superlike" ? (
        <GlassButton variant="glass" disabled className="flex-1 sm:flex-none"><Heart className="size-4 fill-current text-accent" /> {t("profile.interestSent")}</GlassButton>
      ) : (
        <>
          <GlassButton variant="glass" size="icon" aria-label={t("discover.pass")} disabled={pending || interest === "pass"} onClick={() => act("pass")}><X className="size-5" /></GlassButton>
          <GlassButton className="flex-1 sm:flex-none" loading={pending} onClick={() => act("like")}><Heart className="size-4" /> {t("profile.showInterest")}</GlassButton>
        </>
      )}
      <GlassButton variant="glass" size="icon" aria-label={t("discover.favorite")} aria-pressed={fav} onClick={toggleFav}>
        <Star className={fav ? "size-5 fill-current text-warn" : "size-5"} />
      </GlassButton>
      <MatchOverlay data={match} onClose={() => { setMatch(null); router.refresh(); }} />
    </>
  );
}
