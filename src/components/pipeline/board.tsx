"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { CalendarPlus, ExternalLink, MessageCircle, StickyNote, UserCheck } from "lucide-react";
import { DemoBadge, EmptyState, GlassAvatar, GlassBadge, GlassButton, GlassCard, GlassSegmentedControl } from "@/components/glass/primitives";
import { GlassBottomSheet, useToast } from "@/components/glass/overlays";
import { GlassField, GlassSelect, GlassTextarea } from "@/components/glass/forms";
import { MatchPill, MatchReasons } from "@/components/cards/cards";
import { useI18n } from "@/i18n/client";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import { APPLICATION_STATUSES } from "@/domains/football/catalog";
import type { MatchResult } from "@/domains/matching/engine";
import {
  addApplicationNoteAction, applicationDetailAction, assignApplicationAction, contactApplicantAction, setApplicationStatusAction,
  type ApplicationDetail,
} from "@/domains/applications/actions";

export type PipelineCard = {
  id: string;
  status: string;
  createdAt: string;
  message: string | null;
  assignedTo: string | null;
  opportunity: { id: string; title: string };
  player: { id: string; name: string; age: number | null; position: string; photoUrl: string | null; isMinor: boolean; isDemo: boolean; city: string | null };
  match: MatchResult | null;
  conversationId: string | null;
};

type Status = (typeof APPLICATION_STATUSES)[number];

export function PipelineBoard({
  cards: initial,
  members,
  opportunities,
  selectedOpportunity,
  canEdit,
}: {
  cards: PipelineCard[];
  members: Array<{ id: string; name: string }>;
  opportunities: Array<{ id: string; title: string }>;
  selectedOpportunity: string | null;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { push } = useToast();
  const [cards, setCards] = React.useState(initial);
  const [open, setOpen] = React.useState<PipelineCard | null>(null);
  const [tab, setTab] = React.useState<Status>((params.get("status") as Status) || "received");
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<Status | null>(null);
  React.useEffect(() => setCards(initial), [initial]);

  const byStatus = React.useMemo(() => {
    const m = new Map<string, PipelineCard[]>();
    for (const s of APPLICATION_STATUSES) m.set(s, []);
    for (const c of cards) if (m.has(c.status)) m.get(c.status)!.push(c);
    return m;
  }, [cards]);
  const withdrawn = cards.filter((c) => c.status === "withdrawn").length;

  const move = async (id: string, status: Status) => {
    const prev = cards.find((c) => c.id === id);
    if (!prev || prev.status === status || prev.status === "withdrawn") return;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    haptic("light");
    const res = await setApplicationStatusAction(id, status);
    if (!res.ok) {
      setCards((cs) => cs.map((c) => (c.id === id ? prev : c)));
      push({ tone: "error", title: t(res.error) });
    } else push({ tone: "success", title: t("pipeline.moved", { status: t(`football.app.${status}`) }) });
  };

  const selectOpportunity = (id: string) => {
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("opportunity", id);
    else sp.delete("opportunity");
    router.replace(`/club/pipeline${sp.size ? `?${sp}` : ""}`);
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <GlassField label={t("pipeline.opportunity")} className="sm:w-80">
          <GlassSelect value={selectedOpportunity ?? ""} onChange={(e) => selectOpportunity(e.target.value)}>
            <option value="">{t("pipeline.allOpportunities")}</option>
            {opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </GlassSelect>
        </GlassField>
        <p className="text-sm text-ink-2 sm:ml-auto">
          {t("pipeline.total", { n: cards.length })}{withdrawn ? ` · ${t("pipeline.withdrawnCount", { n: withdrawn })}` : ""}
        </p>
      </div>

      {cards.length === 0 ? (
        <EmptyState icon={<UserCheck className="size-7" />} title={t("pipeline.empty")} body={t("pipeline.emptyBody")}
          action={<Link href="/discover"><GlassButton>{t("home.ctaFindPlayers")}</GlassButton></Link>} />
      ) : (
        <>
          {/* Móvil: pestañas por estado */}
          <div className="lg:hidden">
            <div className="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4">
              <GlassSegmentedControl
                id="pipeline-tabs"
                size="sm"
                className="w-max"
                options={APPLICATION_STATUSES.map((s) => ({ value: s, label: t(`football.app.${s}`), badge: byStatus.get(s)!.length || undefined }))}
                value={tab}
                onChange={setTab}
              />
            </div>
            <div className="flex flex-col gap-3">
              {byStatus.get(tab)!.length === 0 ? <p className="px-1 py-6 text-center text-sm text-ink-2">{t("pipeline.columnEmpty")}</p> : null}
              {byStatus.get(tab)!.map((c) => <ApplicantCard key={c.id} c={c} onOpen={() => setOpen(c)} />)}
            </div>
          </div>
          {/* Escritorio: Kanban con arrastrar y soltar */}
          <div className="no-scrollbar -mx-8 hidden gap-3 overflow-x-auto px-8 pb-4 lg:flex">
            {APPLICATION_STATUSES.map((s) => (
              <section
                key={s}
                aria-label={t(`football.app.${s}`)}
                onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(s); } }}
                onDragLeave={() => setOver((o) => (o === s ? null : o))}
                onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, s); }}
                className={cn("glass glass-ultra-thin flex w-[264px] shrink-0 flex-col rounded-[24px] p-2.5 transition-shadow", over === s && "ring-2 ring-accent")}
              >
                <header className="flex items-center justify-between px-2 pt-1 pb-2.5">
                  <h3 className="text-[13px] font-semibold">{t(`football.app.${s}`)}</h3>
                  <span className="text-xs text-ink-3 tabular">{byStatus.get(s)!.length}</span>
                </header>
                <div className="flex min-h-24 flex-col gap-2">
                  {byStatus.get(s)!.map((c) => (
                    <div
                      key={c.id}
                      draggable={canEdit}
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); setDragging(c.id); }}
                      onDragEnd={() => setDragging(null)}
                      className={cn(dragging === c.id && "opacity-50")}
                    >
                      <ApplicantCard c={c} compact onOpen={() => setOpen(c)} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      <ApplicantSheet card={open ? cards.find((c) => c.id === open.id) ?? null : null} onClose={() => setOpen(null)} members={members} canEdit={canEdit} onMove={move}
        onAssigned={(id, uid) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, assignedTo: uid } : c)))}
        onContacted={(id, conv) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, conversationId: conv, status: ["received", "reviewed", "shortlisted"].includes(c.status) ? "contacted" : c.status } : c)))} />
    </>
  );
}

