import { ArrowDownRight, ArrowRight, ArrowUpRight, Lightbulb, Lock, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { sessionsLine, type ReportContent } from "@/lib/report";
import { formatKg, type Trend } from "@/lib/stats";
import { cn } from "@/lib/cn";

const TREND: Record<Trend, { icon: typeof ArrowUpRight; text: string; cls: string }> = {
  up: { icon: ArrowUpRight, text: "aumentou", cls: "text-bandeira-600 dark:text-bandeira-100" },
  same: { icon: ArrowRight, text: "manteve", cls: "text-muted" },
  down: { icon: ArrowDownRight, text: "diminuiu", cls: "text-pitanga-600" },
  new: { icon: Sparkles, text: "primeira vez", cls: "text-ipe-600" },
};
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR")} kg`;

/** Relatório semanal salvo: um cartão por aluno, quem treinou mais primeiro. */
export function ReportView({ content }: { content: ReportContent }) {
  const students = [...content.students].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "pt-BR"));
  const total = students.reduce((a, s) => a + s.sessions, 0);
  return (
    <div className="space-y-4">
      <p className="text-sm">
        <strong>{total}</strong> {total === 1 ? "treino" : "treinos"} no total ·{" "}
        <strong>{students.filter((s) => s.sessions > 0).length}</strong> de {students.length}{" "}
        {students.length === 1 ? "aluno treinou" : "alunos treinaram"}.
      </p>
      {students.map((s) => (
        <Card key={s.id}>
          <h2 className="font-display text-lg font-bold">{s.name}</h2>
          <p className={cn("mb-3 text-sm", s.sessions ? "text-muted" : "font-semibold text-pitanga-600")}>
            {sessionsLine(s)}
            {s.volume > 0 && ` · volume ${formatKg(s.volume)}`}
          </p>

          {!!s.exercises.length && (
            <ul className="mb-3 divide-y divide-border text-sm">
              {s.exercises.map((e) => {
                const t = TREND[e.trend];
                const Icon = t.icon;
                return (
                  <li key={e.name} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    <span className="tabular-nums">{formatKg(e.current)}</span>
                    <span className={cn("inline-flex w-32 items-center justify-end gap-1 text-xs font-semibold", t.cls)}>
                      <Icon className="size-4" aria-hidden />
                      {t.text}
                      {(e.trend === "up" || e.trend === "down") && ` (${signed(e.delta)})`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <ul className="mb-3 space-y-1 text-sm">
            {!!s.prs.length && <li>🏆 Recordes: {s.prs.map((p) => `${p.name} ${formatKg(p.load)}`).join(", ")}</li>}
            {s.streakWeeks >= 2 && <li>🔥 {s.streakWeeks} semanas seguidas treinando</li>}
            {s.weight.visible ? (
              s.weight.change && (
                <li>
                  ⚖️ Peso: {formatKg(s.weight.change.first)} → {formatKg(s.weight.change.last)} ({signed(s.weight.change.delta)})
                </li>
              )
            ) : (
              <li className="flex items-center gap-1 text-muted">
                <Lock className="size-3.5" aria-hidden /> Peso não compartilhado pelo aluno
              </li>
            )}
          </ul>

          {!!s.suggestions.length && (
            <div className="rounded-2xl bg-bandeira-50 p-3 dark:bg-bandeira-500/15">
              <p className="mb-1 flex items-center gap-1 text-sm font-bold text-bandeira-700 dark:text-bandeira-100">
                <Lightbulb className="size-4" aria-hidden /> Sugestões{content.ai ? " (IA)" : ""}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {s.suggestions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))}
      <p className="text-xs text-muted">
        Carga: maior carga da semana comparada com a última vez que o aluno fez o exercício.{" "}
        {content.ai ? "Sugestões geradas por IA: revise antes de aplicar." : "Sugestões geradas por regras simples."}
      </p>
    </div>
  );
}
