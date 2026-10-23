import { redirect } from "next/navigation";
import { ResetForm } from "@/components/auth/forms";
import { getSession } from "@/lib/session";

export const metadata = { title: "Nueva contraseña" };

export default async function ResetPage() {
  // Llega aquí tras /auth/callback con una sesión de recuperación válida.
  if (!(await getSession())) redirect("/forgot-password");
  return <ResetForm />;
}
