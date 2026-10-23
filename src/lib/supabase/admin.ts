import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Cliente con service role. SÓLO para operaciones que la base de datos no
 * puede hacer con la sesión del usuario (p. ej. borrar el usuario de auth.users).
 * Devuelve null si SUPABASE_SERVICE_ROLE_KEY no está configurada.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
