import { ArrowDownRight, ArrowRight, ArrowUpRight, Bot, CircleAlert, CircleCheck, Lightbulb, Lock, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SOURCE_LABEL, sessionsLine, suggestionSets, type ReportContent, type ReportStudent, type SuggestionSource } from "@/lib/report";
import { formatAmount } from "@/lib/cardio";
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

          {s.detail && <WeekDetail s={s} />}

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

          <Motivation s={s} />
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

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Semana em detalhe: tempo, meta, o que deixou de fazer, cardio, esforço e conquistas. */
function WeekDetail({ s }: { s: ReportStudent }) {
  const d = s.detail!;
  const c = d.cardio;
  return (
    <div className="mb-3 space-y-3 text-sm">
      <ul className="space-y-1">
        {!!s.sessions && (
          <li>
            ⏱️ {d.minutes} min de treino em {d.days} {d.days === 1 ? "dia" : "dias"}
          </li>
        )}
        {d.weeklyGoal != null && (
          <li>
            🎯 Meta semanal: {d.days}/{d.weeklyGoal} dias {d.days >= d.weeklyGoal && "✅"}
          </li>
        )}
        {!s.sessions && <li>📅 {d.lastWorkout ? `Último treino: ${ddmm(d.lastWorkout)}` : "Ainda não registrou nenhum treino"}</li>}
        {d.effort.avg != null && (
          <li>
            💪 Esforço médio: {d.effort.avg.toLocaleString("pt-BR")}/5 ({d.effort.rated} {d.effort.rated === 1 ? "treino avaliado" : "treinos avaliados"})
          </li>
        )}
        {!!d.effort.pain && (
          <li className="font-semibold text-pitanga-600">
            ⚠️ Relatou dor em {d.effort.pain} {d.effort.pain === 1 ? "treino" : "treinos"}
          </li>
        )}
        {d.effort.feedback.map((f) => (
          <li key={f} className="text-muted">
            💬 “{f}”
          </li>
        ))}
      </ul>

      {d.missed.length ? (
        <div>
          <p className="mb-1 font-bold">🚫 Deixou de fazer</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {d.missed.map((m) => (
              <li key={m.kind + m.name}>
                {m.name} — {m.kind === "pulado" ? `não fez${m.count > 1 ? ` (${m.count}×)` : ""}` : `${m.count} de ${m.total} séries não feitas`}
                {!!m.plans.length && <span className="text-muted"> · {m.plans.join(", ")}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !!s.sessions && <p className="font-bold">✅ Não deixou nenhum exercício para trás</p>
      )}

      <div className="rounded-2xl border border-border p-3">
        <p className="font-bold">
          🏃 Cardio:{" "}
          {c.minutes
            ? `fez ${formatAmount(c.minutes, "min")}${c.km ? ` · ${formatAmount(c.km, "km")}` : ""} em ${c.days} ${c.days === 1 ? "dia" : "dias"}`
            : "não fez nesta semana"}
        </p>
        {c.goal ? (
          <>
            <p className="mt-1 text-xs text-muted">
              Meta: {c.goal.label}
              {!c.goal.byPersonal && " (definida pelo aluno)"} — {formatAmount(c.goal.value, c.goal.unit)} de {formatAmount(c.goal.target, c.goal.unit)}
            </p>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-border/60" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.goal.pct} aria-label="Meta de cardio">
              <div className={cn("h-full rounded-full", c.goal.done ? "bg-ipe-500" : "bg-pitanga-500")} style={{ width: `${c.goal.pct}%` }} />
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs text-muted">Sem meta de cardio. Defina na página do aluno.</p>
        )}
        {!!c.items.length && (
          <ul className="mt-2 space-y-0.5 text-xs">
            {c.items.map((i, k) => (
              <li key={k}>
                {ddmm(i.date)} · {i.name}: {i.line}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!!d.achievements.length && (
        <p>
          🏆 <strong>Conquistas:</strong> {d.achievements.map((a) => `${a.emoji} ${a.title}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

/** Mensagens de motivação (regras e IAs) para o Personal mandar ao aluno. */
function Motivation({ s }: { s: ReportStudent }) {
  const msgs = [
    ...(s.motivation ? [{ source: "regras" as SuggestionSource, text: s.motivation }] : []),
    ...(s.aiSuggestions ?? []).filter((a) => a.motivation).map((a) => ({ source: a.source as SuggestionSource, text: a.motivation! })),
  ];
  if (!msgs.length) return null;
  return (
    <div className="mt-3 rounded-2xl bg-ipe-100 p-3 text-sm text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400">
      <p className="mb-1 font-bold">💬 Mensagem de motivação para mandar ao aluno</p>
      {msgs.map((m) => (
        <p key={m.source} className="mt-1">
          “{m.text}” <span className="text-xs opacity-70">· {SOURCE_LABEL[m.source]}</span>
        </p>
      ))}
    </div>
  );
}
