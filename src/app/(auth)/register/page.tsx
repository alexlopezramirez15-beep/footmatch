import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/forms";
import { SetupNotice } from "@/components/app/setup-notice";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Registro" };

export default async function RegisterPage() {
  if (await getSession()) redirect("/home");
  return (
    <>
      {!isSupabaseConfigured ? <SetupNotice /> : null}
      <RegisterForm />
    </>
  );
}
