import Link from "next/link";
import { GlassNavbar } from "@/components/glass/navigation";
import { EmptyState, GlassBadge, GlassCard, SectionHeader } from "@/components/glass/primitives";
import { OrgVerificationSelect, PurgeDemo, ReportRow, SuspendButton, VerificationRow, WeightsEditor } from "@/components/admin/admin-panels";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";

export const metadata = { title: "Administración" };

const TABS = ["overview", "verifications", "reports", "users", "organizations", "matching", "audit"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminPage(props: PageProps<"/admin">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab as string) ? (sp.tab as Tab) : "overview";
  const q = typeof sp.q === "string" ? sp.q.replace(/[%_,().*\\]/g, " ").trim().slice(0, 60) : "";
  const supabase = await createClient();
  const { t, f } = await getI18n();

  let body: React.ReactNode = null;
  if (tab === "overview") {
    const { data: m } = await supabase.rpc("admin_metrics");
    const metrics = (m ?? {}) as Record<string, number>;
    body = (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(metrics).filter(([k]) => k !== "demo_records").map(([k, v]) => (
            <GlassCard key={k} material="regular" className="p-4">
              <p className="text-[12px] font-medium text-ink-2">{t(`admin.m.${k}`)}</p>
              <p className="fm-number mt-1 text-[28px]">{f.number(v)}</p>
            </GlassCard>
          ))}
        </div>
        <p className="text-xs text-ink-3">{t("admin.metricsHint")}</p>
        <PurgeDemo count={metrics.demo_records ?? 0} />
      </div>
    );
  } else if (tab === "verifications") {
    const { data } = await supabase.from("verification_requests").select("id, subject, user_id, organization_id, evidence, created_at").eq("status", "pending").order("created_at");
    const orgIds = (data ?? []).map((r) => r.organization_id).filter(Boolean) as string[];
    const userIds = (data ?? []).map((r) => r.user_id).filter(Boolean) as string[];
    const [{ data: orgs }, { data: users }] = await Promise.all([
      orgIds.length ? supabase.from("organizations").select("id, name").in("id", orgIds) : Promise.resolve({ data: [] }),
      userIds.length ? supabase.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    ]);
    body = !data?.length ? <EmptyState title={t("admin.noVerifications")} /> : (
      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((r) => (
          <VerificationRow key={r.id} kind={r.subject === "organization" ? "organization" : "agent"} id={(r.organization_id ?? r.user_id) as string}
            name={r.organization_id ? (orgs ?? []).find((o) => o.id === r.organization_id)?.name ?? "—" : (users ?? []).find((u) => u.id === r.user_id)?.full_name ?? "—"}
            evidence={r.evidence} createdAt={r.created_at} />
        ))}
      </div>
    );
  } else if (tab === "reports") {
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
    body = !data?.length ? <EmptyState title={t("admin.noReports")} /> : (
      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((r) => {
          const target = r.target_user_id ? `/players/${r.target_user_id}` : r.target_org_id ? `/clubs/${r.target_org_id}` : r.target_opportunity_id ? `/opportunities/${r.target_opportunity_id}` : r.target_conversation_id ? `/chats/${r.target_conversation_id}` : "—";
          return <ReportRow key={r.id} id={r.id} status={r.status} reason={r.reason} details={r.details} target={`${t(`admin.target.${r.target_type}`)} · ${target}`} createdAt={r.created_at} />;
        })}
      </div>
    );
  } else if (tab === "users") {
    let uq = supabase.from("profiles").select("id, full_name, primary_role, created_at, suspended_at, is_demo, deleted_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
    if (q) uq = uq.ilike("full_name", `%${q}%`);
    const { data } = await uq;
    body = (
      <GlassCard material="regular" padded={false} className="divide-y divide-[var(--fm-hairline)]">
        {(data ?? []).map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{u.full_name} {u.is_demo ? <GlassBadge tone="demo">DEMO</GlassBadge> : null}</p>
              <p className="text-[12px] text-ink-2">{u.primary_role ? t(`football.role.${u.primary_role}`) : "—"} · {f.date(u.created_at)}</p>
            </div>
            <SuspendButton kind="user" id={u.id} suspended={Boolean(u.suspended_at)} />
          </div>
        ))}
      </GlassCard>
    );
  } else if (tab === "organizations") {
    let oq = supabase.from("organizations").select("id, name, type, city, verification_status, suspended_at, is_demo, created_at").order("created_at", { ascending: false }).limit(100);
    if (q) oq = oq.ilike("name", `%${q}%`);
    const { data } = await oq;
    body = (
      <GlassCard material="regular" padded={false} className="divide-y divide-[var(--fm-hairline)]">
        {(data ?? []).map((o) => (
          <div key={o.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
            <Link href={`/clubs/${o.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{o.name} {o.is_demo ? <GlassBadge tone="demo">DEMO</GlassBadge> : null}</p>
              <p className="text-[12px] text-ink-2">{t(`football.org.${o.type}`)}{o.city ? ` · ${o.city}` : ""}</p>
            </Link>
            <div className="flex items-center gap-2"><OrgVerificationSelect id={o.id} status={o.verification_status} /><SuspendButton kind="organization" id={o.id} suspended={Boolean(o.suspended_at)} /></div>
          </div>
        ))}
      </GlassCard>
    );
  } else if (tab === "matching") {
    const { data } = await supabase.from("matching_criteria").select("criterion, weight, enabled").order("weight", { ascending: false });
    body = <WeightsEditor rows={(data ?? []) as Array<{ criterion: string; weight: number; enabled: boolean }>} />;
  } else {
    const { data } = await supabase.from("audit_logs").select("id, action, entity, entity_id, created_at, actor_id").order("created_at", { ascending: false }).limit(100);
    body = (
      <GlassCard material="regular" padded={false} className="divide-y divide-[var(--fm-hairline)] font-mono text-[12px]">
        {(data ?? []).map((a) => (
          <div key={a.id} className="flex flex-wrap gap-x-3 px-4 py-2.5">
            <span className="text-ink-3">{f.date(a.created_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            <span className="font-semibold">{a.action}</span>
            <span className="text-ink-2">{a.entity}:{(a.entity_id ?? "").slice(0, 8)}</span>
          </div>
        ))}
      </GlassCard>
    );
  }

  return (
    <>
      <GlassNavbar title={t("nav.admin")} subtitle={t("admin.subtitle")} />
      <nav className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4" aria-label={t("nav.admin")}>
        {TABS.map((k) => (
          <Link key={k} href={`/admin?tab=${k}`} aria-current={tab === k ? "page" : undefined}
            className={cn("inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium", tab === k ? "glass glass-tint-green" : "glass glass-thin text-ink-2")}>
            {t(`admin.tab.${k}`)}
          </Link>
        ))}
      </nav>
      {tab === "users" || tab === "organizations" ? (
        <form className="mb-4"><input type="hidden" name="tab" value={tab} /><input name="q" defaultValue={q} placeholder={t("common.search")} className="glass glass-thin h-11 w-full rounded-[16px] px-4 text-[15px] outline-none" /></form>
      ) : null}
      <SectionHeader title={t(`admin.tab.${tab}`)} />
      {body}
    </>
  );
}
