import "server-only";
import { createClient } from "@/lib/supabase/server";
import { upcomingOccurrences } from "@/lib/schedule";
import { spDateKey } from "@/lib/week";

/** Aulas (e cancelamentos) visíveis ao usuário logado, opcionalmente de um aluno. */
export async function loadAgenda(opts: { studentId?: string; personalId?: string; days?: number }) {
  const supabase = await createClient();
  let q = supabase
    .from("class_schedules")
    .select(
      "*, student:profiles!class_schedules_student_id_fkey(id, full_name, phone), personal:profiles!class_schedules_personal_id_fkey(full_name)",
    )
    .order("weekday")
    .order("start_time");
  if (opts.studentId) q = q.eq("student_id", opts.studentId);
  if (opts.personalId) q = q.eq("personal_id", opts.personalId);
  const { data: schedules } = await q;
  const ids = (schedules ?? []).map((s) => s.id);
  const today = spDateKey();
  const { data: exceptions } = ids.length
    ? await supabase.from("class_exceptions").select("schedule_id, on_date, reason").in("schedule_id", ids).gte("on_date", today)
    : { data: [] };
  const occurrences = upcomingOccurrences(schedules ?? [], exceptions ?? [], today, opts.days ?? 14);
  return { schedules: schedules ?? [], occurrences, today };
}
