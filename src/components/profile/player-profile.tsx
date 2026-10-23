import Link from "next/link";
import { Film, MapPin, Ruler, Footprints, Trophy, Languages, Plane, Timer, ExternalLink, ShieldCheck } from "lucide-react";
import { DemoBadge, GlassAvatar, GlassBadge, GlassCard, SectionHeader } from "@/components/glass/primitives";
import { MatchPill, MatchReasons } from "@/components/cards/cards";
import type { MatchResult } from "@/domains/matching/engine";
import { countryName, flag, languageName } from "@/domains/football/catalog";
import type { TFunction } from "@/i18n";

export type PlayerProfileData = {
  id: string;
  name: string;
  age: number | null;
  isMinor: boolean;
  isDemo: boolean;
  photoUrl: string | null;
  position: string;
  secondary: string[];
  nationality: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  currentClub: string | null;
  category: string | null;
  heightCm: number | null;
  weightKg: number | null;
  foot: string | null;
  experienceYears: number;
  availability: string;
  mobility: string;
  relocate: boolean;
  languages: string[];
  goals: string | null;
  bio: string | null;
  strengths: string[];
  careers: Array<{ id: string; club_name: string; season: string; category: string | null; role_note?: string | null }>;
  stats: Array<{ id: string; season: string; competition: string | null; matches: number | null; minutes: number | null; goals: number | null; assists: number | null; clean_sheets: number | null; source: string }>;
  videos: Array<{ id: string; title: string | null; external_url: string | null; kind: string }>;
  photos: Array<{ id: string; url: string }>;
};

