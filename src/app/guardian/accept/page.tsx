import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { GlassButton, GlassCard } from "@/components/glass/primitives";
import { AcceptGuardianForm } from "@/components/guardian/guardian-forms";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";

export const metadata = { title: "Autorización parental" };

export default async function GuardianAcceptPage(props: PageProps<"/guardian/accept">) {
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" && /^[0-9a-f-]{36}$/i.test(sp.token) ? sp.token : null;
  const { t } = await getI18n();
  const session = await getSession();
  const here = `/guardian/accept?token=${token ?? ""}`;

  if (!token) return <GlassCard material="regular"><p>{t("guardian.invalid")}</p></GlassCard>;

  if (!session) {
    return (
      <GlassCard material="elevated" radius="xl" className="flex flex-col gap-4">
        <ShieldCheck className="size-8 text-accent" />
        <h1 className="fm-display text-[28px]">{t("guardian.title")}</h1>
        <p className="text-[15px] text-ink-2">{t("guardian.introAnon")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href={`/register?next=${encodeURIComponent(here)}`}><GlassButton className="w-full">{t("auth.register")}</GlassButton></Link>
          <Link href={`/login?next=${encodeURIComponent(here)}`}><GlassButton variant="glass" className="w-full">{t("auth.login")}</GlassButton></Link>
        </div>
        <p className="text-xs text-ink-3">{t("guardian.sameEmail")}</p>
      </GlassCard>
    );
  }

  const supabase = await createClient();
  const { data: rel } = await supabase.from("guardian_relationships").select("minor_id, status, guardian_email").eq("token", token).maybeSingle();
  if (!rel) {
    return (
      <GlassCard material="regular" className="flex flex-col gap-3">
        <p className="font-semibold">{t("guardian.notForYou")}</p>
        <p className="text-sm text-ink-2">{t("guardian.notForYouBody", { email: session.email ?? "" })}</p>
      </GlassCard>
    );
  }
  if (rel.status !== "pending") {
    return <GlassCard material="regular"><p>{t("guardian.used")}</p><Link href="/guardian" className="mt-3 inline-block font-semibold">{t("guardian.dashboard")}</Link></GlassCard>;
  }
  const { data: minor } = await supabase.from("public_profiles").select("display_name").eq("id", rel.minor_id).maybeSingle();
  return (
    <GlassCard material="elevated" radius="xl" className="flex flex-col gap-5">
      <ShieldCheck className="size-8 text-accent" />
      <div>
        <h1 className="fm-display text-[28px]">{t("guardian.title")}</h1>
        <p className="mt-2 text-[15px] text-ink-2">{t("guardian.intro", { name: (minor?.display_name as string) ?? "—" })}</p>
      </div>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
        <li>{t("guardian.point1")}</li>
        <li>{t("guardian.point2")}</li>
        <li>{t("guardian.point3")}</li>
      </ul>
      <AcceptGuardianForm token={token} needsBirthDate={!session.profile.birth_date} />
    </GlassCard>
  );
}
