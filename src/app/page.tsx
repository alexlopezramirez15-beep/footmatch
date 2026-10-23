import Link from "next/link";
import { ArrowRight, BadgeCheck, Briefcase, CalendarDays, Compass, GraduationCap, Handshake, MessageCircle, Scale, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { GlassButton, GlassCard } from "@/components/glass/primitives";
import { HeroVisual } from "@/components/landing/hero-visual";
import { LocaleSwitcher } from "@/components/landing/locale-switcher";
import { getSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";

export default async function Landing(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const session = await getSession();
  const { t } = await getI18n();
  const audiences = [
    { icon: <UserRound className="size-5" />, k: "players" },
    { icon: <BadgeCheck className="size-5" />, k: "clubs" },
    { icon: <Users className="size-5" />, k: "coaches" },
    { icon: <Handshake className="size-5" />, k: "agents" },
    { icon: <GraduationCap className="size-5" />, k: "academies" },
  ];
  const steps = [
    { icon: <UserRound className="size-5" />, k: "s1" },
    { icon: <Compass className="size-5" />, k: "s2" },
    { icon: <Sparkles className="size-5" />, k: "s3" },
    { icon: <MessageCircle className="size-5" />, k: "s4" },
    { icon: <CalendarDays className="size-5" />, k: "s5" },
  ];
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6" style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}>
      <header className="glass glass-elevated sticky top-3 z-30 mt-3 flex items-center justify-between gap-3 rounded-full py-2 pr-2 pl-4">
        <Logo size={28} />
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          {session ? (
            <Link href="/home"><GlassButton size="sm">{t("landing.openApp")}</GlassButton></Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block"><GlassButton size="sm" variant="ghost">{t("auth.login")}</GlassButton></Link>
              <Link href="/register"><GlassButton size="sm">{t("landing.join")}</GlassButton></Link>
            </>
          )}
        </div>
      </header>

      {sp.account === "deleted" ? <GlassCard material="tint-green" className="mt-4 text-center text-sm">{t("landing.accountDeleted")}</GlassCard> : null}

      <section className="grid items-center gap-12 py-14 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="fm-eyebrow mb-3">{t("landing.eyebrow")}</p>
          <h1 className="fm-display text-[44px] leading-[1.02] text-balance sm:text-[64px]">{t("landing.title")}</h1>
          <p className="mt-5 max-w-xl text-[17px] text-ink-2 text-pretty sm:text-[19px]">{t("landing.subtitle")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={session ? "/home" : "/register"}><GlassButton size="lg" className="w-full sm:w-auto">{t("landing.ctaPrimary")} <ArrowRight className="size-4" /></GlassButton></Link>
            <Link href="#how"><GlassButton size="lg" variant="glass" className="w-full sm:w-auto">{t("landing.ctaSecondary")}</GlassButton></Link>
          </div>
          <p className="mt-4 text-sm text-ink-3">{t("landing.free")}</p>
        </div>
        <HeroVisual />
      </section>

      <section className="py-10">
        <h2 className="fm-title mb-6 text-center text-[28px]">{t("landing.forWho")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {audiences.map((a) => (
            <GlassCard key={a.k} material="regular" className="flex flex-col gap-2">
              <span className="glass glass-tint-green flex size-11 items-center justify-center rounded-2xl">{a.icon}</span>
              <p className="font-semibold">{t(`landing.aud.${a.k}`)}</p>
              <p className="text-sm text-ink-2">{t(`landing.aud.${a.k}Body`)}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-24 py-14">
        <h2 className="fm-title mb-2 text-center text-[28px]">{t("landing.howTitle")}</h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-ink-2">{t("landing.howBody")}</p>
        <ol className="grid gap-3 sm:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.k}>
              <GlassCard material="thin" className="flex h-full flex-col gap-2">
                <span className="text-xs font-bold text-accent tabular">0{i + 1}</span>
                <span className="text-ink-2">{s.icon}</span>
                <p className="font-semibold">{t(`landing.how.${s.k}`)}</p>
              </GlassCard>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 py-10 lg:grid-cols-3">
        <GlassCard material="elevated" className="flex flex-col gap-3">
          <Scale className="size-6 text-accent" />
          <p className="fm-title text-[19px]">{t("landing.p1Title")}</p>
          <p className="text-sm text-ink-2">{t("landing.p1Body")}</p>
        </GlassCard>
        <GlassCard material="elevated" className="flex flex-col gap-3">
          <ShieldCheck className="size-6 text-accent" />
          <p className="fm-title text-[19px]">{t("landing.p2Title")}</p>
          <p className="text-sm text-ink-2">{t("landing.p2Body")}</p>
        </GlassCard>
        <GlassCard material="elevated" className="flex flex-col gap-3">
          <Briefcase className="size-6 text-accent" />
          <p className="fm-title text-[19px]">{t("landing.p3Title")}</p>
          <p className="text-sm text-ink-2">{t("landing.p3Body")}</p>
        </GlassCard>
      </section>

      <section className="py-14">
        <GlassCard material="dark" radius="xl" className="flex flex-col items-center gap-5 px-6 py-12 text-center text-white">
          <h2 className="fm-display text-[34px] sm:text-[44px]">{t("landing.finalTitle")}</h2>
          <p className="max-w-xl text-white/75">{t("landing.finalBody")}</p>
          <Link href={session ? "/home" : "/register"}><GlassButton size="lg">{t("landing.ctaPrimary")} <ArrowRight className="size-4" /></GlassButton></Link>
        </GlassCard>
      </section>

      <footer className="flex flex-col items-center justify-between gap-3 border-t border-[var(--fm-hairline)] py-8 text-sm text-ink-3 sm:flex-row">
        <Logo size={22} />
        <nav className="flex gap-5">
          <Link href="/legal/terms">{t("legal.terms")}</Link>
          <Link href="/legal/privacy">{t("legal.privacy")}</Link>
        </nav>
        <p>© 2026 FOOTMATCH</p>
      </footer>
    </div>
  );
}
