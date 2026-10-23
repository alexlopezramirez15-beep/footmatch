import Link from "next/link";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { EmptyState, GlassAvatar, GlassBadge, GlassButton, GlassCard } from "@/components/glass/primitives";
import { RevokeButton } from "@/components/guardian/guardian-forms";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";

export const metadata = { title: "Tutor legal" };

export default async function GuardianDashboard(props: PageProps<"/guardian">) {
  const session = await requireSession();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { t, f } = await getI18n();
  const { data: rels } = await supabase.from("guardian_relationships").select("minor_id, status, approved_at").eq("guardian_id", session.userId).order("approved_at", { ascending: false });
  const ids = (rels ?? []).map((r) => r.minor_id as string);
  const [{ data: people }, { data: convs }] = await Promise.all([
    ids.length ? supabase.from("public_profiles").select("id, display_name").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("conversations").select("id, player_id, organization:organizations(name), blocked_at").in("player_id", ids) : Promise.resolve({ data: [] }),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="fm-eyebrow">{t("guardian.dashboard")}</p>
        <h1 className="fm-display text-[32px]">{session.profile.full_name}</h1>
      </div>
      {sp.accepted ? <GlassCard material="tint-green" className="text-sm">{t("guardian.acceptedToast")}</GlassCard> : null}
      {sp.rejected ? <GlassCard material="thin" className="text-sm">{t("guardian.rejectedToast")}</GlassCard> : null}
      {!rels?.length ? (
        <EmptyState icon={<ShieldCheck className="size-7" />} title={t("guardian.none")} body={t("guardian.noneBody")} />
      ) : (
        rels.map((r) => {
          const name = (people ?? []).find((p) => p.id === r.minor_id)?.display_name ?? "—";
          const list = (convs ?? []).filter((c) => c.player_id === r.minor_id) as unknown as Array<{ id: string; organization: { name: string } | null; blocked_at: string | null }>;
          return (
            <GlassCard key={r.minor_id} material="regular" className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <GlassAvatar name={name} seed={r.minor_id} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{name}</p>
                  <p className="text-[13px] text-ink-2">{r.approved_at ? t("guardian.since", { date: f.date(r.approved_at) }) : ""}</p>
                </div>
                <GlassBadge tone={r.status === "approved" ? "green" : "neutral"}>{t(`profile.gstatus.${r.status}`)}</GlassBadge>
              </div>
              {list.length ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[13px] font-semibold text-ink-2">{t("guardian.conversations")}</p>
                  {list.map((c) => (
                    <Link key={c.id} href={`/chats/${c.id}`} className="glass glass-thin flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm">
                      <MessageCircle className="size-4" /> <span className="flex-1 truncate">{c.organization?.name}</span>
                      {c.blocked_at ? <GlassBadge tone="neutral">{t("chat.blocked")}</GlassBadge> : null}
                    </Link>
                  ))}
                </div>
              ) : <p className="text-sm text-ink-2">{t("guardian.noConversations")}</p>}
              {r.status === "approved" ? <RevokeButton minorId={r.minor_id} /> : null}
            </GlassCard>
          );
        })
      )}
      <Link href="/settings"><GlassButton variant="ghost">{t("nav.settings")}</GlassButton></Link>
    </div>
  );
}
