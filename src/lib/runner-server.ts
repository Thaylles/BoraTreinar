import "server-only";
import { loadPlan } from "@/lib/plans-server";
import { loadDoneEquipmentIds, loadExerciseHistory } from "@/lib/history-server";
import { loadCatalogFor } from "@/lib/plans-server";
import type { RunnerExercise, SwapOption } from "@/components/workout/workout-runner";
import type { CatalogItem } from "@/components/plans/exercise-picker";
import { rankAlternatives } from "@/lib/swaps";
import { groupedWithNext } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/exercise-media";

/** Monta os exercícios da tela de execução a partir de uma ficha do aluno. */
export async function loadRunnerForPlan(planId: string, studentId: string) {
  const loaded = await loadPlan(planId);
  if (!loaded || loaded.plan.is_template || loaded.plan.student_id !== studentId) return null;
  return buildRunner(loaded, studentId);
}

/** Personal treinando com um dos próprios modelos ("Meu treino"). */
export async function loadRunnerForTemplate(templateId: string, userId: string) {
  const loaded = await loadPlan(templateId);
  if (!loaded || !loaded.plan.is_template || loaded.plan.created_by !== userId) return null;
  return buildRunner(loaded, userId);
}

async function buildRunner(loaded: NonNullable<Awaited<ReturnType<typeof loadPlan>>>, studentId: string) {
  const items = loaded.items.filter((i) => i.equipment);
  const grouped = groupedWithNext(items.map((i) => i.technique));
  const history = await loadExerciseHistory(
    studentId,
    [...new Set(items.map((i) => i.equipment!.id))],
  );
  const exercises: RunnerExercise[] = items.map((i, idx) => ({
    equipment: {
      id: i.equipment!.id,
      name: i.equipment!.name,
      muscle_group: i.equipment!.muscle_group,
      image_path: i.equipment!.image_path,
      image_url: i.equipment!.image_url,
      is_bodyweight: i.equipment!.is_bodyweight,
      intensity_unit: i.equipment!.intensity_unit,
    },
    notes: i.notes,
    restSeconds: i.rest_seconds,
    targetSets: i.sets,
    repsMin: i.reps_min,
    repsMax: i.reps_max,
    suggestedLoad: i.suggested_load == null ? null : Number(i.suggested_load),
    history: history[i.equipment!.id] ?? { last: null, best: null },
    technique: i.technique,
    groupedNext: grouped[idx],
  }));
  await attachSwaps(exercises, studentId, items.map((i) => i.substitute ?? null));
  await attachDemos(exercises);
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
  await attachSwaps(exercises, studentId, exercises.map(() => null), catalog);
  await attachDemos(exercises);
  return { exercises, ignored: equipmentIds.length - chosen.length };
}

const toRunnerEquipment = (c: CatalogItem): RunnerExercise["equipment"] => ({
  id: c.id,
  name: c.name,
  muscle_group: c.muscle_group,
  image_path: c.image_path,
  image_url: c.image_url,
  is_bodyweight: c.is_bodyweight,
  intensity_unit: c.intensity_unit ?? null,
});

/**
 * "Aparelho ocupado": cada exercício recebe o substituto indicado pelo Personal (se houver) ou até 6
 * candidatos do mesmo grupo muscular (a IA escolhe 1–2 na hora). Já vem com o histórico do aluno.
 */
async function attachSwaps(exercises: RunnerExercise[], studentId: string, substitutes: (CatalogItem | null)[], catalog?: CatalogItem[]) {
  const [cat, known] = await Promise.all([catalog ? Promise.resolve(catalog) : loadCatalogFor(studentId), loadDoneEquipmentIds(studentId)]);
  const inWorkout = new Set(exercises.map((e) => e.equipment.id));
  const picks = exercises.map((e, i) =>
    substitutes[i] ? [substitutes[i]!] : rankAlternatives(e.equipment, cat, { exclude: inWorkout, known, limit: 6 }),
  );
  const ids = [...new Set(picks.flat().map((c) => c.id))];
  const history = ids.length ? await loadExerciseHistory(studentId, ids) : {};
  const option = (c: CatalogItem): SwapOption => ({ equipment: toRunnerEquipment(c), history: history[c.id] ?? { last: null, best: null } });
  exercises.forEach((e, i) => {
    if (substitutes[i]) e.substitute = option(substitutes[i]!);
    else e.alternatives = picks[i].map(option);
  });
}

/** Execução aprovada pelo admin (GIF/vídeo) de cada exercício, inclusive substitutos e alternativas. */
async function attachDemos(exercises: RunnerExercise[]) {
  const all = exercises.flatMap((e) => [e.equipment, e.substitute?.equipment, ...(e.alternatives ?? []).map((a) => a.equipment)]);
  const eqs = all.filter((x): x is RunnerExercise["equipment"] => !!x);
  if (!eqs.length) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercise_media")
    .select("equipment_id, path, kind")
    .eq("status", "aprovado")
    .in("equipment_id", [...new Set(eqs.map((x) => x.id))]);
  const byId = new Map((data ?? []).filter((m) => m.path).map((m) => [m.equipment_id, { url: mediaUrl(m.path!), kind: m.kind }]));
  for (const x of eqs) x.demo = byId.get(x.id) ?? null;
}
