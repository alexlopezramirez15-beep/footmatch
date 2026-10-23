import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/forms";
import { SetupNotice } from "@/components/app/setup-notice";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Registro" };

export default async function RegisterPage(props: PageProps<"/register">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : undefined;
  if (await getSession()) redirect(next ?? "/home");
  return (
    <>
      {!isSupabaseConfigured ? <SetupNotice /> : null}
      <RegisterForm next={next} />
    </>
  );
}
