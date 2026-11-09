import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { FileDown, Repeat, Sheet, Timer, Weight } from "lucide-react-native";
import { equipmentImageSrc, groupLabel, type Equipment } from "@/lib/catalog";
import { formatKg, formatReps, formatRest, groupedWithNext, techniqueInfo } from "@/lib/plans";
import type { LoadedPlan } from "@/lib/plans-server";
import { downloadAndShare } from "~/lib/download";
import { Alert, Button, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";

/** Foto do aparelho ou o nome do grupo (placeholder do site). */
export function EquipmentImage({ equipment, className, size }: { equipment: Pick<Equipment, "name" | "image_path" | "image_url" | "muscle_group">; className?: string; size?: number }) {
  const src = equipmentImageSrc(equipment);
  const style = size ? { width: size, height: size * 0.75 } : { width: "100%" as const, aspectRatio: 4 / 3 };
  if (src) return <Image source={src} style={[style, { borderRadius: 12 }]} contentFit="cover" accessibilityLabel={equipment.name} />;
  return (
    <View style={style} className={cn("items-center justify-center rounded-xl bg-anil-700/5 dark:bg-white/5", className)}>
      <Text className="text-center text-xs font-semibold text-anil-700 dark:text-ipe-400">{groupLabel(equipment.muscle_group)}</Text>
    </View>
  );
}

/** Lista de exercícios da ficha (somente leitura). */
export function PlanItemsList({ items }: { items: LoadedPlan["items"] }) {
  const t = useTheme();
  const grouped = groupedWithNext(items.map((i) => i.technique));
  return (
    <View className="gap-3">
      {items.map((it, idx) => (
        <View key={it.id} className="flex-row gap-3 rounded-3xl border border-border bg-surface p-3">
          <View className="w-24">
            {it.equipment ? <EquipmentImage equipment={it.equipment} size={96} /> : <View className="h-[72px] items-center justify-center rounded-xl bg-border/40"><Text className="text-xs text-muted">?</Text></View>}
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-semibold leading-tight">
              <Text className="font-semibold text-bandeira-600 dark:text-bandeira-100">{idx + 1}. </Text>
              {it.equipment?.name ?? "Exercício indisponível"}
            </Text>
            {it.equipment ? <Text className="text-xs text-muted">{groupLabel(it.equipment.muscle_group)}</Text> : null}
            <View className="mt-2 flex-row flex-wrap gap-x-3 gap-y-1">
              <View className="flex-row items-center gap-1">
                <Repeat color={t.muted} size={14} />
                <Text className="text-sm">
                  {it.sets} × {formatReps(it.reps_min, it.reps_max) || "—"}
                  {it.equipment?.muscle_group === "cardio" ? " min" : ""}
                </Text>
              </View>
              {it.suggested_load != null ? (
                <View className="flex-row items-center gap-1">
                  <Weight color={t.muted} size={14} />
                  <Text className="text-sm">{formatKg(it.suggested_load)}</Text>
                </View>
              ) : null}
              {it.rest_seconds > 0 ? (
                <View className="flex-row items-center gap-1">
                  <Timer color={t.muted} size={14} />
                  <Text className="text-sm">{formatRest(it.rest_seconds)}</Text>
                </View>
              ) : null}
            </View>
            {it.technique ? (
              <View className="mt-1.5 flex-row flex-wrap items-center gap-1">
                <View className="rounded-full bg-ipe-100 px-2 py-0.5 dark:bg-ipe-500/20">
                  <Text className="text-xs font-bold text-anil-700 dark:text-ipe-400">{techniqueInfo(it.technique)?.label}</Text>
                </View>
                <Text className="text-xs text-muted">{techniqueInfo(it.technique)?.hint}</Text>
              </View>
            ) : null}
            {grouped[idx] > 0 && !it.technique ? <Text className="mt-1.5 text-xs font-semibold text-anil-700 dark:text-ipe-400">↳ continua no próximo exercício, sem descanso</Text> : null}
            {it.notes ? <Text className="mt-1 text-sm text-muted">💬 {it.notes}</Text> : null}
            {it.substitute ? <Text className="mt-1 text-xs text-muted">🔁 Se o aparelho estiver ocupado: {it.substitute.name}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Baixar a ficha em PDF (com folha para anotar) ou CSV, e compartilhar. */
export function PlanExportButtons({ planId, name }: { planId: string; name: string }) {
  const t = useTheme();
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const safe = name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "-") || "ficha";
  async function get(kind: "pdf" | "csv") {
    setBusy(kind);
    setError(null);
    try {
      await downloadAndShare(`/api/fichas/${planId}/${kind}`, `${safe}.${kind}`, kind === "pdf" ? "application/pdf" : "text/csv");
    } catch {
      setError("Não deu para baixar agora. Confira a internet.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <Button variant="ghost" className="border-2 border-border bg-surface" icon={FileDown} loading={busy === "pdf"} onPress={() => get("pdf")}>
          PDF
        </Button>
        <Button variant="ghost" className="border-2 border-border bg-surface" icon={Sheet} loading={busy === "csv"} onPress={() => get("csv")}>
          CSV
        </Button>
      </View>
      <Text className="text-xs text-muted">O PDF traz uma folha para imprimir e anotar à mão.</Text>
      {error ? <Alert>{error}</Alert> : null}
    </View>
  );
}
