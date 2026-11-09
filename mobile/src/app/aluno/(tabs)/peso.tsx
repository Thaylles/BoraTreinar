import { useState } from "react";
import { Pressable, View } from "react-native";
import { CalendarClock, Lock, Trash2, Unlock } from "lucide-react-native";
import { getStudentSettings, getWeighInStatus, listWeights, shortDay } from "@/lib/weight-server";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { useCall, useFormAction } from "~/lib/use-action";
import { Alert, Button, Card, FormMessage, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { Segmented, Toggle } from "~/ui/forms";
import { TrendChart } from "~/components/charts";
import { WeightForm } from "~/components/weight";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function WeightSettingsForm({ visible, frequency }: { visible: boolean; frequency: "semanal" | "quinzenal" }) {
  const [v, setV] = useState(visible);
  const [f, setF] = useState(frequency);
  const { state, pending, submit } = useFormAction("aluno/peso#saveWeightSettings");
  return (
    <View className="gap-4">
      <Toggle value={v} onChange={setV} title="Meu Personal pode ver meu peso" sub="Desligado, o peso não aparece para nenhum Personal em nenhuma tela, gráfico ou relatório." />
      <View>
        <Text className="mb-2 font-semibold">Frequência de pesagem</Text>
        <Segmented
          options={[
            { value: "semanal", label: "Semanal (7 dias)" },
            { value: "quinzenal", label: "Quinzenal (14 dias)" },
          ]}
          value={f}
          onChange={(x) => setF(x as typeof f)}
        />
      </View>
      <FormMessage state={state} />
      <Button variant="secondary" loading={pending} onPress={() => submit({ weight_visible: v, frequency: f })}>
        Salvar preferências
      </Button>
    </View>
  );
}

export default function Peso() {
  const profile = useProfile();
  const t = useTheme();
  const q = useData(["peso", profile.id], async () => {
    const [status, weights, settings] = await Promise.all([getWeighInStatus(profile.id), listWeights(profile.id), getStudentSettings(profile.id)]);
    return { status, weights, settings };
  });
  const refresh = useRefresh(q);
  const del = useCall("aluno/peso#deleteWeight");
  if (!q.data) return <Loading />;
  const { status, weights, settings } = q.data;
  const last = weights[0];
  const first = weights[weights.length - 1];
  const diff = last && first && last !== first ? last.weight_kg - first.weight_kg : null;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Acompanhe seu peso e escolha quem pode ver.">Peso corporal</PageTitle>
      {status.overdue ? (
        <Alert className="mb-4">Pesagem vencida: registre seu peso para liberar os treinos.</Alert>
      ) : (
        <Alert kind="success" className="mb-4">
          <View className="flex-row items-center gap-1">
            <CalendarClock color={t.dark ? t.bandeira100 : t.bandeira700} size={16} />
            <Text className="text-sm text-bandeira-700 dark:text-bandeira-100">Pesagem em dia. Próxima até {status.dueOn ? shortDay(status.dueOn) : "—"}.</Text>
          </View>
        </Alert>
      )}
      <View className="mb-4 flex-row gap-3">
        <Card className="flex-1 p-4">
          <Text className="text-xs text-muted">Último peso{last ? ` · ${shortDay(last.measured_on)}` : ""}</Text>
          <Text className="font-display text-3xl font-extrabold">{last ? `${fmt(last.weight_kg)} kg` : "—"}</Text>
        </Card>
        <Card className="flex-1 p-4">
          <Text className="text-xs text-muted">Variação no período</Text>
          <Text className="font-display text-3xl font-extrabold">{diff == null ? "—" : `${diff > 0 ? "+" : ""}${fmt(diff)} kg`}</Text>
        </Card>
      </View>
      <Card className="mb-4">
        <Text className="mb-3 font-display text-lg font-bold">Registrar peso</Text>
        <WeightForm lastKg={last?.weight_kg} />
      </Card>
      <Card className="mb-4">
        <Text className="mb-2 font-display text-lg font-bold">Evolução</Text>
        <TrendChart label="Peso" emptyText="Registre pelo menos duas pesagens para ver o gráfico." points={[...weights].reverse().map((w) => ({ date: w.measured_on, value: w.weight_kg }))} />
      </Card>
      <Card className="mb-4">
        <View className="mb-3 flex-row items-center gap-2">
          {settings.weightVisible ? <Unlock color={t.foreground} size={20} /> : <Lock color={t.foreground} size={20} />}
          <Text className="font-display text-lg font-bold">Privacidade e frequência</Text>
        </View>
        <WeightSettingsForm key={`${settings.weightVisible}${settings.frequency}`} visible={settings.weightVisible} frequency={settings.frequency} />
      </Card>
      {weights.length ? (
        <View>
          <Text className="mb-2 font-display text-lg font-bold">Histórico</Text>
          <View className="rounded-3xl border border-border bg-surface">
            {weights.map((w, i) => (
              <View key={w.id} className={`flex-row items-center justify-between px-4 py-2.5 ${i ? "border-t border-border" : ""}`}>
                <Text className="text-sm text-muted">
                  {shortDay(w.measured_on)}/{w.measured_on.slice(0, 4)}
                </Text>
                <Text className="text-sm font-semibold">{fmt(w.weight_kg)} kg</Text>
                <Pressable
                  accessibilityLabel="Excluir pesagem"
                  className="rounded-lg p-1.5"
                  onPress={async () => {
                    if (await confirmAsk("Excluir esta pesagem?", { ok: "Excluir", destructive: true })) await del.run(form({ id: w.id }));
                  }}
                >
                  <Trash2 color={t.muted} size={16} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
