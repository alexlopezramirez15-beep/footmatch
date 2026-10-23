import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { GlassCard } from "@/components/glass/primitives";
import { PlayerProfile } from "@/components/profile/player-profile";
import { PlayerOrgActions } from "@/components/profile/player-actions";
import { SafetyMenu } from "@/components/profile/safety";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import { computeMatch } from "@/domains/matching/engine";
import { loadWeights, organizationToSpec, playerToFacts } from "@/domains/matching/adapters";
import { loadPlayerProfile } from "@/domains/profile/queries";
import type { PlayerCardRow } from "@/lib/types";


export default async function PlayerPage(props: PageProps<"/players/[id]">) {
  const { id } = await props.params;
  const session = await requireApp();
  if (id === session.userId) redirect("/profile");
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const { data } = await supabase.from("player_cards").select("*").eq("user_id", id).maybeSingle();
  if (!data) notFound();
  const card = data as PlayerCardRow;
  const p = await loadPlayerProfile(supabase, card);
  const org = appMode(session) === "organization" ? session.activeOrg?.organization ?? null : null;

  let match = null;
  let actions: React.ReactNode = null;
  if (org) {
    const weights = await loadWeights(supabase);
    match = computeMatch(playerToFacts(card), organizationToSpec(org), weights.weights, weights.enabled);
    const [{ data: int }, { data: fav }, { data: conv }] = await Promise.all([
      supabase.from("interests").select("kind").eq("actor_org_id", org.id).eq("target_user_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("favorites").select("id").eq("user_id", session.userId).eq("target_user_id", id).maybeSingle(),
      supabase.from("conversations").select("id").eq("organization_id", org.id).eq("player_id", id).maybeSingle(),
    ]);
    actions = (
      <>
        <PlayerOrgActions
          player={{ id, name: p.name, photoUrl: p.photoUrl }}
          state={{ interest: (int?.kind as "like" | "pass" | "superlike" | undefined) ?? null, favorite: Boolean(fav), conversationId: conv?.id ?? null }}
        />
        <SafetyMenu target={{ type: "user", id }} blockUserId={id} afterBlock="/discover" />
      </>
    );
  } else {
    actions = <SafetyMenu target={{ type: "user", id }} blockUserId={id} />;
  }

  return (
    <div className="fm-safe-top pt-3 pb-6">
      <Link href={org ? "/discover" : "/home"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" /> {t("common.back")}
      </Link>
      <PlayerProfile
        p={p}
        t={t}
        intl={INTL_LOCALE[locale]}
        match={match}
        actions={actions}
        banner={
          card.is_minor ? (
            <GlassCard material="tint-amber" className="flex items-start gap-3 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0 text-warn" />
              <p>{t("profile.minorBanner")}</p>
            </GlassCard>
          ) : null
        }
      />
    </div>
  );
}
