import { redirect } from "next/navigation";
import { GlassNavbar } from "@/components/glass/navigation";
import { PipelineBoard, type PipelineCard } from "@/components/pipeline/board";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { signPlayerMedia } from "@/lib/media";
import { computeMatch } from "@/domains/matching/engine";
import { loadWeights, opportunityToSpec, playerToFacts } from "@/domains/matching/adapters";
import { requirementsByOpportunity } from "@/domains/opportunities/queries";
import type { DiscoverOpportunityRow, PlayerCardRow } from "@/lib/types";

export const metadata = { title: "Candidaturas" };

export default async function PipelinePage(props: PageProps<"/club/pipeline">) {
  const session = await requireApp();
  const m = session.activeOrg;
  if (!m) redirect("/applications");
  const org = m.organization;
  const sp = await props.searchParams;
  const wanted = typeof sp.opportunity === "string" ? sp.opportunity : null;
  const supabase = await createClient();
  const { t } = await getI18n();

  const { data: opps } = await supabase.from("opportunities").select("*").eq("organization_id", org.id).order("created_at", { ascending: false });
  const oppRows = (opps ?? []) as DiscoverOpportunityRow[];
  const selected = oppRows.find((o) => o.id === wanted) ?? null;

  let q = supabase.from("applications").select("id, status, created_at, message, assigned_to, opportunity_id, applicant_id").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(500);
  if (selected) q = q.eq("opportunity_id", selected.id);
  const { data: apps } = await q;
  const list = apps ?? [];
  const playerIds = [...new Set(list.map((a) => a.applicant_id as string))];
  const [{ data: players }, { data: convs }, { data: members }, weights, reqs] = await Promise.all([
    playerIds.length ? supabase.from("player_cards").select("*").in("user_id", playerIds) : Promise.resolve({ data: [] }),
    playerIds.length ? supabase.from("conversations").select("id, player_id").eq("organization_id", org.id).in("player_id", playerIds) : Promise.resolve({ data: [] }),
    supabase.from("organization_members").select("user_id").eq("organization_id", org.id),
    loadWeights(supabase),
    requirementsByOpportunity(supabase, oppRows.map((o) => o.id)),
  ]);
  const cardsById = new Map(((players ?? []) as PlayerCardRow[]).map((p) => [p.user_id, p]));
  const convByPlayer = new Map((convs ?? []).map((c) => [c.player_id as string, c.id as string]));
  const oppById = new Map(oppRows.map((o) => [o.id, o]));
  const signed = await signPlayerMedia(supabase, [...cardsById.values()].map((p) => p.avatar_path));
  const memberIds = (members ?? []).map((x) => x.user_id as string);
  const { data: people } = memberIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", memberIds) : { data: [] };

  const cards: PipelineCard[] = list.map((a) => {
    const p = cardsById.get(a.applicant_id);
    const o = oppById.get(a.opportunity_id);
    const spec = o ? opportunityToSpec(o, reqs.get(o.id)) : null;
    return {
      id: a.id,
      status: a.status,
      createdAt: a.created_at,
      message: a.message,
      assignedTo: a.assigned_to,
      opportunity: { id: a.opportunity_id, title: o?.title ?? "—" },
      player: {
        id: a.applicant_id,
        name: p?.display_name ?? t("pipeline.hiddenPlayer"),
        age: p?.age ?? null,
        position: p?.position ?? "—",
        photoUrl: p?.avatar_path ? signed[p.avatar_path] ?? null : null,
        isMinor: p?.is_minor ?? false,
        isDemo: p?.is_demo ?? false,
        city: p?.city ?? null,
      },
      match: p && spec ? computeMatch(playerToFacts(p), spec, weights.weights, weights.enabled) : null,
      conversationId: convByPlayer.get(a.applicant_id) ?? null,
    };
  });

  return (
    <>
      <GlassNavbar title={t("nav.pipeline")} subtitle={t("pipeline.subtitle", { org: org.name })} />
      <PipelineBoard
        cards={cards}
        members={(people ?? []).map((p) => ({ id: p.id as string, name: p.display_name as string }))}
        opportunities={oppRows.map((o) => ({ id: o.id, title: o.title }))}
        selectedOpportunity={selected?.id ?? null}
        canEdit={m.role !== "scout"}
      />
    </>
  );
}
