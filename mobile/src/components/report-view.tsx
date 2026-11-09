import { View } from "react-native";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bot, CircleAlert, CircleCheck, Lightbulb, Lock, Sparkles, ThumbsUp } from "lucide-react-native";
import { SOURCE_LABEL, sessionsLine, suggestionSets, type ReportContent, type ReportStudent, type SuggestionSource } from "@/lib/report";
import { formatAmount } from "@/lib/cardio";
import { formatKg, type Trend } from "@/lib/stats";
import { form } from "~/lib/api";
import { useCall } from "~/lib/use-action";
import { Button, Card, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";

const TREND: Record<Trend, { icon: typeof ArrowUpRight; text: string; cls: string; color: "bandeira600" | "muted" | "pitanga600" | "ipe600" }> = {
  up: { icon: ArrowUpRight, text: "aumentou", cls: "text-bandeira-600 dark:text-bandeira-100", color: "bandeira600" },
  same: { icon: ArrowRight, text: "manteve", cls: "text-muted", color: "muted" },
  down: { icon: ArrowDownRight, text: "diminuiu", cls: "text-pitanga-600", color: "pitanga600" },
  new: { icon: Sparkles, text: "primeira vez", cls: "text-ipe-600", color: "ipe600" },
};
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR")} kg`;
const SET_STYLE: Record<SuggestionSource, string> = { regras: "bg-border/40", gemini: "bg-anil-500/10 dark:bg-anil-500/20", claude: "bg-bandeira-50 dark:bg-bandeira-500/15" };
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const Li = ({ children, className }: { children: React.ReactNode; className?: string }) => <Text className={cn("text-sm", className)}>{children}</Text>;

function WeekDetail({ s }: { s: ReportStudent }) {
  const d = s.detail!;
  const c = d.cardio;
  return (
    <View className="mb-3 gap-3">
      <View className="gap-1">
        {s.sessions ? <Li>⏱️ {d.minutes} min de treino em {d.days} {d.days === 1 ? "dia" : "dias"}</Li> : null}
        {d.weeklyGoal != null ? <Li>🎯 Meta semanal: {d.days}/{d.weeklyGoal} dias {d.days >= d.weeklyGoal ? "✅" : ""}</Li> : null}
        {!s.sessions ? <Li>📅 {d.lastWorkout ? `Último treino: ${ddmm(d.lastWorkout)}` : "Ainda não registrou nenhum treino"}</Li> : null}
        {d.effort.avg != null ? <Li>💪 Esforço médio: {d.effort.avg.toLocaleString("pt-BR")}/5 ({d.effort.rated} {d.effort.rated === 1 ? "treino avaliado" : "treinos avaliados"})</Li> : null}
        {d.effort.pain ? <Li className="font-semibold text-pitanga-600">⚠️ Relatou dor em {d.effort.pain} {d.effort.pain === 1 ? "treino" : "treinos"}</Li> : null}
        {d.effort.feedback.map((f) => (
          <Li key={f} className="text-muted">💬 “{f}”</Li>
        ))}
      </View>
      {d.missed.length ? (
        <View>
          <Text className="mb-1 text-sm font-bold">🚫 Deixou de fazer</Text>
          {d.missed.map((m) => (
            <Li key={m.kind + m.name}>
              • {m.name} — {m.kind === "pulado" ? `não fez${m.count > 1 ? ` (${m.count}×)` : ""}` : `${m.count} de ${m.total} séries não feitas`}
              {m.plans.length ? <Text className="text-sm text-muted"> · {m.plans.join(", ")}</Text> : null}
            </Li>
          ))}
        </View>
      ) : s.sessions ? (
        <Text className="text-sm font-bold">✅ Não deixou nenhum exercício para trás</Text>
      ) : null}
      <View className="rounded-2xl border border-border p-3">
        <Text className="text-sm font-bold">
          🏃 Cardio: {c.minutes ? `fez ${formatAmount(c.minutes, "min")}${c.km ? ` · ${formatAmount(c.km, "km")}` : ""} em ${c.days} ${c.days === 1 ? "dia" : "dias"}` : "não fez nesta semana"}
        </Text>
        {c.goal ? (
          <>
            <Text className="mt-1 text-xs text-muted">
              Meta: {c.goal.label}
              {!c.goal.byPersonal ? " (definida pelo aluno)" : ""} — {formatAmount(c.goal.value, c.goal.unit)} de {formatAmount(c.goal.target, c.goal.unit)}
            </Text>
            <View className="mt-1 h-2.5 overflow-hidden rounded-full bg-border/60">
              <View className={cn("h-full rounded-full", c.goal.done ? "bg-ipe-500" : "bg-pitanga-500")} style={{ width: `${c.goal.pct}%` }} />
            </View>
          </>
        ) : (
          <Text className="mt-1 text-xs text-muted">Sem meta de cardio. Defina na página do aluno.</Text>
        )}
        {c.items.map((i, k) => (
          <Text key={k} className="mt-1 text-xs">
            {ddmm(i.date)} · {i.name}: {i.line}
          </Text>
        ))}
      </View>
      {d.achievements.length ? (
        <Text className="text-sm">
          🏆 <Text className="text-sm font-bold">Conquistas:</Text> {d.achievements.map((a) => `${a.emoji} ${a.title}`).join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}

function Motivation({ s }: { s: ReportStudent }) {
  const msgs = [
    ...(s.motivation ? [{ source: "regras" as SuggestionSource, text: s.motivation }] : []),
    ...(s.aiSuggestions ?? []).filter((a) => a.motivation).map((a) => ({ source: a.source as SuggestionSource, text: a.motivation! })),
  ];
  if (!msgs.length) return null;
  return (
    <View className="mt-3 rounded-2xl bg-ipe-100 p-3 dark:bg-ipe-500/15">
      <Text className="mb-1 text-sm font-bold text-anil-900 dark:text-ipe-400">💬 Mensagem de motivação para mandar ao aluno</Text>
      {msgs.map((m) => (
        <Text key={m.source} className="mt-1 text-sm text-anil-900 dark:text-ipe-400" selectable>
          “{m.text}” <Text className="text-xs text-anil-900/70 dark:text-ipe-400/70">· {SOURCE_LABEL[m.source]}</Text>
        </Text>
      ))}
    </View>
  );
}

export function ReportView({ content, vote }: { content: ReportContent; vote?: React.ReactNode }) {
  const t = useTheme();
  const students = [...content.students].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "pt-BR"));
  const total = students.reduce((a, s) => a + s.sessions, 0);
  return (
    <View className="gap-4">
      {content.aiStatus?.length ? (
        <View className="flex-row flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3">
          <Bot color={t.muted} size={16} />
          <Text className="text-xs font-semibold">Fase de testes · IAs neste relatório:</Text>
          {content.aiStatus.map((a) => (
            <View key={a.source} className={cn("flex-row items-center gap-1 rounded-full px-2 py-0.5", a.ok ? "bg-bandeira-50 dark:bg-bandeira-500/20" : "bg-pitanga-100 dark:bg-pitanga-500/20")}>
              {a.ok ? <CircleCheck color={t.bandeira700} size={14} /> : <CircleAlert color={t.pitanga600} size={14} />}
              <Text className={cn("text-xs font-semibold", a.ok ? "text-bandeira-700 dark:text-bandeira-100" : "text-pitanga-600")}>
                {SOURCE_LABEL[a.source]}
                {!a.ok ? `: falhou${a.error ? ` (${a.error})` : ""}` : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text className="text-sm">
        <Text className="text-sm font-bold">{total}</Text> {total === 1 ? "treino" : "treinos"} no total · <Text className="text-sm font-bold">{students.filter((s) => s.sessions > 0).length}</Text> de {students.length} {students.length === 1 ? "aluno treinou" : "alunos treinaram"}.
      </Text>
      {students.map((s) => (
        <Card key={s.id}>
          <Text className="font-display text-lg font-bold">{s.name}</Text>
          <Text className={cn("mb-3 text-sm", s.sessions ? "text-muted" : "font-semibold text-pitanga-600")}>
            {sessionsLine(s)}
            {s.volume > 0 ? ` · volume ${formatKg(s.volume)}` : ""}
          </Text>
          {s.exercises.length ? (
            <View className="mb-3">
              {s.exercises.map((e, i) => {
                const tr = TREND[e.trend];
                const Icon = tr.icon;
                return (
                  <View key={e.name} className={cn("flex-row items-center gap-2 py-1.5", i > 0 && "border-t border-border")}>
                    <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>{e.name}</Text>
                    <Text className="text-sm">{formatKg(e.current)}</Text>
                    <View className="w-32 flex-row items-center justify-end gap-1">
                      <Icon color={t[tr.color]} size={16} />
                      <Text className={cn("text-xs font-semibold", tr.cls)}>
                        {tr.text}
                        {e.trend === "up" || e.trend === "down" ? ` (${signed(e.delta)})` : ""}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
          <View className="mb-3 gap-1">
            {s.prs.length ? <Li>🏆 Recordes: {s.prs.map((p) => `${p.name} ${formatKg(p.load)}`).join(", ")}</Li> : null}
            {s.streakWeeks >= 2 ? <Li>🔥 {s.streakWeeks} semanas seguidas treinando</Li> : null}
            {s.weight.visible ? (
              s.weight.change ? <Li>⚖️ Peso: {formatKg(s.weight.change.first)} → {formatKg(s.weight.change.last)} ({signed(s.weight.change.delta)})</Li> : null
            ) : (
              <View className="flex-row items-center gap-1">
                <Lock color={t.muted} size={14} />
                <Text className="text-sm text-muted">Peso não compartilhado pelo aluno</Text>
              </View>
            )}
          </View>
          {s.detail ? <WeekDetail s={s} /> : null}
          {suggestionSets(s).length ? (
            <View className="gap-2">
              {suggestionSets(s).map((set) => (
                <View key={set.source} className={cn("rounded-2xl p-3", SET_STYLE[set.source])}>
                  <View className="mb-1 flex-row items-center gap-1">
                    {set.source === "regras" ? <Lightbulb color={t.foreground} size={16} /> : <Bot color={t.foreground} size={16} />}
                    <Text className="text-sm font-bold">Sugestões · {SOURCE_LABEL[set.source]}</Text>
                  </View>
                  {set.items.map((x) => (
                    <Text key={x} className="text-sm">• {x}</Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
          <Motivation s={s} />
        </Card>
      ))}
      <Text className="text-xs text-muted">
        Carga: maior carga da semana comparada com a última vez que o aluno fez o exercício.{" "}
        {content.ai ? "Fase de testes: sugestões marcadas como IA foram geradas por inteligência artificial (revise antes de aplicar) e aparecem ao lado das regras simples para comparação." : "Sugestões geradas por regras simples."}
      </Text>
      {vote}
    </View>
  );
}

export function SourceVote({ reportId, content, preferred }: { reportId: string; content: ReportContent; preferred: string | null }) {
  const t = useTheme();
  const vote = useCall("personal/relatorios#setPreferredSource");
  const options: SuggestionSource[] = ["regras", ...(content.aiStatus ?? []).filter((a) => a.ok).map((a) => a.source)];
  if (options.length < 2) return null;
  return (
    <View className="rounded-3xl border-2 border-dashed border-ipe-500/60 bg-ipe-100/50 p-4 dark:bg-ipe-500/10">
      <View className="mb-1 flex-row items-center gap-2">
        <ThumbsUp color={t.ipe600} size={20} />
        <Text className="flex-1 font-display text-lg font-bold">Qual sugestão foi mais útil nesta semana?</Text>
      </View>
      <Text className="mb-3 text-xs text-muted">Seu voto entra no placar da página Relatórios, para comparar as IAs.</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => (
          <Button key={o} variant={preferred === o ? "primary" : "ghost"} className={preferred === o ? "" : "border-2 border-border bg-surface"} disabled={vote.pending} onPress={() => vote.run(form({ report_id: reportId, source: preferred === o ? "" : o }))}>
            {`${preferred === o ? "✓ " : ""}${SOURCE_LABEL[o]}`}
          </Button>
        ))}
      </View>
    </View>
  );
}
