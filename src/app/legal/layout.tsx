import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function LegalLayout({ children }: LayoutProps<"/legal">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16" style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}>
      <Link href="/" className="mb-8 inline-flex"><Logo size={28} /></Link>
      {children}
    </div>
  );
}
