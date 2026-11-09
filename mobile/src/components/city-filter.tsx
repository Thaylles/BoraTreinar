import { useState } from "react";
import { Pressable, View } from "react-native";
import { MapPin, X } from "lucide-react-native";
import { CITY_STATE, cityName, searchCities } from "@/lib/cities";
import { Field, Input, Text, useTheme } from "~/ui";

/** Filtro de cidade da busca de Personais. */
export function CityFilter({ current, onChange }: { current: number | null; onChange: (code: number | null) => void }) {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const options = query ? searchCities(query) : [];
  if (current && cityName(current))
    return (
      <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
        <MapPin color={t.bandeira600} size={20} />
        <Text className="flex-1">
          Personais que atendem em <Text className="font-bold">{cityName(current)}</Text>
        </Text>
        <Pressable onPress={() => onChange(null)} className="flex-row items-center gap-1">
          <X color={t.muted} size={16} />
          <Text className="text-sm font-semibold text-muted">Trocar</Text>
        </Pressable>
      </View>
    );
  return (
    <Field label="Em qual cidade você treina?">
      <Input value={query} onChangeText={setQuery} placeholder={`Digite sua cidade (${CITY_STATE})…`} autoCorrect={false} />
      {query ? (
        <View className="rounded-2xl border border-border bg-surface p-1">
          {options.length ? (
            options.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => {
                  setQuery("");
                  onChange(c.code);
                }}
                className="flex-row items-center gap-2 rounded-xl px-3 py-2"
              >
                <MapPin color={t.muted} size={16} />
                <Text className="text-sm">{c.name}</Text>
              </Pressable>
            ))
          ) : (
            <Text className="px-3 py-2 text-sm text-muted">Nenhuma cidade do {CITY_STATE} com esse nome.</Text>
          )}
        </View>
      ) : null}
    </Field>
  );
}
