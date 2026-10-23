import { GlassNavbar } from "@/components/glass/navigation";
import { ChatList } from "@/components/chat/chat-list";
import { requireApp } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { listConversations } from "@/domains/chat/queries";

export const metadata = { title: "Mensajes" };

export default async function ChatsPage() {
  const session = await requireApp();
  const supabase = await createClient();
  const { t } = await getI18n();
  const items = await listConversations(supabase, session);
  return (
    <>
      <GlassNavbar title={t("nav.chats")} subtitle={t("chat.subtitle")} />
      <ChatList items={items} />
    </>
  );
}
