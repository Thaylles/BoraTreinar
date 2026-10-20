import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function loadSession(sessionId: string) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("workout_sessions")
    .select("*, logger:profiles!workout_sessions_logged_by_fkey(full_name, role)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;
  const { data: sets } = await supabase
    .from("session_sets")
    .select("*, equipment:equipment!session_sets_equipment_id_fkey(id, name, muscle_group, image_path, image_url)")
    .eq("session_id", sessionId)
    .order("exercise_order")
    .order("set_number");

  const groups: { order: number; equipment: NonNullable<NonNullable<typeof sets>[number]["equipment"]> | null; equipmentId: string; sets: NonNullable<typeof sets> }[] = [];
  for (const s of sets ?? []) {
    let g = groups.find((x) => x.order === s.exercise_order);
    if (!g) groups.push((g = { order: s.exercise_order, equipment: s.equipment, equipmentId: s.equipment_id, sets: [] }));
    g.sets.push(s);
  }
  return { session, exercises: groups };
}

export async function listSessions(studentId: string, limit = 30) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_sessions")
    .select("id, plan_name, kind, started_at, duration_seconds, logged_by, student_id, effort, pain, sets:session_sets(done, is_pr)")
    .eq("student_id", studentId)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((s) => ({
    ...s,
    doneSets: s.sets.filter((x) => x.done).length,
    hasPr: s.sets.some((x) => x.is_pr),
    byInstructor: s.logged_by !== null && s.logged_by !== s.student_id,
  }));
}

/** Histórico completo de um exercício para o aluno: uma linha por treino. */
export async function loadExerciseTimeline(studentId: string, equipmentId: string) {
  const supabase = await createClient();
  const [{ data: equipment }, { data: rows }] = await Promise.all([
    supabase.from("equipment").select("*").eq("id", equipmentId).maybeSingle(),
    supabase
      .from("session_sets")
      .select("load_kg, reps, done, is_pr, set_number, session:workout_sessions!inner(id, started_at, student_id, plan_name)")
      .eq("session.student_id", studentId)
      .eq("equipment_id", equipmentId)
      .limit(5000),
  ]);
  const bySession = new Map<string, { id: string; date: string; planName: string | null; sets: { load: number; reps: number; done: boolean; pr: boolean }[] }>();
  for (const r of rows ?? []) {
    if (!r.session) continue;
    const key = r.session.id;
    if (!bySession.has(key)) bySession.set(key, { id: key, date: r.session.started_at, planName: r.session.plan_name, sets: [] });
    bySession.get(key)!.sets.push({ load: Number(r.load_kg), reps: r.reps, done: r.done, pr: r.is_pr });
  }
  const entries = [...bySession.values()]
    .map((e) => {
      const done = e.sets.filter((s) => s.done);
      return {
        ...e,
        maxLoad: done.length ? Math.max(...done.map((s) => s.load)) : 0,
        volume: done.reduce((acc, s) => acc + s.load * s.reps, 0),
        pr: e.sets.some((s) => s.pr),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const best = entries.length ? Math.max(...entries.map((e) => e.maxLoad)) : 0;
  return { equipment, entries, best };
}
