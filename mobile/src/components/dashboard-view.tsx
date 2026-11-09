import { Pressable, View } from "react-native";
import { Link, type Href } from "expo-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Flame, Sparkles, Trophy } from "lucide-react-native";
import { formatKg, shiftPeriod, type ExerciseProgress, type PeriodKind, type Totals } from "@/lib/stats";
import { mondayOf } from "@/lib/schedule";
import type { loadDashboard } from "@/lib/dashboard-server";
import { Card, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Segmented } from "~/ui/forms";
import { TrendChart, WeeklyBars } from "./charts";

type Data = Awaited<ReturnType<typeof loadDashboard>>;
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const signed = (n: number, unit = "") => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR")}${unit}`;

function Compare({ now, before, unit = "" }: { now: number; before: number; unit?: string }) {
  const d = Math.round((now - before) * 10) / 10;
  if (!before && !now) return <Text className="text-xs text-muted">—</Text>;
  return (
    <Text className={cn("text-xs font-semibold", d > 0 ? "text-bandeira-600 dark:text-bandeira-100" : d < 0 ? "text-pitanga-600" : "text-muted")}>
      {d === 0 ? "igual ao anterior" : `${signed(d, unit)} vs anterior`}
    </Text>
  );
}

const TREND = {
  up: { icon: ArrowUpRight, box: "bg-bandeira-50 dark:bg-bandeira-500/20", text: "subiu" },
  same: { icon: ArrowRight, box: "bg-border/50", text: "estável" },
  down: { icon: ArrowDownRight, box: "bg-pitanga-100 dark:bg-pitanga-500/20", text: "caiu" },
  new: { icon: Sparkles, box: "bg-ipe-100 dark:bg-ipe-500/20", text: "primeira vez" },
} as const;

export function ProgressRow({ p, name, href }: { p: ExerciseProgress; name: string; href?: Href }) {
  const t = useTheme();
  const tr = TREND[p.trend];
  const Icon = tr.icon;
  const color = p.trend === "up" ? t.bandeira600 : p.trend === "down" ? t.pitanga600 : p.trend === "new" ? t.anil700 : t.muted;
  const body = (
    <View className="flex-row items-center gap-3 rounded-2xl p-2">
      <View className={cn("size-9 items-center justify-center rounded-xl", tr.box)}>
        <Icon color={color} size={20} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold" numberOfLines={1}>{name}</Text>
        <Text className="text-xs text-muted">
          {p.previous === null ? "sem registro anterior" : `antes ${formatKg(p.previous)}`} · {tr.text}
        </Text>
      </View>
      <View className="items-end">
        <Text className="font-display text-lg font-bold">{formatKg(p.current)}</Text>
        {p.trend !== "new" && p.delta !== 0 ? <Text className="text-xs font-semibold">{signed(p.delta, " kg")}</Text> : null}
      </View>
    </View>
  );
  return href ? (
    <Link href={href} asChild>
      <Pressable className="active:opacity-70">{body}</Pressable>
    </Link>
  ) : (
    body
  );
}

function StatCard({ label, value, now, before, unit }: { label: string; value: string; now: number; before: number; unit?: string }) {
  return (
    <Card className="p-4" style={{ width: "48%" }}>
      <Text className="text-xs font-semibold text-muted">{label}</Text>
      <Text className="font-display text-2xl font-extrabold leading-tight">{value}</Text>
      <Compare now={now} before={before} unit={unit} />
    </Card>
  );
}

