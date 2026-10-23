import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getI18n } from "@/i18n/server";
import { ShieldCheck } from "lucide-react";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pb-10" style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}>
      <Link href="/" className="mt-4 mb-8 inline-flex">
        <Logo size={34} className="text-xl" />
      </Link>
      <div className="w-full max-w-[420px]">{children}</div>
      <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-ink-3">
        <ShieldCheck className="size-3.5" /> {t("auth.secure")}
      </p>
    </div>
  );
}
