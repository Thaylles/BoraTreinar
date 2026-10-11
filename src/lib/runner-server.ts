import "server-only";
import { loadPlan } from "@/lib/plans-server";
import { loadExerciseHistory } from "@/lib/history-server";
import { loadCatalogFor } from "@/lib/plans-server";
import type { RunnerExercise } from "@/components/workout/workout-runner";

/** Monta os exercícios da tela de execução a partir de uma ficha do aluno. */
export async function loadRunnerForPlan(planId: string, studentId: string) {
  const loaded = await loadPlan(planId);
  if (!loaded || loaded.plan.is_template || loaded.plan.student_id !== studentId) return null;
  const items = loaded.items.filter((i) => i.equipment);
  const history = await loadExerciseHistory(
    studentId,
    [...new Set(items.map((i) => i.equipment!.id))],
  );
  const exercises: RunnerExercise[] = items.map((i) => ({
    equipment: {
      id: i.equipment!.id,
      name: i.equipment!.name,
      muscle_group: i.equipment!.muscle_group,
      image_path: i.equipment!.image_path,
      image_url: i.equipment!.image_url,
      is_bodyweight: i.equipment!.is_bodyweight,
    },
    notes: i.notes,
    restSeconds: i.rest_seconds,
    targetSets: i.sets,
    repsMin: i.reps_min,
    repsMax: i.reps_max,
    suggestedLoad: i.suggested_load == null ? null : Number(i.suggested_load),
    history: history[i.equipment!.id] ?? { last: null, best: null },
  }));
  return { plan: loaded.plan, exercises };
}

export const FREE_MAX_EXERCISES = 20;

/**
 * Monta um treino livre a partir de IDs escolhidos pelo aluno.
 * Só entram exercícios do catálogo que o aluno enxerga (o banco valida de novo ao salvar).
 */
export async function loadRunnerForFree(studentId: string, equipmentIds: string[]) {
  const catalog = await loadCatalogFor(studentId);
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const chosen = [...new Set(equipmentIds)]
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .slice(0, FREE_MAX_EXERCISES);
  const history = await loadExerciseHistory(studentId, chosen.map((c) => c.id));
  const exercises: RunnerExercise[] = chosen.map((c) => ({
    equipment: c,
    notes: null,
    restSeconds: c.muscle_group === "cardio" ? 0 : 60,
    targetSets: c.muscle_group === "cardio" ? 1 : 3,
    repsMin: null,
    repsMax: null,
    suggestedLoad: c.is_bodyweight ? 0 : null,
    history: history[c.id] ?? { last: null, best: null },
  }));
  return { exercises, ignored: equipmentIds.length - chosen.length };
}
