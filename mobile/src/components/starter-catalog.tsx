import { View } from "react-native";
import { Copy, Dumbbell } from "lucide-react-native";
import { LEVELS, type StarterWorkout } from "@/lib/starter";
import { form } from "~/lib/api";
import { useCall } from "~/lib/use-action";
import { Alert, Button, Card, Text, useTheme } from "~/ui";

const repsLabel = (min: number | null, max: number | null) => (min && max && min !== max ? `${min}–${max}` : String(min ?? max ?? "—"));
const TECHNIQUE: Record<string, string> = { dropset: "drop-set", restpause: "rest-pause", piramide: "pirâmide", biset: "bi-set", triset: "tri-set", cluster: "cluster" };

/** Os treinos prontos por nível, com o botão para copiar os 4 de uma vez. */
export function StarterCatalog({ workouts, asTemplates, error }: { workouts: StarterWorkout[]; asTemplates: boolean; error?: string }) {
  const t = useTheme();
  const adopt = useCall("treinos-prontos-actions#adoptStarter");
  return (
    <>
      {error || adopt.error ? <Alert className="mb-4">{error ?? adopt.error ?? ""}</Alert> : null}
      <View className="gap-8">
        {LEVELS.map((lvl) => {
          const list = workouts.filter((w) => w.level === lvl.key);
          if (!list.length) return null;
          return (
            <View key={lvl.key}>
              <Text className="font-display text-2xl font-extrabold">
                {lvl.emoji} {lvl.label}
              </Text>
              <Text className="mb-3 text-sm text-muted">{lvl.sub}</Text>
              <View className="mb-3 gap-3">
                {list.map((w) => (
                  <Card key={w.id}>
                    <View className="flex-row items-center gap-2">
                      <Dumbbell color={t.bandeira500} size={20} />
                      <Text className="flex-1 font-display font-bold leading-tight">{w.name}</Text>
                    </View>
                    {w.goal ? <Text className="mt-0.5 text-xs text-muted">🎯 {w.goal}</Text> : null}
                    <View className="mt-2 gap-0.5">
                      {w.items.map((it, i) => (
                        <View key={i} className="flex-row justify-between gap-2">
                          <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>{it.equipment?.name ?? "Exercício"}</Text>
                          <Text className="text-sm text-muted">
                            {it.sets}× {repsLabel(it.reps_min, it.reps_max)}
                            {it.technique ? ` · ${TECHNIQUE[it.technique] ?? it.technique}` : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {w.notes ? <Text className="mt-2 text-xs text-muted">{w.notes}</Text> : null}
                  </Card>
                ))}
              </View>
              <Button icon={Copy} loading={adopt.pending} onPress={() => adopt.run(form({ level: lvl.key, as_templates: asTemplates ? "1" : undefined }))}>
                {asTemplates ? `Copiar os 4 treinos ${lvl.label} para os meus modelos` : `Usar os 4 treinos ${lvl.label}`}
              </Button>
            </View>
          );
        })}
      </View>
    </>
  );
}
