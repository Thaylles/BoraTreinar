import { useState } from "react";
import { View } from "react-native";
import { Scale } from "lucide-react-native";
import { shortDay, type WeighInStatus } from "@/lib/weight-server";
import { spDateKey } from "@/lib/week";
import { useFormAction } from "~/lib/use-action";
import { Button, Card, Field, FormMessage, Input, Text, useTheme } from "~/ui";
import { DateField } from "~/ui/forms";

/** Registrar peso (uma pesagem por dia; a mesma ação do site). */
export function WeightForm({ next, lastKg, onSaved }: { next?: string; lastKg?: number | null; onSaved?: () => void }) {
  const today = spDateKey();
  const [kg, setKg] = useState("");
  const [date, setDate] = useState(today);
  const { state, pending, submit } = useFormAction("aluno/peso#saveWeight");
  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Peso (kg)">
            <Input
              value={kg}
              onChangeText={setKg}
              keyboardType="decimal-pad"
              placeholder={lastKg ? lastKg.toLocaleString("pt-BR") : "Ex.: 72,5"}
              className="text-center font-display text-2xl"
              style={{ fontFamily: "Baloo2_700Bold" }}
            />
          </Field>
        </View>
        <View className="w-36">
          <DateField label="Data" value={date} onChange={setDate} />
        </View>
      </View>
      <FormMessage state={state} />
      <Button
        size="lg"
        icon={Scale}
        loading={pending}
        onPress={async () => {
          const r = await submit({ weight_kg: kg, measured_on: date > today ? today : date, next });
          if (r && !r.error && !(r.result as { error?: string } | null)?.error) {
            setKg("");
            onSaved?.();
          }
        }}
      >
        Registrar peso
      </Button>
    </View>
  );
}

/** Trava antes do treino quando a pesagem venceu. */
export function WeighInGate({ status, onDone }: { status: WeighInStatus; onDone: () => void }) {
  const t = useTheme();
  return (
    <View className="gap-5 py-4">
      <View className="items-center">
        <View className="mb-3 size-16 items-center justify-center rounded-full bg-ipe-500">
          <Scale color={t.anil900} size={32} />
        </View>
        <Text className="text-center font-display text-3xl font-extrabold leading-tight">Hora da pesagem!</Text>
        <Text className="mt-2 text-center text-muted">
          {status.lastMeasuredOn
            ? `Sua última pesagem foi em ${shortDay(status.lastMeasuredOn)} e a frequência combinada é ${status.frequency}.`
            : "Você ainda não registrou seu peso."}{" "}
          Para iniciar o treino, registre seu peso de hoje. Leva 10 segundos. 💪
        </Text>
      </View>
      <Card>
        <WeightForm onSaved={onDone} />
      </Card>
      <Text className="text-center text-xs text-muted">Você escolhe se o seu Personal pode ver o peso na aba Peso.</Text>
    </View>
  );
}
