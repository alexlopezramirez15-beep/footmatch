import Link from "next/link";
import { Search } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { EmptyState, GlassAvatar, GlassButton, GlassCard, SectionHeader } from "@/components/glass/primitives";
import { GlassInput, GlassSelect } from "@/components/glass/forms";
import { Crest, GlassOpportunityCard } from "@/components/cards/cards";
import { appMode, requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { publicAssetUrl, signPlayerMedia } from "@/lib/media";
import { POSITIONS } from "@/domains/football/catalog";
import { flattenOpp, toOpportunityVM } from "@/domains/opportunities/queries";
import type { PlayerCardRow } from "@/lib/types";

export const metadata = { title: "Buscar" };

// Escapa comodines de LIKE y caracteres reservados del filtro de PostgREST.
const clean = (s: string) => s.replace(/[%_,().*\\]/g, " ").trim().slice(0, 60);

export default async function SearchPage(props: PageProps<"/search">) {
  const session = await requireApp();
  const sp = await props.searchParams;
  const q = clean(typeof sp.q === "string" ? sp.q : "");
  const position = typeof sp.position === "string" && (POSITIONS as readonly string[]).includes(sp.position) ? sp.position : "";
  const supabase = await createClient();
  const { t } = await getI18n();
  const org = appMode(session) === "organization";
  const searched = Boolean(q || position);

  let players: PlayerCardRow[] = [];
  let signed: Record<string, string> = {};
  let clubs: Array<{ id: string; name: string; crest_path: string | null; city: string | null; type: string }> = [];
  let opps: ReturnType<typeof toOpportunityVM>[] = [];

  if (searched) {
    let pq = supabase.from("player_cards").select("*").limit(40);
    if (q) pq = pq.or(`display_name.ilike.%${q}%,current_club.ilike.%${q}%,city.ilike.%${q}%`);
    if (position) pq = pq.or(`position.eq.${position},secondary_positions.cs.{${position}}`);
    let oq = supabase.from("opportunities").select("*, organization:organizations(id, name, crest_path, verification_status, type)").eq("status", "open").limit(20);
    if (q) oq = oq.or(`title.ilike.%${q}%,city.ilike.%${q}%`);
    if (position) oq = oq.contains("positions", [position]);
    const [p, c, o] = await Promise.all([
      org ? pq : Promise.resolve({ data: [] }),
      q ? supabase.from("organizations").select("id, name, crest_path, city, type").or(`name.ilike.%${q}%,city.ilike.%${q}%`).is("suspended_at", null).limit(20) : Promise.resolve({ data: [] }),
      oq,
    ]);
    players = ((p.data ?? []) as PlayerCardRow[]).filter((x) => x.user_id !== session.userId);
    signed = await signPlayerMedia(supabase, players.map((x) => x.avatar_path));
    clubs = (c.data ?? []) as typeof clubs;
    opps = ((o.data ?? []) as Parameters<typeof flattenOpp>[0][]).map((x) => toOpportunityVM(flattenOpp(x), null));
  }

  return (
    <>
      <GlassNavbar title={t("nav.search")} />
      <form action="/search" className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1"><GlassInput name="q" type="search" defaultValue={q} placeholder={org ? t("search.phOrg") : t("search.phPlayer")} leading={<Search className="size-4" />} aria-label={t("common.search")} /></div>
        <GlassSelect name="position" defaultValue={position} aria-label={t("discover.fPositions")} className="sm:w-48">
          <option value="">{t("search.anyPosition")}</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{t(`football.pos.${p}`)}</option>)}
        </GlassSelect>
        <GlassButton type="submit">{t("common.search")}</GlassButton>
      </form>
      {!searched ? (
        <EmptyState icon={<Search className="size-7" />} title={t("search.startTitle")} body={org ? t("search.startOrg") : t("search.startPlayer")} />
      ) : !players.length && !clubs.length && !opps.length ? (
        <EmptyState icon={<Search className="size-7" />} title={t("search.noResults")} body={t("search.noResultsBody")} />
      ) : (
        <div className="flex flex-col gap-7">
          {players.length ? (
            <section>
              <SectionHeader title={t("favorites.players")} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {players.map((p) => (
                  <Link key={p.user_id} href={`/players/${p.user_id}`}>
                    <GlassCard material="regular" interactive className="flex flex-col items-center p-4 text-center">
                      <GlassAvatar src={p.avatar_path ? signed[p.avatar_path] : null} name={p.display_name} seed={p.user_id} size={60} />
                      <p className="mt-2 line-clamp-1 font-semibold">{p.display_name}</p>
                      <p className="text-[12px] text-ink-2">{t(`football.pos.${p.position}`)}{p.age != null ? ` · ${p.age}` : ""}</p>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {clubs.length ? (
            <section>
              <SectionHeader title={t("favorites.clubs")} />
              <div className="grid gap-3 sm:grid-cols-2">
                {clubs.map((o) => (
                  <Link key={o.id} href={`/clubs/${o.id}`}>
                    <GlassCard material="regular" interactive className="flex items-center gap-3">
                      <Crest url={publicAssetUrl(o.crest_path)} name={o.name} id={o.id} size={44} />
                      <div><p className="font-semibold">{o.name}</p><p className="text-[13px] text-ink-2">{t(`football.org.${o.type}`)}{o.city ? ` · ${o.city}` : ""}</p></div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {opps.length ? (
            <section>
              <SectionHeader title={t("nav.opportunities")} />
              <div className="grid gap-3 sm:grid-cols-2">{opps.map((o) => <GlassOpportunityCard key={o.id} opp={o} href={`/opportunities/${o.id}`} />)}</div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
