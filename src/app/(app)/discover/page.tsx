import Link from "next/link";
import { Compass, UserRound } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { EmptyState, GlassButton } from "@/components/glass/primitives";
import { DiscoverView } from "@/components/discover/discover-view";
import type { DeckItem } from "@/components/discover/deck";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { filterOpportunities, filterPlayers, parseFilters } from "@/domains/discover/filters";
import { rankedOpportunitiesForPlayer, rankedPlayersForOrg, requirementsByOpportunity, selfAsCard, toOpportunityVM, toPlayerVMs } from "@/domains/opportunities/queries";
import type { DiscoverOpportunityRow } from "@/lib/types";

export const metadata = { title: "Descubrir" };

export default async function DiscoverPage(props: PageProps<"/discover">) {
  const session = await requireApp();
  const sp = await props.searchParams;
  const mode = appMode(session);
  const { t } = await getI18n();
  const supabase = await createClient();

  if (mode === "professional") {
    return (
      <>
        <GlassNavbar title={t("nav.discover")} />
        <EmptyState
          icon={<Compass className="size-7" />}
          title={t("discover.proTitle")}
          body={t("discover.proBody")}
          action={<Link href="/opportunities"><GlassButton>{t("discover.proCta")}</GlassButton></Link>}
        />
      </>
    );
  }

  const { data: prefs } = await supabase.from("discover_preferences").select("filters").eq("user_id", session.userId).maybeSingle();
  const filters = parseFilters(prefs?.filters);

  if (mode === "player") {
    if (!session.player) {
      return (
        <>
          <GlassNavbar title={t("nav.discover")} />
          <EmptyState icon={<UserRound className="size-7" />} title={t("discover.needPlayerProfile")} action={<Link href="/onboarding/player"><GlassButton>{t("discover.completeProfile")}</GlassButton></Link>} />
        </>
      );
    }
    const me = selfAsCard(session.profile, session.player);
    const ranked = filterOpportunities(await rankedOpportunitiesForPlayer(supabase, me, 120), filters);
    const ids = ranked.map((r) => r.row.id);
    const { data: desc } = ids.length ? await supabase.from("opportunities").select("id, description").in("id", ids) : { data: [] };
    const d = new Map((desc ?? []).map((r) => [r.id as string, r.description as string | null]));
    const items: DeckItem[] = ranked.map((r) => ({ kind: "opportunity", id: r.row.id, opp: { ...toOpportunityVM(r.row, r.match), description: d.get(r.row.id) ?? null } }));
    return <DiscoverView mode="player" items={items} filters={filters} total={items.length} />;
  }

  // Organización
  const org = session.activeOrg!.organization;
  const { data: opps } = await supabase
    .from("opportunities")
    .select("*")
    .eq("organization_id", org.id)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  const list = (opps ?? []) as DiscoverOpportunityRow[];
  const wanted = typeof sp.opportunity === "string" ? sp.opportunity : null;
  const selected = list.find((o) => o.id === wanted) ?? null;
  let reqs: Awaited<ReturnType<typeof requirementsByOpportunity>> | null = null;
  if (selected) reqs = await requirementsByOpportunity(supabase, [selected.id]);
  const spec = selected
    ? { ...selected, org_name: org.name, org_crest_path: org.crest_path, org_verification: org.verification_status, org_type: org.type }
    : null;
  const ranked = filterPlayers(await rankedPlayersForOrg(supabase, org, spec, reqs?.get(selected!.id) ?? []), filters);
  const vms = await toPlayerVMs(supabase, ranked.slice(0, 80));
  const items: DeckItem[] = vms.map((p) => ({ kind: "player", id: p.id, player: p }));
  return (
    <DiscoverView
      mode="organization"
      items={items}
      filters={filters}
      total={ranked.length}
      opportunities={list.map((o) => ({ id: o.id, title: o.title }))}
      selectedOpportunity={selected?.id ?? null}
    />
  );
}
