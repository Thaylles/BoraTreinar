import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CardioSet } from "@/lib/cardio";

export type LastPerformance = {
  date: string;
  /** Séries feitas; no cardio vêm também tempo, distância e intensidade. */
  sets: ({ load: number; reps: number } & Partial<CardioSet>)[];
};

export type ExerciseHistoryInfo = {
  last: LastPerformance | null;
  best: number | null;
};

/**
 * Última execução (séries feitas) e recorde de cada exercício para o aluno.
 * O RLS garante que só quem pode ver o aluno recebe os dados.
 */
export async function loadExerciseHistory(
  studentId: string,
  equipmentIds: string[],
): Promise<Record<string, ExerciseHistoryInfo>> {
  const result: Record<string, ExerciseHistoryInfo> = {};
  if (!equipmentIds.length) return result;
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_sets")
    .select("equipment_id, load_kg, reps, duration_min, distance_km, speed_kmh, incline_pct, level, set_number, exercise_order, session_id, session:workout_sessions!inner(started_at, student_id)")
    .eq("session.student_id", studentId)
    .in("equipment_id", equipmentIds)
    .eq("done", true)
    .limit(5000);

  const rows = (data ?? []).filter((r) => r.session);
  for (const id of equipmentIds) {
    const mine = rows.filter((r) => r.equipment_id === id);
    if (!mine.length) {
      result[id] = { last: null, best: null };
      continue;
    }
    const lastStart = mine.reduce((acc, r) => (r.session!.started_at > acc ? r.session!.started_at : acc), "");
    const lastSets = mine
      .filter((r) => r.session!.started_at === lastStart)
      .sort((a, b) => a.exercise_order - b.exercise_order || a.set_number - b.set_number)
      .map((r) => ({
        load: Number(r.load_kg),
        reps: r.reps,
        minutes: r.duration_min == null ? null : Number(r.duration_min),
        km: r.distance_km == null ? null : Number(r.distance_km),
        speed: r.speed_kmh == null ? null : Number(r.speed_kmh),
        incline: r.incline_pct == null ? null : Number(r.incline_pct),
        level: r.level,
      }));
    const best = Math.max(...mine.map((r) => Number(r.load_kg)));
    result[id] = { last: { date: lastStart, sets: lastSets }, best: best > 0 ? best : null };
  }
  return result;
}
