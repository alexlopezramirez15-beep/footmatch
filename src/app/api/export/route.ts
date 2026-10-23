import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Derecho de acceso y portabilidad (RGPD art. 15 y 20): exporta los datos propios en JSON. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = auth.user.id;
  const tables: Array<[string, string]> = [
    ["profiles", "id"], ["user_roles", "user_id"], ["player_profiles", "user_id"], ["coach_profiles", "user_id"], ["agent_profiles", "user_id"],
    ["scout_profiles", "user_id"], ["player_careers", "player_id"], ["player_statistics", "player_id"], ["media_assets", "owner_id"],
    ["applications", "applicant_id"], ["interests", "actor_id"], ["favorites", "user_id"], ["trial_applications", "player_id"],
    ["notifications", "user_id"], ["legal_consents", "user_id"], ["guardian_relationships", "minor_id"], ["blocks", "blocker_id"], ["reports", "reporter_id"],
  ];
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user: { id: uid, email: auth.user.email } };
  for (const [table, col] of tables) {
    const { data } = await supabase.from(table).select("*").eq(col, uid);
    out[table] = data ?? [];
  }
  const { data: msgs } = await supabase.from("messages").select("id, conversation_id, kind, body, created_at").eq("sender_id", uid);
  out.messages_sent = msgs ?? [];
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="footmatch-datos-${uid.slice(0, 8)}.json"`, "cache-control": "no-store" },
  });
}
