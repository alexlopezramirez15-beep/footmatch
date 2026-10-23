import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function GuardianLayout({ children }: LayoutProps<"/guardian">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-16" style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}>
      <div className="mb-8 flex items-center justify-between">
        <Link href="/"><Logo size={28} /></Link>
      </div>
      {children}
    </div>
  );
}
