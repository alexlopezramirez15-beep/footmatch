"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { motion } from "motion/react";
import { AtSign, Lock, MailCheck, UserRound } from "lucide-react";
import { GlassButton, GlassCard } from "@/components/glass/primitives";
import { GlassField, GlassInput } from "@/components/glass/forms";
import { useI18n } from "@/i18n/client";
import {
  forgotPasswordAction, loginAction, registerAction, resetPasswordAction, type AuthState,
} from "@/domains/auth/actions";
import { fadeUp } from "@/components/glass/tokens";

function FormError({ code }: { code?: string }) {
  const { t } = useI18n();
  if (!code) return null;
  return (
    <div role="alert" className="glass glass-tint-red rounded-2xl px-4 py-3 text-sm font-medium text-danger">
      {t(code)}
    </div>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show">
      <GlassCard material="elevated" radius="xl" className="p-6 sm:p-8">
        <h1 className="fm-display text-[30px]">{title}</h1>
        {subtitle ? <p className="mt-2 text-[15px] text-ink-2">{subtitle}</p> : null}
        <div className="mt-7">{children}</div>
      </GlassCard>
    </motion.div>
  );
}

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <Shell title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")}>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError code={state?.error ?? (linkError ? "auth.linkError" : undefined)} />
        <input type="hidden" name="next" value={next ?? "/home"} />
        <GlassField label={t("auth.email")} htmlFor="email" error={fe.email ? t(fe.email) : null}>
          <GlassInput id="email" name="email" type="email" autoComplete="email" inputMode="email" required leading={<AtSign className="size-4" />} invalid={!!fe.email} data-autofocus />
        </GlassField>
        <GlassField label={t("auth.password")} htmlFor="password" error={fe.password ? t(fe.password) : null}>
          <GlassInput id="password" name="password" type="password" autoComplete="current-password" required leading={<Lock className="size-4" />} invalid={!!fe.password} />
        </GlassField>
        <Link href="/forgot-password" className="self-end text-sm font-medium text-accent-strong dark:text-accent">
          {t("auth.forgot")}
        </Link>
        <GlassButton type="submit" variant="primary" size="lg" loading={pending} className="mt-1 w-full justify-center">
          {t("auth.login")}
        </GlassButton>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-ink underline-offset-4 hover:underline">
          {t("auth.register")}
        </Link>
      </p>
    </Shell>
  );
}

export function RegisterForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(registerAction, undefined);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok) {
    return (
      <Shell title={t("auth.checkEmailTitle")}>
        <div className="flex flex-col items-center text-center">
          <div className="glass glass-tint-green mb-5 flex size-16 items-center justify-center rounded-[22px]">
            <MailCheck className="size-7" />
          </div>
          <p className="text-[15px] text-ink-2">{t("auth.checkEmailBody", { email: state.email })}</p>
          <Link href="/login" className="mt-6 text-sm font-semibold">{t("auth.backToLogin")}</Link>
        </div>
      </Shell>
    );
  }
  return (
    <Shell title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")}>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError code={state?.error} />
        <GlassField label={t("auth.fullName")} htmlFor="full_name" error={fe.full_name ? t(fe.full_name) : null}>
          <GlassInput id="full_name" name="full_name" autoComplete="name" required leading={<UserRound className="size-4" />} invalid={!!fe.full_name} data-autofocus />
        </GlassField>
        <GlassField label={t("auth.email")} htmlFor="email" error={fe.email ? t(fe.email) : null}>
          <GlassInput id="email" name="email" type="email" autoComplete="email" inputMode="email" required leading={<AtSign className="size-4" />} invalid={!!fe.email} />
        </GlassField>
        <GlassField label={t("auth.password")} htmlFor="password" hint={t("auth.passwordHint")} error={fe.password ? t(fe.password) : null}>
          <GlassInput id="password" name="password" type="password" autoComplete="new-password" required minLength={8} leading={<Lock className="size-4" />} invalid={!!fe.password} />
        </GlassField>
        <label className="flex items-start gap-3 px-1 text-sm text-ink-2">
          <input type="checkbox" name="terms" className="mt-0.5 size-5 shrink-0 accent-[var(--fm-accent)]" required />
          <span>
            <Link href="/legal/terms" className="underline underline-offset-2">{t("auth.acceptTerms")}</Link>
          </span>
        </label>
        {fe.terms ? <p role="alert" className="px-1 text-[13px] font-medium text-danger">{t(fe.terms)}</p> : null}
        <p className="glass glass-tint-blue rounded-2xl px-4 py-3 text-[13px] text-ink-2">{t("auth.minorNotice")}</p>
        <GlassButton type="submit" variant="primary" size="lg" loading={pending} className="mt-1 w-full justify-center">
          {t("auth.register")}
        </GlassButton>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">{t("auth.login")}</Link>
      </p>
    </Shell>
  );
}

export function ForgotForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotPasswordAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <Shell title={t("auth.forgotTitle")} subtitle={t("auth.forgotSubtitle")}>
      {state?.ok ? (
        <p role="status" className="glass glass-tint-green rounded-2xl px-4 py-3 text-sm font-medium">{t("auth.linkSent")}</p>
      ) : (
        <form action={action} className="flex flex-col gap-4" noValidate>
          <FormError code={state?.error} />
          <GlassField label={t("auth.email")} htmlFor="email" error={fe.email ? t(fe.email) : null}>
            <GlassInput id="email" name="email" type="email" autoComplete="email" required leading={<AtSign className="size-4" />} data-autofocus />
          </GlassField>
          <GlassButton type="submit" variant="primary" size="lg" loading={pending} className="w-full justify-center">{t("auth.sendLink")}</GlassButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-semibold">{t("auth.backToLogin")}</Link></p>
    </Shell>
  );
}

export function ResetForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPasswordAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <Shell title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")}>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError code={state?.error} />
        <GlassField label={t("auth.newPassword")} htmlFor="password" hint={t("auth.passwordHint")} error={fe.password ? t(fe.password) : null}>
          <GlassInput id="password" name="password" type="password" autoComplete="new-password" required leading={<Lock className="size-4" />} data-autofocus />
        </GlassField>
        <GlassButton type="submit" variant="primary" size="lg" loading={pending} className="w-full justify-center">{t("auth.updatePassword")}</GlassButton>
      </form>
    </Shell>
  );
}
