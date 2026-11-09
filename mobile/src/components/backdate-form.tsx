import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { CalendarClock } from "lucide-react-native";
import { Button, Text } from "~/ui";
import { Select, TimeField } from "~/ui/forms";

const DURATIONS = [20, 30, 40, 45, 50, 60, 75, 90, 120];

/** Treino esquecido: ficha (ou livre), dia, horário e duração; segue para a tela do treino. */
export function BackdateForm({
  plans,
  days,
  today,
  nowTime,
  planBase,
  freeHref,
  who = "você",
}: {
  plans: { id: string; name: string }[];
  days: { value: string; label: string }[];
  today: string;
  nowTime: string;
  planBase: string;
  freeHref?: string;
  who?: string;
}) {
  const [plan, setPlan] = useState(plans[0]?.id ?? (freeHref ? "livre" : ""));
  const [day, setDay] = useState(days[1]?.value ?? today);
  const [time, setTime] = useState("18:00");
  const [minutes, setMinutes] = useState("60");
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const future = day === today && time > nowTime;
  function go() {
    if (future || !plan || !validTime) return;
    const q = `passado=${day}T${time}&min=${minutes}`;
    router.push((plan === "livre" && freeHref ? `${freeHref}?${q}` : `${planBase}/${plan}?${q}`) as never);
  }
  return (
    <View className="gap-4 rounded-3xl border border-border bg-surface p-4">
      <Select
        label={`O que ${who} treinou?`}
        value={plan}
        onChange={setPlan}
        options={[...plans.map((p) => ({ value: p.id, label: p.name })), ...(freeHref ? [{ value: "livre", label: "Treino livre (escolher os exercícios)" }] : [])]}
      />
      <Select
        label="Dia"
        value={day}
        onChange={setDay}
        options={days.map((d) => ({ value: d.value, label: `${d.label}${d.label === "Hoje" || d.label === "Ontem" ? `, ${d.value.slice(8, 10)}/${d.value.slice(5, 7)}` : ""}` }))}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <TimeField label="Começou às" value={time} onChange={setTime} />
        </View>
        <View className="flex-1">
          <Select
            label="Duração"
            value={minutes}
            onChange={setMinutes}
            options={DURATIONS.map((m) => ({ value: String(m), label: m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` }))}
          />
        </View>
      </View>
      {future ? <Text className="text-sm font-semibold text-pitanga-600">Esse horário ainda não chegou hoje.</Text> : null}
      <Text className="text-xs text-muted">
        Na próxima tela, marque as séries que {who === "você" ? "você fez" : `${who} fez`} (com carga e repetições) e finalize. Se o treino foi só cardio, a duração vira o tempo do cardio.
      </Text>
      <Button size="lg" icon={CalendarClock} disabled={future || !plan || !validTime} onPress={go}>
        Continuar
      </Button>
    </View>
  );
}
