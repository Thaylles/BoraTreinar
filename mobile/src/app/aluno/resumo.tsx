import { Pressable, View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react-native";
import { monthShareText, monthSummary } from "@/lib/month-summary";
import { addDays, addMonths, monthGrid } from "@/lib/schedule";
import { formatKg, type SummarySession } from "@/lib/stats";
import { spDateKey } from "@/lib/week";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Card, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Gradient } from "~/ui/extras";
import { MonthShare } from "~/components/month-share";

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`);

async function load(studentId: string, month: string, today: string) {
  const { data } = await supabase.rpc("training_summary", { p_student: studentId });
  const sessions = (data ?? []) as unknown as SummarySession[];
  const ids = sessions.filter((s) => s.date.startsWith(month)).map((s) => s.id);
  const { data: cardioSets } = ids.length
    ? await supabase.from("session_sets").select("duration_min, distance_km").in("session_id", ids).eq("done", true).not("duration_min", "is", null)
    : { data: [] as { duration_min: number | null; distance_km: number | null }[] };
  const cardio = (cardioSets ?? []).reduce((a, s) => ({ minutes: a.minutes + Number(s.duration_min ?? 0), km: a.km + Number(s.distance_km ?? 0) }), { minutes: 0, km: 0 });
  const summary = monthSummary(sessions, month, today, cardio);
  const prIds = summary.prs.map((p) => p.id);
  const { data: equipment } = prIds.length ? await supabase.from("equipment").select("id, name").in("id", prIds) : { data: [] as { id: string; name: string }[] };
  return { summary, names: Object.fromEntries((equipment ?? []).map((e) => [e.id, e.name])) as Record<string, string>, first: sessions[0]?.date.slice(0, 7) };
}

export default function ResumoMensal() {
  const profile = useProfile();
  const t = useTheme();
  const sp = useLocalSearchParams<{ mes?: string }>();
  const today = spDateKey();
  const current = today.slice(0, 7);
  const month = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) && sp.mes <= current ? sp.mes : current;
  const q = useData(["resumo", profile.id, month], () => load(profile.id, month, today), { placeholderData: (p) => p });
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  const { summary, names, first } = q.data;
  const grid = monthGrid(month);
  const days = Array.from({ length: grid.days }, (_, i) => addDays(grid.start, i));
  const active = new Set(summary.activeDays);
  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const diff = summary.sessions - summary.prevSessions;
  const stats = [
    { label: "dias treinados", value: String(summary.activeDays.length) },
    { label: "por semana", value: summary.perWeek.toLocaleString("pt-BR") },
    { label: "treinando", value: hours(summary.minutes) },
    { label: "levantados", value: formatKg(Math.round(summary.volume)) },
  ];
  const go = (m: string) => router.setParams({ mes: m });
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Seus treinos do mês, prontos para compartilhar.">Resumo do mês</PageTitle>
      <View className="mb-4 flex-row items-center justify-between gap-2">
        {first && prevMonth >= first ? (
          <Pressable onPress={() => go(prevMonth)} className="flex-row items-center gap-1 rounded-xl px-2 py-1.5" accessibilityLabel="Mês anterior">
            <ChevronLeft color={t.muted} size={16} />
            <Text className="text-sm font-semibold text-muted">Anterior</Text>
          </Pressable>
        ) : (
          <View className="w-20" />
        )}
        <Text className="font-display text-lg font-bold">{summary.label}</Text>
        {nextMonth <= current ? (
          <Pressable onPress={() => go(nextMonth)} className="flex-row items-center gap-1 rounded-xl px-2 py-1.5" accessibilityLabel="Próximo mês">
            <Text className="text-sm font-semibold text-muted">Próximo</Text>
            <ChevronRight color={t.muted} size={16} />
          </Pressable>
        ) : (
          <View className="w-20" />
        )}
      </View>

      <Gradient className="mb-4">
        <View className="p-5">
          <Text className="text-sm font-semibold text-white/80">{summary.label}</Text>
          <Text className="font-display text-5xl font-extrabold leading-none text-white">
            {summary.sessions} <Text className="font-display text-2xl font-extrabold text-white">{summary.sessions === 1 ? "treino" : "treinos"}</Text>
          </Text>
          <Text className="mt-1 text-sm text-white/85">
            {summary.prevSessions === 0 && summary.sessions === 0
              ? "Nenhum treino registrado neste mês."
              : diff === 0
                ? "Mesma quantidade do mês anterior."
                : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} em relação ao mês anterior${diff > 0 ? " 🔥" : ""}.`}
          </Text>
          <View className="mt-4 flex-row flex-wrap justify-between gap-y-2">
            {stats.map((s) => (
              <View key={s.label} className="rounded-2xl bg-white/10 px-3 py-2" style={{ width: "48.5%" }}>
                <Text className="text-xs text-white/80">{s.label}</Text>
                <Text className="font-display text-xl font-extrabold text-white">{s.value}</Text>
              </View>
            ))}
          </View>
          {summary.cardio.minutes > 0 ? (
            <Text className="mt-3 text-sm font-semibold text-white">
              🏃 {summary.cardio.minutes} min de cardio{summary.cardio.km > 0 ? ` · ${summary.cardio.km.toLocaleString("pt-BR")} km` : ""}
            </Text>
          ) : null}
          <View className="mt-4 flex-row flex-wrap">
            {WEEKDAYS.map((d, i) => (
              <View key={`h${i}`} style={{ width: `${100 / 7}%` }} className="items-center pb-1">
                <Text className="text-[11px] font-bold text-white/70">{d}</Text>
              </View>
            ))}
            {days.map((d) => (
              <View key={d} style={{ width: `${100 / 7}%` }} className="p-0.5">
                <View className={cn("aspect-square items-center justify-center rounded-lg", !d.startsWith(month) ? "opacity-0" : active.has(d) ? "bg-ipe-500" : "bg-white/10")}>
                  <Text className={cn("text-[11px] font-semibold", active.has(d) ? "text-anil-900" : "text-white/70")}>{Number(d.slice(8))}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Gradient>

      <MonthShare summary={summary} names={names} text={monthShareText(summary, names)} />

      <Card className="mt-4">
        <View className="mb-2 flex-row items-center gap-2">
          <Trophy color={t.ipe500} size={20} />
          <Text className="font-display text-lg font-bold">Recordes do mês</Text>
        </View>
        {summary.prs.length ? (
          summary.prs.map((p) => (
            <View key={p.id} className="flex-row items-center justify-between gap-3 rounded-xl px-2 py-1.5">
              <Link href={`/aluno/exercicios/${p.id}`} className="min-w-0 flex-1">
                <Text className="text-sm font-semibold underline" numberOfLines={1}>{names[p.id] ?? "Exercício"}</Text>
              </Link>
              <Text className="font-display font-bold">{formatKg(p.load)}</Text>
            </View>
          ))
        ) : (
          <Text className="text-sm text-muted">Nenhum recorde neste mês. Bora bater um no próximo treino!</Text>
        )}
        {summary.topPlan ? (
          <Text className="mt-3 text-sm text-muted">
            Ficha mais treinada: <Text className="text-sm font-bold">{summary.topPlan.name}</Text> ({summary.topPlan.count}×) · {summary.weeksActive} {summary.weeksActive === 1 ? "semana" : "semanas"} com treino · {summary.sets} séries
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}