function ApplicantCard({ c, compact, onOpen }: { c: PipelineCard; compact?: boolean; onOpen: () => void }) {
  const { t, f } = useI18n();
  return (
    <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onOpen} className="w-full text-left">
      <GlassCard material="regular" interactive className={cn("flex items-center gap-3", compact && "p-3")}>
        <GlassAvatar src={c.player.photoUrl} name={c.player.name} seed={c.player.id} size={compact ? 40 : 48} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-semibold">
            <span className="truncate">{c.player.name}</span>
            {c.player.isDemo ? <DemoBadge /> : null}
          </p>
          <p className="truncate text-[12px] text-ink-2">
            {c.player.position}{c.player.age != null ? ` · ${c.player.age}` : ""} · {f.relative(c.createdAt)}
          </p>
          {!compact ? <p className="truncate text-[12px] text-ink-3">{c.opportunity.title}</p> : null}
        </div>
        {c.match ? <MatchPill score={c.match.score} eligible={c.match.eligible} size="sm" /> : null}
        {c.player.isMinor ? <GlassBadge tone="amber">{t("common.minor")}</GlassBadge> : null}
      </GlassCard>
    </motion.button>
  );
}

function ApplicantSheet({
  card,
  onClose,
  members,
  canEdit,
  onMove,
  onAssigned,
  onContacted,
}: {
  card: PipelineCard | null;
  onClose: () => void;
  members: Array<{ id: string; name: string }>;
  canEdit: boolean;
  onMove: (id: string, s: Status) => void;
  onAssigned: (id: string, uid: string | null) => void;
  onContacted: (id: string, conv: string) => void;
}) {
  const { t, f } = useI18n();
  const router = useRouter();
  const { push } = useToast();
  const [detail, setDetail] = React.useState<ApplicationDetail | null>(null);
  const [note, setNote] = React.useState("");
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    setDetail(null);
    setNote("");
    if (!card) return;
    let alive = true;
    applicationDetailAction(card.id).then((r) => { if (alive && r.ok) setDetail(r.data!); });
    return () => { alive = false; };
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) return <GlassBottomSheet open={false} onClose={onClose}>{null}</GlassBottomSheet>;

  const addNote = () =>
    start(async () => {
      const res = await addApplicationNoteAction(card.id, note);
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      setDetail((d) => d && { ...d, notes: [{ id: res.data!.id, body: note.trim(), created_at: res.data!.created_at, author: t("pipeline.you") }, ...d.notes] });
      setNote("");
    });
  const contact = () =>
    start(async () => {
      if (card.conversationId) return router.push(`/chats/${card.conversationId}`);
      const res = await contactApplicantAction(card.id);
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      onContacted(card.id, res.data!.conversationId);
      router.push(`/chats/${res.data!.conversationId}`);
    });
  const assign = (uid: string) =>
    start(async () => {
      const res = await assignApplicationAction(card.id, uid || null);
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      onAssigned(card.id, uid || null);
    });
  const locked = card.status === "withdrawn";

  return (
    <GlassBottomSheet open onClose={onClose} title={card.player.name} className="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <GlassAvatar src={card.player.photoUrl} name={card.player.name} seed={card.player.id} size={64} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-2">{t(`football.pos.${card.player.position}`)}{card.player.age != null ? ` · ${t("common.years", { n: card.player.age })}` : ""}{card.player.city ? ` · ${card.player.city}` : ""}</p>
            <p className="truncate text-sm font-medium">{card.opportunity.title}</p>
          </div>
          {card.match ? <MatchPill score={card.match.score} eligible={card.match.eligible} /> : null}
        </div>
        {card.match ? <MatchReasons match={card.match} max={4} /> : null}
        {card.message ? (
          <GlassCard material="thin" className="text-[15px] leading-relaxed">
            <p className="fm-eyebrow mb-1">{t("pipeline.message")}</p>
            <p className="whitespace-pre-line">{card.message}</p>
          </GlassCard>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <GlassButton loading={pending} onClick={contact} disabled={!canEdit && !card.conversationId}><MessageCircle className="size-4" /> {card.conversationId ? t("pipeline.openChat") : t("pipeline.contact")}</GlassButton>
          <Link href={`/players/${card.player.id}`}><GlassButton variant="glass" className="w-full"><ExternalLink className="size-4" /> {t("discover.fullProfile")}</GlassButton></Link>
          {canEdit && !locked ? (
            <Link href={`/trials/new?application=${card.id}`} className="col-span-2"><GlassButton variant="glass" className="w-full"><CalendarPlus className="size-4" /> {t("pipeline.proposeTrial")}</GlassButton></Link>
          ) : null}
        </div>

        {locked ? (
          <GlassBadge tone="neutral">{t("football.app.withdrawn")}</GlassBadge>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <GlassField label={t("pipeline.status")}>
              <GlassSelect value={card.status} disabled={!canEdit} onChange={(e) => onMove(card.id, e.target.value as Status)}>
                {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{t(`football.app.${s}`)}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label={t("pipeline.assignee")}>
              <GlassSelect value={card.assignedTo ?? ""} disabled={!canEdit} onChange={(e) => assign(e.target.value)}>
                <option value="">{t("pipeline.unassigned")}</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </GlassSelect>
            </GlassField>
          </div>
        )}

        <section>
          <p className="mb-2 flex items-center gap-1.5 font-semibold"><StickyNote className="size-4" /> {t("pipeline.notes")}</p>
          <p className="mb-2 text-xs text-ink-3">{t("pipeline.notesPrivate")}</p>
          <div className="flex gap-2">
            <GlassTextarea rows={2} value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} placeholder={t("pipeline.notePh")} />
            <GlassButton size="sm" className="self-end" disabled={!note.trim()} loading={pending} onClick={addNote}>{t("common.save")}</GlassButton>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {detail?.notes.map((n) => (
              <li key={n.id} className="glass glass-thin rounded-2xl p-3 text-sm">
                <p className="whitespace-pre-line">{n.body}</p>
                <p className="mt-1 text-[11px] text-ink-3">{n.author} · {f.relative(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </section>

        {detail?.history.length ? (
          <section>
            <p className="mb-2 font-semibold">{t("pipeline.history")}</p>
            <ol className="flex flex-col gap-1.5 text-sm">
              {detail.history.map((h) => (
                <li key={h.id} className="flex justify-between gap-3">
                  <span>{h.from_status ? `${t(`football.app.${h.from_status}`)} → ` : ""}{t(`football.app.${h.to_status}`)}</span>
                  <span className="text-ink-3">{f.date(h.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </GlassBottomSheet>
  );
}
