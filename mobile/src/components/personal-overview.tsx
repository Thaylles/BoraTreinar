import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Link, type Href } from "expo-router";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BicepsFlexed, ChevronRight, Gauge, Moon, Trophy } from "lucide-react-native";
import { groupLabel, type MuscleGroup } from "@/lib/catalog";
import { formatKg, periodFor, type PeriodKind } from "@/lib/stats";
import { daysAgoLabel, daysAgoSP, spDateKey, spMidnightISO } from "@/lib/week";
import type { GroupVolume, Stagnation, StrengthTrend } from "@/lib/evolution";
import { useData } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { Card, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Segmented } from "~/ui/forms";

type OverviewRow = { student_id: string; sessions: number; volume: number; last_at: string | null };
const INACTIVE_DAYS = 7;
const MEDALS = ["🥇", "🥈", "🥉"];

/** Visão geral do Personal: ranking de frequência e alunos sem treinar. */
export function PersonalOverview({ personalId }: { personalId: string }) {
  const t = useTheme();
  const [kind, setKind] = useState<PeriodKind>("semana");
  const period = periodFor(kind, spDateKey());
  const q = useData(["personal-overview", personalId, kind], async () => {
    const [{ data: links }, { data: overview }] = await Promise.all([
      supabase.from("personal_students").select("student:profiles!personal_students_student_id_fkey(id, full_name)").eq("personal_id", personalId).eq("status", "ativo").is("archived_at", null),
      supabase.rpc("training_overview", { p_since: spMidnightISO(period.from) }),
    ]);
    return { links: links ?? [], overview: (overview ?? []) as unknown as OverviewRow[] };
  }, { placeholderData: (p) => p });
  if (!q.data) return null;
  const stats = new Map(q.data.overview.map((r) => [r.student_id, r]));
  const students = q.data.links
    .map((l) => l.student)
    .filter((s): s is { id: string; full_name: string } => !!s)
    .map((s) => {
      const r = stats.get(s.id);
      return { ...s, sessions: Number(r?.sessions ?? 0), volume: Number(r?.volume ?? 0), daysAgo: r?.last_at ? daysAgoSP(r.last_at) : null };
    });
  if (!students.length) return null;
  const ranking = [...students].sort((a, b) => b.sessions - a.sessions || b.volume - a.volume || a.full_name.localeCompare(b.full_name, "pt-BR"));
  const inactive = students.filter((s) => s.daysAgo === null || s.daysAgo >= INACTIVE_DAYS).sort((a, b) => (b.daysAgo ?? 99_999) - (a.daysAgo ?? 99_999));
  const total = students.reduce((a, s) => a + s.sessions, 0);
  const active = students.filter((s) => s.sessions > 0).length;
  return (
    <View className="mb-8 gap-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-display text-xl font-bold">Visão geral</Text>
        <View className="w-44">
          <Segmented options={[{ value: "semana", label: "Semana" }, { value: "mes", label: "Mês" }]} value={kind} onChange={(k) => setKind(k as PeriodKind)} />
        </View>
      </View>
      <Text className="-mt-2 text-sm text-muted">
        {kind === "semana" ? "Nesta semana (seg–dom)" : `Em ${period.label.toLowerCase()}`}: <Text className="text-sm font-bold">{total}</Text> {total === 1 ? "treino" : "treinos"},{" "}
        <Text className="text-sm font-bold">{active}</Text> de {students.length} {students.length === 1 ? "aluno treinou" : "alunos treinaram"}.
      </Text>
      <Card>
        <View className="mb-2 flex-row items-center gap-2">
          <Trophy color={t.ipe600} size={20} />
          <Text className="font-display text-lg font-bold">Ranking de frequência</Text>
        </View>
        <View className="-mx-2">
          {ranking.map((s, i) => (
            <Link key={s.id} href={`/personal/alunos/${s.id}/evolucao?periodo=${kind}`} asChild>
              <Pressable className="flex-row items-center gap-3 rounded-2xl p-2 active:bg-border/40">
                <Text className="w-7 text-center font-display font-bold text-muted">{s.sessions > 0 && i < 3 ? MEDALS[i] : `${i + 1}º`}</Text>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold" numberOfLines={1}>{s.full_name}</Text>
                  <Text className="text-xs text-muted">{s.volume > 0 ? `${formatKg(s.volume)} de volume` : "sem volume no período"}</Text>
                </View>
                <Text className="font-display text-xl font-extrabold">{s.sessions}</Text>
                <ChevronRight color={t.muted} size={16} />
              </Pressable>
            </Link>
          ))}
        </View>
      </Card>
      <Card>
        <View className="mb-2 flex-row items-center gap-2">
          <Moon color={t.anil500} size={20} />
          <Text className="font-display text-lg font-bold">Sem treinar há {INACTIVE_DAYS}+ dias</Text>
        </View>
        {inactive.length ? (
          <View className="-mx-2">
            {inactive.map((s) => (
              <Link key={s.id} href={`/personal/alunos/${s.id}`} asChild>
                <Pressable className="flex-row items-center gap-3 rounded-2xl p-2 active:bg-border/40">
                  <Text className="min-w-0 flex-1 text-sm font-semibold" numberOfLines={1}>{s.full_name}</Text>
                  <View className="rounded-full bg-pitanga-100 px-2 py-0.5 dark:bg-pitanga-500/20">
                    <Text className="text-xs font-bold text-pitanga-600">{s.daysAgo === null ? "nunca treinou" : daysAgoLabel(s.daysAgo)}</Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted">Todo mundo treinou nos últimos {INACTIVE_DAYS} dias. Mandou bem! 🎉</Text>
        )}
      </Card>
    </View>
  );
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Estagnação, séries por grupo muscular e força estimada (1RM). */
export function CoachInsights({ insights, names, exerciseHref }: { insights: { trends: StrengthTrend[]; stagnant: Stagnation[]; volume: { weeks: string[]; groups: GroupVolume[] } }; names: Record<string, string>; exerciseHref: (id: string) => Href }) {
  const t = useTheme();
  const { trends, stagnant, volume } = insights;
  const max = Math.max(1, ...volume.groups.flatMap((g) => g.weeks));
  return (
    <View className="mb-6 gap-4">
      <Card className={cn(stagnant.length && "border-2 border-pitanga-500/50")}>
        <View className="mb-2 flex-row items-center gap-2">
          <AlertTriangle color={stagnant.length ? t.pitanga500 : t.muted} size={20} />
          <Text className="font-display text-lg font-bold">Alertas de estagnação</Text>
        </View>
        {stagnant.length ? (
          stagnant.map((s) => (
            <Link key={s.id} href={exerciseHref(s.id)} asChild>
              <Pressable className="flex-row items-center gap-3 rounded-2xl p-2">
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold" numberOfLines={1}>{names[s.id] ?? "Exercício"}</Text>
                  <Text className="text-xs text-muted">{s.sessions} treinos desde a última evolução · máx {formatKg(s.load)}</Text>
                </View>
                <View className="rounded-full bg-pitanga-100 px-2.5 py-1 dark:bg-pitanga-500/20">
                  <Text className="text-xs font-bold text-pitanga-600">{s.weeks} semanas sem subir carga</Text>
                </View>
              </Pressable>
            </Link>
          ))
        ) : (
          <Text className="text-sm text-muted">Nenhum exercício parado: tudo evoluindo nas últimas 3 semanas. 👏</Text>
        )}
      </Card>
      <Card>
        <View className="mb-1 flex-row items-center gap-2">
          <BicepsFlexed color={t.bandeira500} size={20} />
          <Text className="font-display text-lg font-bold">Séries por grupo muscular</Text>
        </View>
        <Text className="mb-3 text-xs text-muted">Séries feitas por semana (seg–dom), da mais antiga à atual. Referência comum: 10 a 20 por grupo.</Text>
        {volume.groups.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View className="flex-row py-1">
                <Text className="w-28 text-xs font-semibold text-muted">Grupo</Text>
                {volume.weeks.map((w, i) => (
                  <Text key={w} className="w-11 text-center text-xs font-semibold text-muted">{i === volume.weeks.length - 1 ? "Atual" : ddmm(w)}</Text>
                ))}
                <Text className="w-14 text-right text-xs font-semibold text-muted">Média</Text>
              </View>
              {volume.groups.map((g) => (
                <View key={g.group} className="flex-row items-center border-t border-border py-2">
                  <Text className="w-28 text-sm font-semibold">{groupLabel(g.group as MuscleGroup)}</Text>
                  {g.weeks.map((n, i) => (
                    <View key={i} className="w-11 items-center">
                      <View className="h-7 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: n ? `rgba(0,156,59,${(0.15 + (n / max) * 0.7).toFixed(2)})` : undefined }}>
                        <Text className="text-xs font-bold">{n || "—"}</Text>
                      </View>
                    </View>
                  ))}
                  <Text className="w-14 text-right font-display font-bold">{g.avg.toLocaleString("pt-BR")}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Text className="text-sm text-muted">Sem treinos de musculação nas últimas 4 semanas.</Text>
        )}
      </Card>
      <Card>
        <View className="mb-1 flex-row items-center gap-2">
          <Gauge color={t.anil500} size={20} />
          <Text className="font-display text-lg font-bold">Força estimada (1RM)</Text>
        </View>
        <Text className="mb-2 text-xs text-muted">Carga máxima estimada para 1 repetição (fórmula de Epley, melhor série de até 12 reps). Últimas 4 semanas × as 4 anteriores.</Text>
        {trends.length ? (
          trends.slice(0, 10).map((tr) => (
            <Link key={tr.id} href={exerciseHref(tr.id)} asChild>
              <Pressable className="flex-row items-center gap-3 rounded-2xl p-2">
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold" numberOfLines={1}>{names[tr.id] ?? "Exercício"}</Text>
                  <Text className="text-xs text-muted">{tr.previous ? `antes ${formatKg(tr.previous)}` : "sem base nas 4 semanas anteriores"} · em {ddmm(tr.date)}</Text>
                </View>
                <View className="items-end">
                  <Text className="font-display text-lg font-bold">{formatKg(tr.current)}</Text>
                  {tr.deltaPct !== null && tr.deltaPct !== 0 ? (
                    <View className="flex-row items-center">
                      {tr.deltaPct > 0 ? <ArrowUpRight color={t.bandeira600} size={14} /> : <ArrowDownRight color={t.pitanga600} size={14} />}
                      <Text className={cn("text-xs font-semibold", tr.deltaPct > 0 ? "text-bandeira-600 dark:text-bandeira-100" : "text-pitanga-600")}>{Math.abs(tr.deltaPct).toLocaleString("pt-BR")}%</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </Link>
          ))
        ) : (
          <Text className="text-sm text-muted">Sem séries com carga nas últimas 4 semanas.</Text>
        )}
      </Card>
    </View>
  );
}
