import { useLocalSearchParams } from "expo-router";
import { Dumbbell } from "lucide-react-native";
import { loadExerciseTimeline } from "@/lib/sessions-server";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { EmptyState, Loading, Screen } from "~/ui";
import { ExerciseDemo, ExerciseHistory } from "~/components/exercise-history";

export default function AlunoExercicio() {
  const { equipmentId } = useLocalSearchParams<{ equipmentId: string }>();
  const profile = useProfile();
  const q = useData(["exercise-timeline", profile.id, equipmentId], () => loadExerciseTimeline(profile.id, equipmentId));
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
      <ExerciseHistory data={q.data} sessionHref={(id) => `/aluno/historico/${id}`} />
      <ExerciseDemo equipmentId={equipmentId} name={q.data.equipment.name} />
    </Screen>
  );
}
