"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, MessageCircle, Star } from "lucide-react";
import { GlassButton } from "@/components/glass/primitives";
import { useToast } from "@/components/glass/overlays";
import { MatchOverlay, type MatchOverlayData } from "@/components/discover/match-overlay";
import { useI18n } from "@/i18n/client";
import { haptic } from "@/lib/haptics";
import { playerInterestAction, toggleFavoriteAction } from "@/domains/interests/actions";

export function ClubPlayerActions({ org, state }: { org: { id: string; name: string; crestUrl: string | null }; state: { liked: boolean; favorite: boolean; conversationId: string | null; canInteract: boolean } }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [liked, setLiked] = React.useState(state.liked);
  const [fav, setFav] = React.useState(state.favorite);
  const [match, setMatch] = React.useState<MatchOverlayData | null>(null);
  const [pending, start] = React.useTransition();
  const like = () =>
    start(async () => {
      const res = await playerInterestAction({ organizationId: org.id }, "like");
      if (!res.ok && res.error !== "discover.alreadyActed") return push({ tone: "error", title: t(res.error) });
      setLiked(true);
      haptic("success");
      if (res.ok && res.data?.matched) setMatch({ otherName: org.name, otherImage: org.crestUrl, otherId: org.id, conversationId: res.data.conversationId, profileHref: `/clubs/${org.id}` });
    });
  const toggleFav = () =>
    start(async () => {
      const res = await toggleFavoriteAction({ type: "organization", id: org.id });
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      setFav(Boolean(res.data?.favorite));
    });
  return (
    <>
      {state.conversationId ? (
        <Link href={`/chats/${state.conversationId}`}><GlassButton><MessageCircle className="size-4" /> {t("match.sendMessage")}</GlassButton></Link>
      ) : state.canInteract ? (
        <GlassButton variant={liked ? "glass" : "primary"} disabled={liked} loading={pending} onClick={like}>
          <Heart className={liked ? "size-4 fill-current text-accent" : "size-4"} /> {liked ? t("profile.interestSent") : t("club.interested")}
        </GlassButton>
      ) : null}
      <GlassButton variant="glass" size="icon" aria-label={t("discover.favorite")} aria-pressed={fav} onClick={toggleFav}>
        <Star className={fav ? "size-5 fill-current text-warn" : "size-5"} />
      </GlassButton>
      <MatchOverlay data={match} onClose={() => setMatch(null)} />
    </>
  );
}
