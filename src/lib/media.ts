import { SUPABASE_URL } from "@/lib/supabase/env";

import type { SupabaseClient } from "@supabase/supabase-js";

type StorageClient = Pick<SupabaseClient, "storage">;

export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/public-assets/${path}`;
}

/** URLs firmadas (1 h) para medios privados de jugadores. La política de storage decide quién puede verlos. */
export async function signPlayerMedia(supabase: StorageClient, paths: Array<string | null | undefined>): Promise<Record<string, string>> {
  const list = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (!list.length) return {};
  const { data } = await supabase.storage.from("player-media").createSignedUrls(list, 3600);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}
