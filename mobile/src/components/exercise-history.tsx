import { View } from "react-native";
import { Link, type Href } from "expo-router";
import { Trophy } from "lucide-react-native";
import { groupLabel } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { formatKg } from "@/lib/plans";
import { mediaUrl } from "@/lib/exercise-media";
import type { loadExerciseTimeline } from "@/lib/sessions-server";
import { useData } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { Badge, Text, useTheme } from "~/ui";
import { TrendChart } from "./charts";
import { EquipmentImage } from "./plan-view";
import { MediaPreview } from "./workout-runner";

type Data = Awaited<ReturnType<typeof loadExerciseTimeline>>;

export function ExerciseHistory({ data, sessionHref }: { data: Data; sessionHref: (id: string) => Href }) {
  const t = useTheme();
  const { equipment, entries, best } = data;
  if (!equipment) return null;
  const last = entries[entries.length - 1];
  const lastDone = last?.sets.filter((s) => s.done) ?? [];
  return (
    <>
      <View className="mb-4 flex-row items-center gap-3">
        <EquipmentImage equipment={equipment} size={80} />
        <View className="flex-1 gap-1">
          <Text className="font-display text-2xl font-extrabold leading-tight">{equipment.name}</Text>
          <Badge tone="green">{groupLabel(equipment.muscle_group)}</Badge>
        </View>
      </View>
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1 rounded-3xl border border-border bg-surface p-4">
          <Text className="text-xs text-muted">Última vez{last ? ` · ${formatDate(last.date)}` : ""}</Text>
          <Text className="font-display text-lg font-bold">{lastDone.length ? lastDone.map((s) => `${s.load.toLocaleString("pt-BR")}×${s.reps}`).join(" · ") : "—"}</Text>
        </View>
        <View className="flex-1 rounded-3xl bg-ipe-500 p-4">
          <View className="flex-row items-center gap-1">
            <Trophy color={t.anil900} size={14} />
            <Text className="text-xs font-semibold text-anil-900">Recorde pessoal</Text>
          </View>
          <Text className="font-display text-2xl font-extrabold text-anil-900">{best > 0 ? formatKg(best) : "—"}</Text>
        </View>
      </View>
      <View className="mb-6 rounded-3xl border border-border bg-surface p-4">
        <Text className="mb-2 font-display text-lg font-bold">Maior carga por treino</Text>
        <TrendChart label="Maior carga" emptyText="Registre pelo menos dois treinos para ver o gráfico de evolução." points={entries.map((e) => ({ date: e.date, value: e.maxLoad, highlight: e.pr }))} />
      </View>
      <Text className="mb-2 font-display text-lg font-bold">Histórico completo</Text>
      {!entries.length ? (
        <Text className="text-sm text-muted">Ainda não há registros deste exercício.</Text>
      ) : (
        <View>
          <View className="flex-row py-1">
            <Text className="w-20 text-xs font-semibold text-muted">Data</Text>
            <Text className="flex-1 text-xs font-semibold text-muted">Séries feitas</Text>
            <Text className="text-right text-xs font-semibold text-muted">Maior</Text>
          </View>
          {[...entries].reverse().map((e) => (
            <View key={e.id} className="flex-row gap-2 border-t border-border py-2">
              <Link href={sessionHref(e.id)} className="w-20">
                <Text className="text-sm underline">{formatDate(e.date)}</Text>
              </Link>
              <Text className="flex-1 text-sm">{e.sets.filter((s) => s.done).map((s) => `${s.load.toLocaleString("pt-BR")}×${s.reps}`).join(", ") || "—"}</Text>
              <Text className="text-right text-sm font-semibold">
                {e.maxLoad.toLocaleString("pt-BR")} kg{e.pr ? " 🏆" : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

/** "Como executar": GIF ou vídeo aprovado pelo admin. */
export function ExerciseDemo({ equipmentId, name }: { equipmentId: string; name: string }) {
  const q = useData(["exercise-demo", equipmentId], async () => (await supabase.from("exercise_media").select("path, kind, credit").eq("equipment_id", equipmentId).eq("status", "aprovado").maybeSingle()).data);
  const d = q.data;
  if (!d?.path) return null;
  return (
    <View className="mt-6">
      <Text className="mb-2 font-display text-lg font-bold">▶ Como executar</Text>
      <MediaPreview url={mediaUrl(d.path)} kind={d.kind} label={`Execução de ${name}`} />
      {d.credit ? <Text className="mt-1 text-center text-[11px] text-muted">{d.credit}</Text> : null}
    </View>
  );
}
