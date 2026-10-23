import { GlassNavbar } from "@/components/glass/navigation";
import { NotificationList } from "@/components/notifications/list";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import type { NotificationRow } from "@/lib/types";

export const metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  const session = await requireApp();
  const supabase = await createClient();
  const { t } = await getI18n();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(100);
  return (
    <>
      <GlassNavbar title={t("nav.notifications")} />
      <NotificationList items={(data ?? []) as NotificationRow[]} />
    </>
  );
}
