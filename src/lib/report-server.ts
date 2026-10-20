import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { periodFor, type SummarySession } from "@/lib/stats";
import {
  buildStudentReport,
  reportHtml,
  ruleMotivation,
  ruleSuggestions,
  weekDetail,
  type ReportContent,
  type ReportStudent,
  type WeekSessionRow,
  type WeekSetRow,
} from "@/lib/report";
import { parseCardioWeek, type CardioWeek } from "@/lib/cardio";
import { aiSuggestions } from "@/lib/report-ai";
import { spDateKey } from "@/lib/week";

type Result = { personals: number; reports: number; emails: number; ai: number };

/**
 * Gera (ou atualiza) o relatório da semana atual (seg–dom, fuso SP) de cada Personal.
 * Roda com service role, então a privacidade do peso é aplicada aqui: só entra com permissão do aluno.
 * Com `deliver`, envia o e-mail e a notificação uma única vez por semana.
 */
const WEEK_SET_COLS = "session_id, equipment_id, done, reps, duration_min, distance_km, speed_kmh, incline_pct, level";

/** Séries da semana; tolera o banco ainda sem a coluna de substituição (migração pendente). */
async function loadWeekSets(admin: ReturnType<typeof createAdminClient>, sessionIds: string[]): Promise<{ data: WeekSetRow[] | null }> {
  const withSwap = await admin.from("session_sets").select(`${WEEK_SET_COLS}, replaced_equipment_id`).in("session_id", sessionIds);
  if (!withSwap.error) return { data: withSwap.data as unknown as WeekSetRow[] };
  return admin.from("session_sets").select(WEEK_SET_COLS).in("session_id", sessionIds);
}

