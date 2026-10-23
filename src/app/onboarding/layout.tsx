import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { requireSession } from "@/lib/session";

export default async function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  await requireSession();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-16" style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/onboarding"><Logo size={28} /></Link>
        <form action="/auth/signout" method="post">
          <button className="text-sm font-medium text-ink-2 hover:text-ink">↩</button>
        </form>
      </div>
      {children}
    </div>
  );
}
