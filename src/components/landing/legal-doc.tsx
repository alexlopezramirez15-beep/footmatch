import { GlassCard } from "@/components/glass/primitives";

export function LegalDoc({ doc, notice }: { doc: { title: string; updated: string; sections: Array<{ h: string; p: string[] }> }; notice?: string | null }) {
  return (
    <article>
      <h1 className="fm-display text-[36px]">{doc.title}</h1>
      <p className="mt-1 text-sm text-ink-3">{doc.updated}</p>
      {notice ? <GlassCard material="tint-amber" className="mt-4 text-sm">{notice}</GlassCard> : null}
      <GlassCard material="regular" className="mt-6 flex flex-col gap-6">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="fm-title text-[18px]">{s.h}</h2>
            {s.p.map((p, i) => <p key={i} className="mt-2 text-[15px] leading-relaxed text-ink-2">{p}</p>)}
          </section>
        ))}
      </GlassCard>
    </article>
  );
}
