import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Lock } from "lucide-react-native";
import { formatDate } from "@/lib/format";
import { achievementStats, shortNumber, TIER_ICON, TIER_LABEL, TIER_POINTS, type AchievementRow } from "@/lib/achievements";
import { Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Gradient } from "~/ui/extras";
import { Chip } from "./exercise-picker";

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "conquistadas", label: "Conquistadas" },
  { key: "faltam", label: "A conquistar" },
  { key: "secretas", label: "Secretas" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];
const TIER_RING: Record<AchievementRow["tier"], string> = { bronze: "#b45309", prata: "#94a3b8", ouro: "#ffc72c", platina: "#38bdf8" };

/** Sala de troféus: resumo, filtros e conquistas por categoria. */
export function AchievementsView({ rows, initialFilter = "todas" }: { rows: AchievementRow[]; initialFilter?: string }) {
  const [filter, setFilter] = useState<Filter>((FILTERS.find((f) => f.key === initialFilter)?.key ?? "todas") as Filter);
  const stats = achievementStats(rows);
  const list = rows.filter((r) => (filter === "conquistadas" ? r.unlocked_at : filter === "faltam" ? !r.unlocked_at : filter === "secretas" ? r.hidden : true));
  const categories = [...new Set(list.map((r) => r.category))];
  const hasSecrets = rows.some((r) => r.hidden);
  const filters = hasSecrets ? FILTERS : FILTERS.filter((f) => f.key !== "secretas");
  const pct = Math.round((stats.unlocked / Math.max(1, stats.total)) * 100);
  return (
    <>
      <Gradient tone="anil" className="mb-5">
        <View className="p-5">
          <View className="flex-row items-end justify-between gap-3">
            <View>
              <Text className="text-sm text-white/75">Conquistas</Text>
              <Text className="font-display text-4xl font-extrabold text-white">
                {stats.unlocked}
                <Text className="font-display text-xl text-white/60">/{stats.total}</Text>
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm text-white/75">Pontos</Text>
              <Text className="font-display text-2xl font-bold text-white">{stats.points.toLocaleString("pt-BR")}</Text>
            </View>
          </View>
          <View className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20">
            <View className="h-full rounded-full bg-ipe-500" style={{ width: `${pct}%` }} />
          </View>
          <View className="mt-3 flex-row gap-2">
            {stats.byTier.map((t) => (
              <View key={t.tier} className="flex-1 items-center rounded-xl bg-white/10 px-1 py-2">
                <Text className="text-lg">{TIER_ICON[t.tier]}</Text>
                <Text className="text-xs font-bold text-white">
                  {t.got}/{t.total}
                </Text>
                <Text className="text-xs text-white/70">{TIER_LABEL[t.tier]}</Text>
              </View>
            ))}
          </View>
          {hasSecrets ? <Text className="mt-3 text-xs text-white/75">🔒 {stats.hiddenLeft} conquistas secretas ainda escondidas. Você só descobre quando liberar!</Text> : null}
        </View>
      </Gradient>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 mb-4" contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {filters.map((f) => (
          <Chip key={f.key} active={filter === f.key} onPress={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </ScrollView>
      {!list.length ? <Text className="text-sm text-muted">Nada por aqui ainda. Bora treinar! 💪</Text> : null}
      {categories.map((cat) => (
        <View key={cat} className="mb-6">
          <Text className="mb-2 font-display text-lg font-bold">{cat}</Text>
          <View className="gap-2">
            {list
              .filter((r) => r.category === cat)
              .map((r) => (
                <AchievementCard key={r.code} r={r} />
              ))}
          </View>
        </View>
      ))}
    </>
  );
}

function AchievementCard({ r }: { r: AchievementRow }) {
  const t = useTheme();
  const got = !!r.unlocked_at;
  const secret = r.hidden && !got;
  const pct = r.threshold ? Math.min(100, Math.round(((r.progress ?? 0) / r.threshold) * 100)) : 0;
  return (
    <View className={cn("flex-row items-center gap-3 rounded-2xl border bg-surface p-3", got ? "border-ipe-400/70" : "border-border")}>
      <View className="size-14 items-center justify-center rounded-full p-[3px]" style={{ backgroundColor: got ? TIER_RING[r.tier] : t.border }}>
        <View className={cn("size-full items-center justify-center rounded-full bg-surface", !got && "opacity-50")}>
          {secret ? <Lock color={t.muted} size={20} /> : <Text className="text-2xl">{r.emoji}</Text>}
        </View>
      </View>
      <View className="min-w-0 flex-1">
        <Text className={cn("font-semibold leading-tight", !got && "text-muted")}>{secret ? "Conquista secreta" : r.title}</Text>
        <Text className="text-xs text-muted">{secret ? "Continue treinando para descobrir." : r.description}</Text>
        {got ? (
          <Text className="mt-1 text-[11px] font-semibold text-bandeira-700 dark:text-bandeira-100">
            {TIER_ICON[r.tier]} {TIER_LABEL[r.tier]} · +{TIER_POINTS[r.tier]} · {formatDate(r.unlocked_at!)}
            {r.hidden ? " · secreta" : ""}
          </Text>
        ) : secret ? (
          <Text className="mt-1 text-[11px] text-muted">
            {TIER_ICON[r.tier]} {TIER_LABEL[r.tier]}
          </Text>
        ) : (
          <View className="mt-1.5 flex-row items-center gap-2">
            <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
              <View className="h-full rounded-full bg-bandeira-500" style={{ width: `${pct}%` }} />
            </View>
            <Text className="text-[11px] text-muted">
              {shortNumber(Number(r.progress ?? 0))}/{shortNumber(Number(r.threshold ?? 0))} {TIER_ICON[r.tier]}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