/** Painel semanal/mensal de um aluno (aluno e Personal). */
export function DashboardView({
  data,
  onPeriod,
  exerciseHref,
  weightHiddenText,
}: {
  data: Data;
  onPeriod: (kind: PeriodKind, ref: string) => void;
  exerciseHref?: (equipmentId: string) => Href;
  weightHiddenText?: string;
}) {
  const t = useTheme();
  const { period, dashboard: d, names, today, weight } = data;
  const isCurrent = today >= period.from && today <= period.to;
  const tt: Totals = d.totals;
  const p: Totals = d.prevTotals;
  const nameOf = (id: string) => names[id] ?? "Exercício";
  const prevWord = period.kind === "semana" ? "semana anterior" : "mês anterior";
  return (
    <View className="gap-5">
      <View className="gap-3">
        <Segmented
          options={[
            { value: "semana", label: "Semana" },
            { value: "mes", label: "Mês" },
          ]}
          value={period.kind}
          onChange={(k) => onPeriod(k as PeriodKind, period.kind === k ? period.from : today)}
        />
        <View className="flex-row items-center justify-between gap-2">
          <Pressable onPress={() => onPeriod(period.kind, shiftPeriod(period, -1))} className="rounded-xl p-2" accessibilityLabel="Período anterior">
            <ChevronLeft color={t.foreground} size={20} />
          </Pressable>
          <View className="items-center">
            <Text className="text-center font-display text-lg font-bold">{period.label}</Text>
            {isCurrent ? <Text className="text-xs text-muted">{period.kind === "semana" ? "esta semana" : "este mês"}</Text> : null}
          </View>
          {isCurrent ? (
            <View className="size-9" />
          ) : (
            <Pressable onPress={() => onPeriod(period.kind, shiftPeriod(period, 1))} className="rounded-xl p-2" accessibilityLabel="Próximo período">
              <ChevronRight color={t.foreground} size={20} />
            </Pressable>
          )}
        </View>
      </View>

      <View className="flex-row flex-wrap justify-between gap-y-3">
        <StatCard label="Treinos" value={String(tt.sessions)} now={tt.sessions} before={p.sessions} />
        <StatCard label="Volume total" value={formatKg(tt.volume)} now={tt.volume} before={p.volume} unit=" kg" />
        <StatCard label="Séries feitas" value={String(tt.sets)} now={tt.sets} before={p.sets} />
        <StatCard label="Tempo treinando" value={`${Math.floor(tt.minutes / 60)}h${String(tt.minutes % 60).padStart(2, "0")}`} now={tt.minutes} before={p.minutes} unit=" min" />
      </View>
      <Text className="-mt-3 text-xs text-muted">Comparação com a {prevWord}. Volume = séries feitas × repetições × carga.</Text>

      <Card>
        <Text className="mb-1 font-display text-lg font-bold">Frequência</Text>
        <Text className="mb-2 text-xs text-muted">Treinos por semana (segunda a domingo), últimas 8 semanas.</Text>
        <WeeklyBars weeks={d.weeks} current={mondayOf(period.to < today ? period.to : today)} />
      </Card>

      <Card>
        <Text className="mb-3 font-display text-lg font-bold">Evoluções notáveis</Text>
        <View className="gap-3">
          <View className="flex-row items-center gap-3">
            <Flame color={t.pitanga500} size={24} />
            <Text className="flex-1 text-sm">
              {d.streakWeeks > 0 ? (
                <>
                  <Text className="text-sm font-bold">{d.streakWeeks} {d.streakWeeks === 1 ? "semana" : "semanas seguidas"}</Text> treinando
                  {d.streakWeeks >= 4 ? ". Que constância! 🔥" : ". Bora manter!"}
                </>
              ) : (
                "Sem sequência de semanas no momento. Bora começar uma?"
              )}
            </Text>
          </View>
          {d.bestVolume ? (
            <View className="flex-row items-center gap-3">
              <Text className="w-6 text-center text-xl">💪</Text>
              <Text className="flex-1 text-sm">
                Maior volume: <Text className="text-sm font-bold">{formatKg(d.bestVolume.volume)}</Text> em {ddmm(d.bestVolume.date)}
                {d.bestVolume.allTime ? <Text className="text-sm font-bold text-bandeira-600 dark:text-bandeira-100"> · recorde de volume!</Text> : null}
              </Text>
            </View>
          ) : null}
          {d.prs.map((pr) => (
            <View key={pr.id} className="flex-row items-center gap-3">
              <Trophy color={t.ipe600} size={24} />
              <Text className="flex-1 text-sm">
                Recorde em <Text className="text-sm font-bold">{nameOf(pr.id)}</Text>: {formatKg(pr.load)} ({ddmm(pr.date)})
              </Text>
            </View>
          ))}
          {!d.bestVolume && !d.prs.length ? <Text className="text-sm text-muted">Nenhum treino neste período.</Text> : null}
        </View>
      </Card>

      {d.topGains.length ? (
        <Card>
          <Text className="mb-2 font-display text-lg font-bold">Onde mais aumentou carga</Text>
          {d.topGains.map((g, i) => (
            <View key={g.id} className="flex-row items-center gap-3 py-1">
              <View className="size-8 items-center justify-center rounded-full bg-ipe-500">
                <Text className="font-display font-extrabold text-anil-900">{i + 1}º</Text>
              </View>
              <Text className="min-w-0 flex-1 text-sm font-semibold" numberOfLines={1}>{nameOf(g.id)}</Text>
              <Text className="font-display font-bold text-bandeira-600 dark:text-bandeira-100">{signed(g.delta, " kg")}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text className="mb-1 font-display text-lg font-bold">Progressão de carga</Text>
        <Text className="mb-2 text-xs text-muted">Maior carga no período comparada com a última vez antes dele.</Text>
        {d.progress.length ? (
          <View className="-mx-2">
            {d.progress.map((pr) => (
              <ProgressRow key={pr.id} p={pr} name={nameOf(pr.id)} href={exerciseHref?.(pr.id)} />
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted">Nenhum exercício registrado neste período.</Text>
        )}
      </Card>

      <Card>
        <Text className="mb-1 font-display text-lg font-bold">Peso corporal</Text>
        {!weight.visible ? (
          <Text className="text-sm text-muted">{weightHiddenText ?? "Nenhuma pesagem registrada ainda."}</Text>
        ) : (
          <>
            <Text className="mb-2 text-sm">
              {weight.change ? (
                weight.change.count > 1 ? (
                  <>
                    No período: <Text className="text-sm font-bold">{formatKg(weight.change.first)}</Text> → <Text className="text-sm font-bold">{formatKg(weight.change.last)}</Text> ({signed(weight.change.delta, " kg")})
                  </>
                ) : (
                  <>
                    Pesagem do período: <Text className="text-sm font-bold">{formatKg(weight.change.last)}</Text>
                  </>
                )
              ) : (
                <Text className="text-sm text-muted">Sem pesagem neste período.</Text>
              )}
            </Text>
            <TrendChart label="Peso" points={weight.points} emptyText="Duas pesagens ou mais nos últimos 4 meses mostram o gráfico." />
          </>
        )}
      </Card>
    </View>
  );
}
