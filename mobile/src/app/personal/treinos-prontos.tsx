import { useLocalSearchParams } from "expo-router";
import { loadStarterWorkouts } from "@/lib/starter";
import { useData } from "~/lib/data";
import { Loading, PageTitle, Screen } from "~/ui";
import { StarterCatalog } from "~/components/starter-catalog";

export default function PersonalTreinosProntos() {
  const { erro } = useLocalSearchParams<{ erro?: string }>();
  const q = useData(["starter"], loadStarterWorkouts, { staleTime: 1000 * 60 * 60 });
  if (!q.data) return <Loading />;
  return (
    <Screen edges={[]}>
      <PageTitle sub="Copie os 4 treinos de um nível para os seus modelos, ajuste do seu jeito e aplique nos alunos.">Treinos prontos</PageTitle>
      <StarterCatalog workouts={q.data} asTemplates error={erro} />
    </Screen>
  );
}
