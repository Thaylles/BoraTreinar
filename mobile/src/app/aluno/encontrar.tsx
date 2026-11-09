import { useState } from "react";
import { View } from "react-native";
import { Sparkles, UserSearch } from "lucide-react-native";
import { citiesLabel, cityName } from "@/lib/cities";
import { brl, pricePerClass } from "@/lib/finance";
import { firstName } from "@/lib/format";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { EmptyState, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { Avatar, WhatsAppButton } from "~/ui/extras";
import { CityFilter } from "~/components/city-filter";

export default function Encontrar() {
  const profile = useProfile();
  const t = useTheme();
  const [city, setCity] = useState<number | null>(null);
  const q = useData(["directory", city ?? 0], async () => {
    const first = await supabase.rpc("personal_directory", city ? { p_city: city } : {});
    const data = first.error && city ? (await supabase.rpc("personal_directory", {})).data : first.data;
    return (data ?? []).filter((p) => p.id !== profile.id);
  });
  const refresh = useRefresh(q);
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Opcional, mas faz diferença: com um Personal você treina com ficha montada para você, corrige a execução e evolui mais rápido.">Encontre um Personal</PageTitle>
      <View className="mb-5 flex-row items-start gap-3 rounded-2xl bg-ipe-100 p-4 dark:bg-ipe-500/15">
        <Sparkles color={t.dark ? t.ipe400 : t.anil900} size={20} />
        <Text className="flex-1 text-sm text-anil-900 dark:text-ipe-400">Chame no WhatsApp para combinar. Depois, o Personal te adiciona pelo seu e-mail ou WhatsApp e você só confirma aqui no app.</Text>
      </View>
      <View className="mb-5">
        <CityFilter current={city} onChange={setCity} />
      </View>
      {!q.data ? (
        <Loading />
      ) : !q.data.length ? (
        <EmptyState icon={UserSearch} title={city ? `Ainda não há Personal atendendo em ${cityName(city)}` : "Nenhum Personal disponível ainda"}>
          {city ? "Tente uma cidade vizinha ou volte em breve: novos Personais entram toda semana." : "Novos Personais aparecem aqui assim que se cadastram. Enquanto isso, você já pode registrar seus treinos."}
        </EmptyState>
      ) : (
        <View className="gap-3">
          {q.data.map((p) => (
            <View key={p.id} className="rounded-3xl border border-border bg-surface p-4">
              <View className="flex-row items-center gap-3">
                <Avatar path={p.avatar_path} name={p.full_name} size={64} />
                <View className="min-w-0 flex-1">
                  <Text className="font-display text-lg font-bold" numberOfLines={1}>{p.full_name}</Text>
                  <Text className="text-sm text-muted">{p.age ? `${p.age} anos` : "Personal Trainer"}</Text>
                  {p.cities?.length ? <Text className="text-sm text-muted">📍 Atende em {citiesLabel(p.cities)}</Text> : null}
                  <Text className="text-sm">
                    {p.min_class_price != null ? (
                      <>
                        a partir de <Text className="text-sm font-bold">{brl(Number(p.min_class_price))}</Text> por aula
                      </>
                    ) : (
                      <Text className="text-sm text-muted">Valor a combinar</Text>
                    )}
                  </Text>
                </View>
              </View>
              {p.packages.length ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {p.packages.map((k) => (
                    <View key={k.name} className="rounded-full bg-border/50 px-3 py-1">
                      <Text className="text-xs">
                        <Text className="text-xs font-bold">{k.name}</Text> · {k.kind === "mensal" ? `${brl(Number(k.price))}/mês (≈ ${brl(pricePerClass({ ...k, price: Number(k.price) }))}/aula)` : `${brl(Number(k.price))} por aula`}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <WhatsAppButton
                phone={p.phone}
                className="mt-3"
                text={`Olá, ${firstName(p.full_name)}! Te encontrei no BoraTreinar e quero saber mais sobre suas aulas. Meu nome é ${profile.full_name}.`}
              />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
