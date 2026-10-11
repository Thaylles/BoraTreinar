import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listWeights } from "@/lib/weight-server";
import { computeDashboard, periodFor, weightChange, type PeriodKind, type SummarySession } from "@/lib/stats";
import { spDateKey } from "@/lib/week";

/** Dados do dashboard de um aluno. O RLS decide o que o usuário logado pode ver (inclusive o peso). */
export async function loadDashboard(studentId: string, kind: PeriodKind, ref?: string) {
  const today = spDateKey();
  const period = periodFor(kind, ref && /^\d{4}-\d{2}-\d{2}$/.test(ref) ? ref : today);
  const supabase = await createClient();
  const [{ data: summary }, weights] = await Promise.all([
    supabase.rpc("training_summary", { p_student: studentId }),
    listWeights(studentId, 400),
  ]);
  const sessions = (summary ?? []) as unknown as SummarySession[];
  const dashboard = computeDashboard(sessions, period, today);

  const ids = dashboard.progress.map((p) => p.id);
  const { data: equipment } = ids.length
    ? await supabase.from("equipment").select("id, name, muscle_group").in("id", ids)
    : { data: [] };
  const names = Object.fromEntries((equipment ?? []).map((e) => [e.id, e.name]));

  // Gráfico de peso: últimos 120 dias até o fim do período.
  const chartFrom = new Date(Date.parse(`${period.to}T12:00:00Z`) - 120 * 86_400_000).toISOString().slice(0, 10);
  const weightPoints = weights
    .filter((w) => w.measured_on >= chartFrom && w.measured_on <= period.to)
    .map((w) => ({ date: w.measured_on, value: w.weight_kg }))
    .reverse();

  return {
    today,
    period,
    dashboard,
    names,
    hasAnySession: sessions.length > 0,
    weight: { points: weightPoints, change: weightChange(weights, period), visible: weights.length > 0 },
  };
}
