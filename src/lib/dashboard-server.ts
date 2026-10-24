import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listWeights } from "@/lib/weight-server";
import { computeDashboard, periodFor, weightChange, type PeriodKind, type SummarySession } from "@/lib/stats";
import { addDays, mondayOf } from "@/lib/schedule";
import { spDateKey } from "@/lib/week";
import { stagnationAlerts, strengthTrends, weeklyVolumeByGroup } from "@/lib/evolution";

/** Dados do dashboard de um aluno. O RLS decide o que o usuário logado pode ver (inclusive o peso). */
export async function loadDashboard(studentId: string, kind: PeriodKind, ref?: string, opts: { insights?: boolean } = {}) {
  const today = spDateKey();
  const period = periodFor(kind, ref && /^\d{4}-\d{2}-\d{2}$/.test(ref) ? ref : today);
  const supabase = await createClient();
  const [{ data: summary }, weights] = await Promise.all([
    supabase.rpc("training_summary", { p_student: studentId }),
    listWeights(studentId, 400),
  ]);
  const sessions = (summary ?? []) as unknown as SummarySession[];
  const dashboard = computeDashboard(sessions, period, today);

  // Para o Personal: volume por grupo, força estimada e exercícios parados (sempre em relação a hoje).
  const trends = opts.insights ? strengthTrends(sessions, today) : [];
  const stagnant = opts.insights ? stagnationAlerts(sessions, today) : [];
  const recentFrom = addDays(mondayOf(today), -21);
  const recentIds = opts.insights ? sessions.filter((s) => s.date >= recentFrom).flatMap((s) => s.ex.map((x) => x.e)) : [];
  const ids = [...new Set([...dashboard.progress.map((p) => p.id), ...trends.map((t) => t.id), ...stagnant.map((t) => t.id), ...recentIds])];
  const { data: equipment } = ids.length
    ? await supabase.from("equipment").select("id, name, muscle_group").in("id", ids)
    : { data: [] };
  const names = Object.fromEntries((equipment ?? []).map((e) => [e.id, e.name]));
  const insights = opts.insights
    ? {
        trends,
        stagnant,
        volume: weeklyVolumeByGroup(sessions, Object.fromEntries((equipment ?? []).map((e) => [e.id, e.muscle_group])), today),
      }
    : null;

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
    insights,
    weight: { points: weightPoints, change: weightChange(weights, period), visible: weights.length > 0 },
  };
}
