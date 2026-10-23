"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Download, KeyRound, LogOut, Trash2 } from "lucide-react";
import { GlassAvatar, GlassButton, GlassCard, GlassSegmentedControl } from "@/components/glass/primitives";
import { GlassField, GlassInput, GlassSelect, GlassSwitch } from "@/components/glass/forms";
import { GlassModal, useToast } from "@/components/glass/overlays";
import { useTheme, type ThemePref } from "@/components/theme/theme";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { saveNotificationPrefsAction, savePrivacyAction, setLocaleAction } from "@/domains/settings/actions";
import { unblockUserAction } from "@/domains/safety/actions";
import { deleteAccountAction, type AuthState } from "@/domains/auth/actions";

export function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="fm-eyebrow mb-2 px-1">{title}</h2>
      <GlassCard material="regular" className="flex flex-col gap-2">{children}</GlassCard>
    </section>
  );
}

export function AppearancePanel() {
  const { t, locale } = useI18n();
  const { pref, setPref } = useTheme();
  const router = useRouter();
  return (
    <>
      <GlassField label={t("settings.theme")}>
        <GlassSegmentedControl<ThemePref>
          id="theme"
          options={[{ value: "light", label: t("common.lightMode") }, { value: "dark", label: t("common.darkMode") }, { value: "system", label: t("common.systemMode") }]}
          value={pref}
          onChange={setPref}
        />
      </GlassField>
      <GlassField label={t("settings.language")}>
        <GlassSelect value={locale} onChange={async (e) => { await setLocaleAction(e.target.value); router.refresh(); }}>
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
        </GlassSelect>
      </GlassField>
    </>
  );
}

const CATS = ["matches", "messages", "applications", "opportunities", "interests", "trials"] as const;

export function NotificationsPanel({ prefs, readReceipts }: { prefs: Record<string, boolean>; readReceipts: boolean }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [p, setP] = React.useState<Record<string, boolean>>(() => Object.fromEntries(CATS.map((c) => [c, prefs?.[c] !== false])));
  const [rr, setRr] = React.useState(readReceipts);
  const save = async (next: Record<string, boolean>, nextRr: boolean) => {
    const res = await saveNotificationPrefsAction(next, nextRr);
    if (!res.ok) push({ tone: "error", title: t(res.error) });
  };
  return (
    <>
      {CATS.map((c) => (
        <GlassSwitch key={c} checked={p[c]} label={t(`settings.notif.${c}`)} onChange={(v) => { const n = { ...p, [c]: v }; setP(n); save(n, rr); }} />
      ))}
      <p className="px-1 text-xs text-ink-3">{t("settings.notifSecurity")}</p>
      <div className="border-t border-[var(--fm-hairline)] pt-2">
        <GlassSwitch checked={rr} label={t("settings.readReceipts")} description={t("settings.readReceiptsHint")} onChange={(v) => { setRr(v); save(p, v); }} />
      </div>
    </>
  );
}

export function PrivacyPanel({ visibility, allowAgent, isMinor }: { visibility: "public" | "clubs_only" | "hidden"; allowAgent: boolean; isMinor: boolean }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [v, setV] = React.useState(visibility);
  const [a, setA] = React.useState(allowAgent);
  const save = async (vis: typeof v, agent: boolean) => {
    const res = await savePrivacyAction({ visibility: vis, allow_agent_contact: agent });
    push(res.ok ? { tone: "success", title: t("common.saved") } : { tone: "error", title: t(res.error) });
  };
  const opts = (["public", "clubs_only", "hidden"] as const).filter((x) => !(isMinor && x === "public"));
  return (
    <>
      <GlassField label={t("settings.visibility")} hint={isMinor ? t("settings.visibilityMinor") : t(`settings.vis.${v}Hint`)}>
        <GlassSegmentedControl id="visibility" options={opts.map((x) => ({ value: x, label: t(`settings.vis.${x}`) }))} value={v} onChange={(x) => { setV(x); save(x, a); }} />
      </GlassField>
      {!isMinor ? <GlassSwitch checked={a} label={t("settings.allowAgents")} description={t("settings.allowAgentsHint")} onChange={(x) => { setA(x); save(v, x); }} /> : null}
    </>
  );
}

export function BlockedList({ items }: { items: Array<{ id: string; name: string }> }) {
  const { t } = useI18n();
  const router = useRouter();
  const [list, setList] = React.useState(items);
  if (!list.length) return <p className="py-1 text-sm text-ink-2">{t("settings.noBlocked")}</p>;
  return (
    <ul className="divide-y divide-[var(--fm-hairline)]">
      {list.map((b) => (
        <li key={b.id} className="flex items-center gap-3 py-2.5">
          <GlassAvatar name={b.name} seed={b.id} size={34} />
          <span className="flex-1 truncate font-medium">{b.name}</span>
          <GlassButton size="sm" variant="ghost" onClick={async () => { const r = await unblockUserAction(b.id); if (r.ok) { setList((l) => l.filter((x) => x.id !== b.id)); router.refresh(); } }}>{t("common.unblock")}</GlassButton>
        </li>
      ))}
    </ul>
  );
}

export function AccountPanel({ email }: { email: string | null }) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState<AuthState, FormData>(deleteAccountAction, undefined);
  return (
    <>
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="min-w-0"><p className="text-[13px] text-ink-2">{t("auth.email")}</p><p className="truncate font-medium">{email}</p></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/reset-password"><GlassButton variant="glass" className="w-full"><KeyRound className="size-4" /> {t("settings.changePassword")}</GlassButton></Link>
        <a href="/api/export" download><GlassButton variant="glass" className="w-full"><Download className="size-4" /> {t("settings.exportData")}</GlassButton></a>
        <form action="/auth/signout" method="post"><GlassButton type="submit" variant="glass" className="w-full"><LogOut className="size-4" /> {t("nav.logout")}</GlassButton></form>
        <GlassButton variant="danger" onClick={() => setOpen(true)}><Trash2 className="size-4" /> {t("settings.deleteAccount")}</GlassButton>
      </div>
      <GlassModal open={open} onClose={() => setOpen(false)} title={t("settings.deleteAccount")}>
        <form action={action} className="flex flex-col gap-4">
          <p className="text-[15px] text-ink-2">{t("settings.deleteBody")}</p>
          <GlassField label={t("settings.deleteType")} error={state?.error ? t(state.error) : null}>
            <GlassInput name="confirm" autoComplete="off" placeholder="DELETE" />
          </GlassField>
          <div className="flex gap-3">
            <GlassButton type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>{t("common.cancel")}</GlassButton>
            <GlassButton type="submit" variant="danger" className="flex-1" loading={pending}>{t("common.delete")}</GlassButton>
          </div>
        </form>
      </GlassModal>
    </>
  );
}
