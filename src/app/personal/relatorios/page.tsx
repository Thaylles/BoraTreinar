import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileBarChart, Sparkles } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SOURCE_LABEL, type ReportContent, type SuggestionSource } from "@/lib/report";
import { generateReportNow } from "./actions";

export const metadata: Metadata = { title: "Relatórios" };

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default async function RelatoriosPage() {
  await requireRole("personal");
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("weekly_reports")
    .select("id, week_start, content, ai_used, emailed_at, preferred_source")
    .order("week_start", { ascending: false })
    .limit(52);

  // Placar da comparação: quantas semanas cada fonte foi marcada como a mais útil.
  const votes = new Map<SuggestionSource, number>();
  for (const r of reports ?? []) {
    const src = r.preferred_source as SuggestionSource | null;
    if (src && src in SOURCE_LABEL) votes.set(src, (votes.get(src) ?? 0) + 1);
  }
  const totalVotes = [...votes.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <PageTitle sub="Todo domingo às 22h chega um resumo dos seus alunos por e-mail e aqui no app.">Relatórios semanais</PageTitle>
      <form action={generateReportNow} className="mb-6">
        <SubmitButton variant="secondary" className="w-full" pendingText="Gerando relatório…">
          <Sparkles className="size-5" aria-hidden /> Gerar prévia desta semana agora
        </SubmitButton>
        <p className="mt-1 text-center text-xs text-muted">A prévia não envia e-mail; o relatório de domingo atualiza esta semana.</p>
      </form>
      {totalVotes > 0 && (
        <section aria-labelledby="placar" className="mb-6 rounded-3xl border border-border bg-surface p-4">
          <h2 id="placar" className="mb-2 font-display text-lg font-bold">
            Placar das sugestões
          </h2>
          <ul className="space-y-2">
            {(Object.keys(SOURCE_LABEL) as SuggestionSource[])
              .filter((src) => votes.has(src))
              .sort((a, b) => (votes.get(b) ?? 0) - (votes.get(a) ?? 0))
              .map((src) => {
                const n = votes.get(src) ?? 0;
                return (
                  <li key={src} className="text-sm">
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="font-semibold">{SOURCE_LABEL[src]}</span>
                      <span className="tabular-nums text-muted">
                        {n} {n === 1 ? "semana" : "semanas"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-border/50" aria-hidden>
                      <div className="h-2 rounded-full bg-bandeira-500" style={{ width: `${(n / totalVotes) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
          </ul>
          <p className="mt-2 text-xs text-muted">Vote em cada relatório qual sugestão foi mais útil.</p>
        </section>
      )}
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
                      {r.ai_used ? " · com IA" : ""}
                      {r.preferred_source && r.preferred_source in SOURCE_LABEL
                        ? ` · preferida: ${SOURCE_LABEL[r.preferred_source as SuggestionSource].split(" (")[0]}`
                        : ""}
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