/** Ficha de jugador (servidor). Las acciones se pasan como hijos (cliente). */
export function PlayerProfile({ p, t, intl, match, actions, banner }: { p: PlayerProfileData; t: TFunction; intl: string; match?: MatchResult | null; actions?: React.ReactNode; banner?: React.ReactNode }) {
  const facts: Array<[React.ReactNode, string, string | null]> = [
    [<Ruler key="h" className="size-4" />, t("profile.height"), p.heightCm ? `${p.heightCm} cm${p.weightKg ? ` · ${p.weightKg} kg` : ""}` : null],
    [<Footprints key="f" className="size-4" />, t("profile.foot"), p.foot ? t(`football.foot.${p.foot}`) : null],
    [<Trophy key="c" className="size-4" />, t("onboarding.category"), p.category ? t(`football.cat.${p.category}`) : null],
    [<Timer key="e" className="size-4" />, t("profile.experience"), t("profile.experienceYears", { n: p.experienceYears })],
    [<Plane key="m" className="size-4" />, t("profile.mobility"), `${t(`football.mob.${p.mobility}`)}${p.relocate ? ` · ${t("profile.relocate")}` : ""}`],
    [<Languages key="l" className="size-4" />, t("onboarding.languages"), p.languages.length ? p.languages.map((c) => languageName(c, intl)).join(", ") : null],
  ];
  return (
    <div className="flex flex-col gap-6">
      <GlassCard material="elevated" radius="xl" padded={false} className="relative overflow-hidden">
        <div className="relative aspect-[4/3] w-full sm:aspect-[16/8]">
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt={p.name} className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="fm-pitch absolute inset-0 flex items-center justify-center">
              <GlassAvatar name={p.name} seed={p.id} size={120} />
            </div>
          )}
          <div className="fm-photo-scrim absolute inset-0" aria-hidden />
          <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
            {p.isDemo ? <DemoBadge /> : null}
            {p.isMinor ? <GlassBadge tone="amber" icon={<ShieldCheck className="size-3" />}>{t("profile.minorProtected")}</GlassBadge> : null}
          </div>
          {match ? <div className="absolute top-4 right-4"><MatchPill score={match.score} eligible={match.eligible} size="lg" /></div> : null}
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p className="text-[13px] font-semibold tracking-wide text-white/80 uppercase">
              {t(`football.pos.${p.position}`)}{p.secondary.length ? ` · ${p.secondary.join(" · ")}` : ""}
            </p>
            <h1 className="fm-display mt-1 text-[34px] sm:text-[44px]">
              {p.name}{p.age != null ? <span className="font-medium text-white/80">, {p.age}</span> : null}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-white/85">
              {p.nationality ? <span>{flag(p.nationality)} {countryName(p.nationality, intl)}</span> : null}
              {p.city || p.country ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{[p.city, p.region, countryName(p.country, intl)].filter(Boolean).join(" · ")}</span> : null}
              {p.currentClub ? <span>{p.currentClub}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <GlassBadge tone={p.availability === "unavailable" ? "neutral" : "green"}>{t(`football.av.${p.availability}`)}</GlassBadge>
          {p.strengths.slice(0, 4).map((s) => <GlassBadge key={s} tone="neutral">{s}</GlassBadge>)}
          {actions ? <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div> : null}
        </div>
      </GlassCard>

      {banner}

      {match ? (
        <section>
          <SectionHeader title={t("reasons.why")} />
          <GlassCard material="regular" className="flex flex-col gap-3">
            <MatchReasons match={match} max={8} />
            <p className="text-[11px] text-ink-3">{t("reasons.method")}</p>
          </GlassCard>
        </section>
      ) : null}

      <section>
        <SectionHeader title={t("profile.data")} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {facts.map(([icon, label, value]) => (
            <GlassCard key={label} material="regular" className="p-4">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">{icon}{label}</p>
              <p className="mt-1 text-[15px] font-semibold">{value ?? "—"}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {p.goals || p.bio ? (
        <section>
          <SectionHeader title={t("profile.about")} />
          <GlassCard material="regular" className="flex flex-col gap-3 text-[15px] leading-relaxed">
            {p.bio ? <p className="whitespace-pre-line">{p.bio}</p> : null}
            {p.goals ? (<div><p className="fm-eyebrow mb-1">{t("profile.goals")}</p><p className="whitespace-pre-line">{p.goals}</p></div>) : null}
          </GlassCard>
        </section>
      ) : null}

      {p.videos.length ? (
        <section>
          <SectionHeader title={t("profile.videos")} />
          <div className="grid gap-3 sm:grid-cols-2">
            {p.videos.map((v) => (
              <a key={v.id} href={v.external_url ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="block">
                <GlassCard material="regular" interactive className="flex items-center gap-3">
                  <div className="glass glass-tint-green flex size-12 shrink-0 items-center justify-center rounded-2xl"><Film className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{v.title || t("profile.video")}</p>
                    <p className="truncate text-[13px] text-ink-2">{v.external_url ? new URL(v.external_url).hostname : ""}</p>
                  </div>
                  <ExternalLink className="size-4 text-ink-3" />
                </GlassCard>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {p.photos.length ? (
        <section>
          <SectionHeader title={t("profile.photos")} />
          <div className="grid grid-cols-3 gap-2">
            {p.photos.map((ph) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={ph.id} src={ph.url} alt="" className="aspect-square w-full rounded-[20px] object-cover" />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader title={t("profile.career")} />
        {p.careers.length ? (
          <GlassCard material="regular" className="py-2">
            <ol className="relative ml-3 border-l border-[var(--fm-hairline)]">
              {p.careers.map((c) => (
                <li key={c.id} className="relative py-3 pl-5">
                  <span className="absolute top-[18px] -left-[5px] size-2.5 rounded-full bg-accent" aria-hidden />
                  <p className="font-semibold">{c.club_name}</p>
                  <p className="text-[13px] text-ink-2">{c.season}{c.category ? ` · ${t(`football.cat.${c.category}`)}` : ""}{c.role_note ? ` · ${c.role_note}` : ""}</p>
                </li>
              ))}
            </ol>
          </GlassCard>
        ) : (
          <p className="px-1 text-sm text-ink-2">{t("profile.noCareer")}</p>
        )}
      </section>

      {p.stats.length ? (
        <section>
          <SectionHeader title={t("profile.stats")} />
          <GlassCard material="regular" padded={false} className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-[12px] text-ink-2">
                <tr>
                  {[t("profile.season"), t("profile.competition"), "PJ", "Min", t("profile.goalsShort"), t("profile.assistsShort"), ""].map((h, i) => (
                    <th key={i} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {p.stats.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--fm-hairline)]">
                    <td className="px-4 py-3 font-medium">{s.season}</td>
                    <td className="px-4 py-3">{s.competition ?? "—"}</td>
                    <td className="px-4 py-3">{s.matches ?? "—"}</td>
                    <td className="px-4 py-3">{s.minutes ?? "—"}</td>
                    <td className="px-4 py-3">{s.goals ?? "—"}</td>
                    <td className="px-4 py-3">{s.assists ?? "—"}</td>
                    <td className="px-4 py-3"><GlassBadge tone={s.source === "verified" ? "blue" : "neutral"}>{t(`profile.src.${s.source}`)}</GlassBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </section>
      ) : null}
    </div>
  );
}
