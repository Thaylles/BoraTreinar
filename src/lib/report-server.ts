import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { periodFor, type SummarySession } from "@/lib/stats";
import { buildStudentReport, reportHtml, ruleSuggestions, type ReportContent, type ReportStudent } from "@/lib/report";
import { aiSuggestions } from "@/lib/report-ai";
import { spDateKey } from "@/lib/week";

type Result = { personals: number; reports: number; emails: number; ai: number };

/**
 * Gera (ou atualiza) o relatório da semana atual (seg–dom, fuso SP) de cada Personal.
 * Roda com service role, então a privacidade do peso é aplicada aqui: só entra com permissão do aluno.
 * Com `deliver`, envia o e-mail e a notificação uma única vez por semana.
 */
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
    const [{ data: settings }, summaries] = await Promise.all([
      admin.from("student_settings").select("student_id, weight_visible_to_personal").in("student_id", ids),
      Promise.all(ids.map((id) => admin.rpc("training_summary", { p_student: id }).then((r) => (r.data ?? []) as unknown as SummarySession[]))),
    ]);
    const visible = new Set((settings ?? []).filter((s) => s.weight_visible_to_personal).map((s) => s.student_id));
    const { data: weights } = visible.size
      ? await admin
          .from("body_weights")
          .select("student_id, measured_on, weight_kg")
          .in("student_id", [...visible])
          .gte("measured_on", period.prevFrom)
      : { data: [] };

    const equipmentIds = [...new Set(summaries.flat().flatMap((s) => s.ex.map((x) => x.e)))];
    const { data: equipment } = equipmentIds.length
      ? await admin.from("equipment").select("id, name").in("id", equipmentIds)
      : { data: [] };
    const names = Object.fromEntries((equipment ?? []).map((e) => [e.id, e.name]));

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
      }),
    );

    // Regras sempre; cada IA configurada ao lado, para comparar.
    const ai = await aiSuggestions(students);
    const answered = ai.filter((r) => r.ok);
    if (answered.length) result.ai++;
    for (const s of students) {
      s.suggestions = ruleSuggestions(s);
      s.aiSuggestions = answered
        .map((r) => ({ source: r.source, items: r.suggestions[s.id] ?? [] }))
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
