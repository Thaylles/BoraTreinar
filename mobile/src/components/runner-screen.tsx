import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dumbbell } from "lucide-react-native";
import { getWeighInStatus } from "@/lib/weight-server";
import { useData } from "~/lib/data";
import { Button, EmptyState, Loading, Screen } from "~/ui";
import { WeighInGate } from "./weight";
import { WorkoutRunner, type BackdateInfo, type RunnerExercise } from "./workout-runner";

type Loaded = { name: string; planId: string | null; exercises: RunnerExercise[] } | null;

/**
 * Tela de treino: carrega os exercícios (fica salvo no aparelho para treinar sem internet),
 * aplica a trava da pesagem e abre o executor.
 */
export function RunnerScreen({
  queryKey,
  load,
  studentId,
  kind,
  storageKey,
  backHref,
  selfHref,
  backdate,
  checkWeighIn = true,
  loggedByInstructor,
}: {
  queryKey: unknown[];
  load: () => Promise<Loaded>;
  studentId: string;
  kind: "ficha" | "livre";
  storageKey: string;
  backHref: string;
  selfHref: string;
  backdate?: BackdateInfo | null;
  checkWeighIn?: boolean;
  loggedByInstructor?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const q = useData(queryKey, load, { staleTime: 1000 * 60 * 5 });
  const weigh = useData(["weigh-in", studentId], () => getWeighInStatus(studentId), { enabled: checkWeighIn && !backdate });
  if (q.isLoading) return <Loading label="Carregando treino…" />;
  const data = q.data;
  if (!data || !data.exercises.length)
    return (
      <Screen>
        <View style={{ paddingTop: insets.top }}>
          <EmptyState icon={Dumbbell} title="Treino não encontrado">
            {q.isError ? "Sem internet e este treino ainda não foi aberto neste aparelho." : "Essa ficha não existe mais ou está vazia."}
          </EmptyState>
          <Button className="mt-4" onPress={() => router.replace(backHref as never)}>
            Voltar
          </Button>
        </View>
      </Screen>
    );
  if (checkWeighIn && !backdate && weigh.data?.overdue)
    return (
      <Screen>
        <WeighInGate status={weigh.data} onDone={() => void weigh.refetch()} />
      </Screen>
    );
  return (
    <WorkoutRunner
      studentId={studentId}
      planId={data.planId}
      planName={data.name}
      kind={kind}
      exercises={data.exercises}
      storageKey={storageKey}
      backHref={backHref}
      selfHref={selfHref}
      backdate={backdate}
      loggedByInstructor={loggedByInstructor}
    />
  );
}
