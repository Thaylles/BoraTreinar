import { useLocalSearchParams } from "expo-router";
import { Dumbbell } from "lucide-react-native";
import { loadExerciseTimeline } from "@/lib/sessions-server";
import { useData, useRefresh } from "~/lib/data";
import { EmptyState, Loading, Screen } from "~/ui";
import { ExerciseHistory } from "~/components/exercise-history";

export default function ExercicioDoAluno() {
  const { id, equipmentId } = useLocalSearchParams<{ id: string; equipmentId: string }>();
  const q = useData(["exercise-timeline", id, equipmentId], () => loadExerciseTimeline(id, equipmentId));
  const refresh = useRefresh(q);
  if (q.isLoading) return <Loading />;
  if (!q.data?.equipment)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Dumbbell} title="Exercício não encontrado" />
      </Screen>
    );
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <ExerciseHistory data={q.data} sessionHref={(sid) => `/personal/treinos/${sid}`} />
    </Screen>
  );
}
