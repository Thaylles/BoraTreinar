import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileBarChart, Sparkles } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReportContent } from "@/lib/report";
import { generateReportNow } from "./actions";

export const metadata: Metadata = { title: "Relatórios" };

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default async function RelatoriosPage() {
  await requireRole("personal");
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("weekly_reports")
    .select("id, week_start, content, ai_used, emailed_at")
    .order("week_start", { ascending: false })
    .limit(52);

  return (
    <>
      <PageTitle sub="Todo domingo às 22h chega um resumo dos seus alunos por e-mail e aqui no app.">Relatórios semanais</PageTitle>
      <form action={generateReportNow} className="mb-6">
        <SubmitButton variant="secondary" className="w-full" pendingText="Gerando relatório…">
          <Sparkles className="size-5" aria-hidden /> Gerar prévia desta semana agora
        </SubmitButton>
        <p className="mt-1 text-center text-xs text-muted">A prévia não envia e-mail; o relatório de domingo atualiza esta semana.</p>
      </form>
      {!reports?.length ? (
        <EmptyState icon={<FileBarChart className="size-8" />} title="Nenhum relatório ainda">
          O primeiro chega no domingo às 22h.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => {
            const c = r.content as unknown as ReportContent;
            const total = c.students.reduce((a, s) => a + s.sessions, 0);
            const trained = c.students.filter((s) => s.sessions > 0).length;
            return (
              <li key={r.id}>
                <Link
                  href={`/personal/relatorios/${r.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-bandeira-500"
                >
                  <FileBarChart className="size-6 shrink-0 text-bandeira-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display font-bold">
                      Semana {ddmm(c.week_start)} a {ddmm(c.week_end)}
                    </span>
                    <span className="text-xs text-muted">
                      {total} {total === 1 ? "treino" : "treinos"} · {trained} de {c.students.length}{" "}
                      {c.students.length === 1 ? "aluno treinou" : "alunos treinaram"}
                      {r.emailed_at ? " · enviado por e-mail" : ""}
                      {r.ai_used ? " · sugestões por IA" : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
