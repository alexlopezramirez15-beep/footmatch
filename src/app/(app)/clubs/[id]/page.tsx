import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassBadge, GlassCard, SectionHeader } from "@/components/glass/primitives";
import { Crest, GlassOpportunityCard } from "@/components/cards/cards";
import { ClubHeader } from "@/components/club/club-header";
import { ClubPlayerActions } from "@/components/club/club-actions";
import { SafetyMenu } from "@/components/profile/safety";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import { publicAssetUrl } from "@/lib/media";
import { flattenOpp, toOpportunityVM } from "@/domains/opportunities/queries";
import type { DiscoverOpportunityRow, OrganizationRow } from "@/lib/types";

export default async function ClubPage(props: PageProps<"/clubs/[id]">) {
  const { id } = await props.params;
  const session = await requireApp();
  const sp = await props.searchParams;
  if (!sp.preview && session.activeOrg?.organization.id === id) redirect("/club");
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const intl = INTL_LOCALE[locale];
  const { data } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const org = data as OrganizationRow;
  const isPlayer = appMode(session) === "player";

  const [teams, opps, liked, fav, conv] = await Promise.all([
    supabase.from("team_profiles").select("id, name, category, competition").eq("organization_id", id).order("name"),
    supabase.from("opportunities").select("*, organization:organizations(id, name, crest_path, verification_status, type)").eq("organization_id", id).eq("status", "open").order("created_at", { ascending: false }),
    isPlayer ? supabase.from("interests").select("id").eq("actor_id", session.userId).eq("target_org_id", id).neq("kind", "pass").limit(1) : Promise.resolve({ data: [] }),
    supabase.from("favorites").select("id").eq("user_id", session.userId).eq("target_org_id", id).maybeSingle(),
    isPlayer ? supabase.from("conversations").select("id").eq("organization_id", id).eq("player_id", session.userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const crestUrl = publicAssetUrl(org.crest_path);
  const oppVMs = ((opps.data ?? []) as Parameters<typeof flattenOpp>[0][]).map((o) => toOpportunityVM(flattenOpp(o) as DiscoverOpportunityRow, null));

  return (
    <div className="fm-safe-top pt-3 pb-6">
      <Link href="/home" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /> {t("common.back")}</Link>
      <ClubHeader
        org={org}
        t={t}
        intl={intl}
        crest={<Crest url={crestUrl} name={org.name} id={org.id} size={84} />}
        actions={
          <>
            <ClubPlayerActions
              org={{ id: org.id, name: org.name, crestUrl }}
              state={{ liked: Boolean(liked.data?.length), favorite: Boolean(fav.data), conversationId: (conv.data as { id: string } | null)?.id ?? null, canInteract: isPlayer && (!session.isMinor || session.guardianApproved) }}
            />
            <SafetyMenu target={{ type: "organization", id: org.id }} />
          </>
        }
      />
      <div className="mt-6 flex flex-col gap-6">
        {org.description ? (
          <section>
            <SectionHeader title={t("club.about")} />
            <GlassCard material="regular"><p className="whitespace-pre-line text-[15px] leading-relaxed">{org.description}</p></GlassCard>
          </section>
        ) : null}
        {org.facilities ? (
          <section>
            <SectionHeader title={t("club.facilities")} />
            <GlassCard material="regular"><p className="whitespace-pre-line text-[15px]">{org.facilities}</p></GlassCard>
          </section>
        ) : null}
        {(teams.data ?? []).length ? (
          <section>
            <SectionHeader title={t("club.teams")} />
            <div className="flex flex-wrap gap-2">
              {(teams.data ?? []).map((tm) => (
                <GlassBadge key={tm.id} tone="neutral" className="h-9 px-4 text-sm">{tm.name}{tm.category ? ` · ${t(`football.cat.${tm.category}`)}` : ""}</GlassBadge>
              ))}
            </div>
          </section>
        ) : null}
        <section>
          <SectionHeader title={t("club.openOpportunities")} />
          {oppVMs.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {oppVMs.map((o) => <GlassOpportunityCard key={o.id} opp={o} href={`/opportunities/${o.id}`} />)}
            </div>
          ) : (
            <p className="px-1 text-sm text-ink-2">{t("club.noOpenOpportunities")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
