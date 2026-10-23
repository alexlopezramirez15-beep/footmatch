"use client";

import { useRouter } from "next/navigation";
import { OpportunityForm } from "./opportunity-form";
import type { OpportunityRow, RequirementRow } from "@/lib/types";

/** Envoltorio cliente: tras guardar, navega al detalle. */
export function OpportunityEditor(props: {
  initial?: Partial<OpportunityRow>;
  initialRequirements?: RequirementRow[];
  defaults?: { country?: string | null; region?: string | null; city?: string | null; category?: string | null };
  submitLabel?: string;
}) {
  const router = useRouter();
  return <OpportunityForm {...props} onDone={(id) => { router.push(`/opportunities/${id}`); router.refresh(); }} />;
}
