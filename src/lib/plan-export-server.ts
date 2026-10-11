import "server-only";
import { groupLabel } from "@/lib/catalog";
import { loadPlan } from "@/lib/plans-server";
import { techniqueInfo } from "@/lib/plans";
import type { ExportPlan } from "@/lib/plan-export";

/** Ficha para exportar. O RLS garante que só o aluno e seus Personais (ou o dono do modelo) a leem. */
export async function loadExportPlan(planId: string): Promise<ExportPlan | null> {
  const loaded = await loadPlan(planId);
  if (!loaded) return null;
  const { plan, items } = loaded;
  return {
    name: plan.name,
    goal: plan.goal,
    notes: plan.notes,
    validUntil: plan.valid_until,
    studentName: plan.student?.full_name ?? null,
    creatorName: plan.creator?.full_name ?? null,
    items: items.map((it) => ({
      name: it.equipment?.name ?? "Exercício",
      group: it.equipment ? groupLabel(it.equipment.muscle_group) : "",
      sets: it.sets,
      repsMin: it.reps_min,
      repsMax: it.reps_max,
      load: it.suggested_load === null ? null : Number(it.suggested_load),
      bodyweight: !!it.equipment?.is_bodyweight,
      rest: it.rest_seconds,
      notes: [techniqueInfo(it.technique)?.label, it.notes].filter(Boolean).join(" · ") || null,
    })),
  };
}

export function attachment(name: string, ext: "pdf" | "csv") {
  return `attachment; filename="${name}.${ext}"; filename*=UTF-8''${encodeURIComponent(`${name}.${ext}`)}`;
}