export async function generateWeeklyReports(opts: { personalId?: string; deliver: boolean }): Promise<Result> {
  const admin = createAdminClient();
  const today = spDateKey();
  const period = periodFor("semana", today);
  const result: Result = { personals: 0, reports: 0, emails: 0, ai: 0 };

  let q = admin.from("profiles").select("id, full_name").in("role", ["personal", "admin"]);
  if (opts.personalId) q = q.eq("id", opts.personalId);
  const { data: personals, error } = await q;
  if (error) throw new Error(error.message);

  for (const personal of personals ?? []) {
    result.personals++;
    const { data: links } = await admin
      .from("personal_students")
      .select("student_id, student:profiles!personal_students_student_id_fkey(full_name)")
      .eq("personal_id", personal.id)
      .eq("status", "ativo")
      .is("archived_at", null);
    if (!links?.length) continue;

    const ids = links.map((l) => l.student_id);
    // A semana em São Paulo: segunda 00:00 (-03:00) até a segunda seguinte.
    const fromIso = `${period.from}T00:00:00-03:00`;
    const toIso = new Date(Date.parse(`${period.to}T00:00:00-03:00`) + 86_400_000).toISOString();
    const [{ data: settings }, summaries, { data: weekSessions }, cardioWeeks, { data: unlocked }] = await Promise.all([
      admin.from("student_settings").select("student_id, weight_visible_to_personal, weekly_goal").in("student_id", ids),
      Promise.all(ids.map((id) => admin.rpc("training_summary", { p_student: id }).then((r) => (r.data ?? []) as unknown as SummarySession[]))),
      admin
        .from("workout_sessions")
        .select("id, student_id, plan_id, plan_name, started_at, duration_seconds, effort, pain, feedback")
        .in("student_id", ids)
        .gte("started_at", fromIso)
        .lt("started_at", toIso),
      Promise.all(
        ids.map((id) =>
          admin.rpc("cardio_week", { p_student: id, p_day: period.from }).then((r): CardioWeek | null => (r.data ? parseCardioWeek(r.data) : null)),
        ),
      ),
      admin
        .from("student_achievements")
        .select("student_id, unlocked_at, achievement:achievements(emoji, title, audience)")
        .in("student_id", ids)
        .gte("unlocked_at", fromIso)
        .lt("unlocked_at", toIso),
    ]);
    const sessionIds = (weekSessions ?? []).map((x) => x.id);
    const planIds = [...new Set((weekSessions ?? []).map((x) => x.plan_id).filter((x): x is string => !!x))];
    const [{ data: weekSets }, { data: planItems }] = await Promise.all([
      sessionIds.length
        ? loadWeekSets(admin, sessionIds)
        : Promise.resolve({ data: [] as WeekSetRow[] }),
      planIds.length
        ? admin.from("workout_plan_items").select("plan_id, equipment_id").in("plan_id", planIds)
        : Promise.resolve({ data: [] as { plan_id: string; equipment_id: string | null }[] }),
    ]);
    const visible = new Set((settings ?? []).filter((s) => s.weight_visible_to_personal).map((s) => s.student_id));
    const { data: weights } = visible.size
      ? await admin
          .from("body_weights")
          .select("student_id, measured_on, weight_kg")
          .in("student_id", [...visible])
          .gte("measured_on", period.prevFrom)
      : { data: [] };

    const equipmentIds = [
      ...new Set([
        ...summaries.flat().flatMap((s) => s.ex.map((x) => x.e)),
        ...(weekSets ?? []).map((x) => x.equipment_id),
        ...(planItems ?? []).map((x) => x.equipment_id).filter((x): x is string => !!x),
      ]),
    ];
    const { data: equipment } = equipmentIds.length
      ? await admin.from("equipment").select("id, name, muscle_group").in("id", equipmentIds)
      : { data: [] };
    const names = Object.fromEntries((equipment ?? []).map((e) => [e.id, e.name]));
    const eqInfo = Object.fromEntries((equipment ?? []).map((e) => [e.id, { name: e.name, cardio: e.muscle_group === "cardio" }]));
    const cardioIds = new Set((equipment ?? []).filter((e) => e.muscle_group === "cardio").map((e) => e.id));
    const itemsByPlan: Record<string, string[]> = {};
    for (const it of planItems ?? []) if (it.equipment_id) (itemsByPlan[it.plan_id] ??= []).push(it.equipment_id);

    const students: ReportStudent[] = links.map((l, i) =>
      buildStudentReport({
        id: l.student_id,
        name: l.student?.full_name ?? "Aluno",
        sessions: summaries[i],
        names,
        period,
        today,
        weights: visible.has(l.student_id)
          ? (weights ?? []).filter((w) => w.student_id === l.student_id).map((w) => ({ measured_on: w.measured_on, weight_kg: Number(w.weight_kg) }))
          : null,
        cardioIds,
        detail: weekDetail({
          sessions: (weekSessions ?? [])
            .filter((x) => x.student_id === l.student_id)
            .map((x): WeekSessionRow => ({ ...x, date: spDateKey(x.started_at) })),
          sets: (weekSets ?? []).filter((x) => (weekSessions ?? []).some((w) => w.id === x.session_id && w.student_id === l.student_id)),
          planItems: itemsByPlan,
          equipment: eqInfo,
          cardioWeek: cardioWeeks[i],
          weeklyGoal: (settings ?? []).find((x) => x.student_id === l.student_id)?.weekly_goal ?? null,
          lastWorkout: summaries[i].at(-1)?.date ?? null,
          achievements: (unlocked ?? [])
            .filter((a) => a.student_id === l.student_id && a.achievement && a.achievement.audience === "aluno")
            .map((a) => ({ emoji: a.achievement!.emoji, title: a.achievement!.title })),
        }),
      }),
    );

    // Regras sempre; cada IA configurada ao lado, para comparar.
    const ai = await aiSuggestions(students);
    const answered = ai.filter((r) => r.ok);
    if (answered.length) result.ai++;
    for (const s of students) {
      s.suggestions = ruleSuggestions(s);
      s.motivation = ruleMotivation(s);
      s.aiSuggestions = answered
        .map((r) => ({ source: r.source, items: r.suggestions[s.id] ?? [], ...(r.motivation[s.id] && { motivation: r.motivation[s.id] }) }))
        .filter((x) => x.items.length);
    }

    const content: ReportContent = {
      week_start: period.from,
      week_end: period.to,
      students,
      ai: answered.length > 0,
      aiStatus: ai.map(({ source, ok, error }) => ({ source, ok, ...(error ? { error } : {}) })),
    };
    const { data: report, error: upsertError } = await admin
      .from("weekly_reports")
      .upsert(
        { personal_id: personal.id, week_start: period.from, content, ai_used: answered.length > 0, updated_at: new Date().toISOString() },
        { onConflict: "personal_id,week_start" },
      )
      .select("id, emailed_at")
      .single();
    if (upsertError || !report) {
      console.error("Falha ao salvar relatório:", upsertError?.message);
      continue;
    }
    result.reports++;
    if (!opts.deliver) continue;

    const link = `/personal/relatorios/${report.id}`;
    const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", personal.id).eq("link", link);
    if (!count) {
      const total = students.reduce((a, s) => a + s.sessions, 0);
      await admin.from("notifications").insert({
        user_id: personal.id,
        title: "Relatório da semana pronto 📊",
        body: `${total} ${total === 1 ? "treino" : "treinos"} dos seus alunos nesta semana.`,
        link,
      });
    }
    if (!report.emailed_at) {
      const { data: user } = await admin.auth.admin.getUserById(personal.id);
      const email = user?.user?.email;
      const html = reportHtml(content, { personalName: personal.full_name, reportUrl: `${appUrl}${link}` });
      if (email && (await sendEmail(email, `Relatório da semana (${period.label}) — BoraTreinar`, html))) {
        result.emails++;
        await admin.from("weekly_reports").update({ emailed_at: new Date().toISOString() }).eq("id", report.id);
      }
    }
  }
  return result;
}
