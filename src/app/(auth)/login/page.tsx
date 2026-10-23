import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/forms";
import { SetupNotice } from "@/components/app/setup-notice";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  if (await getSession()) redirect("/home");
  return (
    <>
      {!isSupabaseConfigured ? <SetupNotice /> : null}
      <LoginForm next={typeof sp.next === "string" ? sp.next : undefined} linkError={sp.error === "link"} />
    </>
  );
}
