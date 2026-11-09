import { useLocalSearchParams } from "expo-router";
import { loadStarterWorkouts } from "@/lib/starter";
import { useData } from "~/lib/data";
import { Loading, PageTitle, Screen, Text } from "~/ui";
import { StarterCatalog } from "~/components/starter-catalog";

export default function TreinosProntos() {
  const { erro } = useLocalSearchParams<{ erro?: string }>();
  const q = useData(["starter"], loadStarterWorkouts, { staleTime: 1000 * 60 * 60 });
  if (!q.data) return <Loading />;
  return (
    <Screen edges={[]}>
      <PageTitle sub="Escolha o seu nível: os 4 treinos viram fichas suas, e você pode ajustar o que quiser depois.">Treinos prontos</PageTitle>
      <StarterCatalog workouts={q.data} asTemplates={false} error={erro} />
      <Text className="mt-6 text-xs text-muted">Sugestões gerais para quem está começando. Se tiver dor, lesão ou alguma condição de saúde, fale com um profissional antes de treinar.</Text>
    </Screen>
  );
}
