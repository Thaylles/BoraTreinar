import { ArrowDownRight, ArrowRight, ArrowUpRight, Bot, CircleAlert, CircleCheck, Lightbulb, Lock, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SOURCE_LABEL, sessionsLine, suggestionSets, type ReportContent, type SuggestionSource } from "@/lib/report";
import { formatKg, type Trend } from "@/lib/stats";
import { cn } from "@/lib/cn";

const TREND: Record<Trend, { icon: typeof ArrowUpRight; text: string; cls: string }> = {
  up: { icon: ArrowUpRight, text: "aumentou", cls: "text-bandeira-600 dark:text-bandeira-100" },
  same: { icon: ArrowRight, text: "manteve", cls: "text-muted" },
  down: { icon: ArrowDownRight, text: "diminuiu", cls: "text-pitanga-600" },
  new: { icon: Sparkles, text: "primeira vez", cls: "text-ipe-600" },
};
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR")} kg`;

const SET_STYLE: Record<SuggestionSource, string> = {
  regras: "bg-border/40",
  gemini: "bg-anil-500/10 dark:bg-anil-500/20",
  claude: "bg-bandeira-50 dark:bg-bandeira-500/15",
};

/** Relatório semanal salvo: um cartão por aluno, quem treinou mais primeiro. `vote` aparece no fim (comparação). */
export function ReportView({ content, vote }: { content: ReportContent; vote?: React.ReactNode }) {
  const students = [...content.students].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "pt-BR"));
  const total = students.reduce((a, s) => a + s.sessions, 0);
  return (
    <div className="space-y-4">
      {!!content.aiStatus?.length && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-xs">
          <Bot className="size-4 text-muted" aria-hidden />
          <span className="font-semibold">Fase de testes · IAs neste relatório:</span>
          {content.aiStatus.map((a) => (
            <span
              key={a.source}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                a.ok ? "bg-bandeira-50 text-bandeira-700 dark:bg-bandeira-500/20 dark:text-bandeira-100" : "bg-pitanga-100 text-pitanga-600 dark:bg-pitanga-500/20",
              )}
              title={a.error}
            >
              {a.ok ? <CircleCheck className="size-3.5" aria-hidden /> : <CircleAlert className="size-3.5" aria-hidden />}
              {SOURCE_LABEL[a.source]}
              {!a.ok && `: falhou${a.error ? ` (${a.error})` : ""}`}
            </span>
          ))}
        </div>
      )}
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

          {suggestionSets(s).length > 0 && (
            <div className="space-y-2">
              {suggestionSets(s).map((set) => (
                <div key={set.source} className={cn("rounded-2xl p-3", SET_STYLE[set.source])}>
                  <p className="mb-1 flex items-center gap-1 text-sm font-bold">
                    {set.source === "regras" ? <Lightbulb className="size-4" aria-hidden /> : <Bot className="size-4" aria-hidden />}
                    Sugestões · {SOURCE_LABEL[set.source]}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {set.items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
      <p className="text-xs text-muted">
        Carga: maior carga da semana comparada com a última vez que o aluno fez o exercício.{" "}
        {content.ai
          ? "Fase de testes: sugestões marcadas como IA foram geradas por inteligência artificial (revise antes de aplicar) e aparecem ao lado das regras simples para comparação."
          : "Sugestões geradas por regras simples."}
      </p>
      {vote}
    </div>
  );
}
