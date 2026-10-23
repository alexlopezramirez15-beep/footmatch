import Link from "next/link";
import { Star } from "lucide-react";
import { GlassNavbar } from "@/components/glass/navigation";
import { EmptyState, GlassAvatar, GlassButton, GlassCard, SectionHeader } from "@/components/glass/primitives";
import { Crest, GlassOpportunityCard } from "@/components/cards/cards";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { publicAssetUrl, signPlayerMedia } from "@/lib/media";
import { flattenOpp, toOpportunityVM } from "@/domains/opportunities/queries";
import type { PlayerCardRow } from "@/lib/types";

export const metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  const session = await requireApp();
  const supabase = await createClient();
  const { t } = await getI18n();
  const { data: favs } = await supabase.from("favorites").select("target_type, target_user_id, target_org_id, target_opportunity_id, created_at").eq("user_id", session.userId).order("created_at", { ascending: false });
  const list = favs ?? [];
  const pIds = list.map((f) => f.target_user_id).filter(Boolean) as string[];
  const oIds = list.map((f) => f.target_org_id).filter(Boolean) as string[];
  const opIds = list.map((f) => f.target_opportunity_id).filter(Boolean) as string[];
  const [{ data: players }, { data: orgs }, { data: opps }] = await Promise.all([
    pIds.length ? supabase.from("player_cards").select("*").in("user_id", pIds) : Promise.resolve({ data: [] }),
    oIds.length ? supabase.from("organizations").select("id, name, crest_path, city").in("id", oIds) : Promise.resolve({ data: [] }),
    opIds.length ? supabase.from("opportunities").select("*, organization:organizations(id, name, crest_path, verification_status, type)").in("id", opIds) : Promise.resolve({ data: [] }),
  ]);
  const pRows = (players ?? []) as PlayerCardRow[];
  const signed = await signPlayerMedia(supabase, pRows.map((p) => p.avatar_path));
  const oppVMs = ((opps ?? []) as Parameters<typeof flattenOpp>[0][]).map((o) => toOpportunityVM(flattenOpp(o), null));

  return (
    <>
      <GlassNavbar title={t("nav.favorites")} />
      {!pRows.length && !(orgs ?? []).length && !oppVMs.length ? (
        <EmptyState icon={<Star className="size-7" />} title={t("favorites.emptyTitle")} body={t("favorites.emptyBody")} action={<Link href="/discover"><GlassButton>{t("nav.discover")}</GlassButton></Link>} />
      ) : (
        <div className="flex flex-col gap-7">
          {pRows.length ? (
            <section>
              <SectionHeader title={t("favorites.players")} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {pRows.map((p) => (
                  <Link key={p.user_id} href={`/players/${p.user_id}`}>
                    <GlassCard material="regular" interactive className="flex flex-col items-center p-4 text-center">
                      <GlassAvatar src={p.avatar_path ? signed[p.avatar_path] : null} name={p.display_name} seed={p.user_id} size={64} />
                      <p className="mt-2 line-clamp-1 font-semibold">{p.display_name}</p>
                      <p className="text-[12px] text-ink-2">{t(`football.pos.${p.position}`)}{p.age != null ? ` · ${p.age}` : ""}</p>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {(orgs ?? []).length ? (
            <section>
              <SectionHeader title={t("favorites.clubs")} />
              <div className="grid gap-3 sm:grid-cols-2">
                {(orgs ?? []).map((o) => (
                  <Link key={o.id} href={`/clubs/${o.id}`}>
                    <GlassCard material="regular" interactive className="flex items-center gap-3">
                      <Crest url={publicAssetUrl(o.crest_path)} name={o.name} id={o.id} size={44} />
                      <div><p className="font-semibold">{o.name}</p><p className="text-[13px] text-ink-2">{o.city ?? ""}</p></div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {oppVMs.length ? (
            <section>
              <SectionHeader title={t("nav.opportunities")} />
              <div className="grid gap-3 sm:grid-cols-2">
                {oppVMs.map((o) => <GlassOpportunityCard key={o.id} opp={o} href={`/opportunities/${o.id}`} />)}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
