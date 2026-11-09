import { useLocalSearchParams } from "expo-router";
import { Dumbbell } from "lucide-react-native";
import { loadCatalogFor, loadPlan } from "@/lib/plans-server";
import { toEditorItems } from "@/lib/plans";
import { useData } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { EmptyState, Loading, PageTitle, Screen } from "~/ui";
import { PlanEditor } from "~/components/plan-editor";

/** O aluno edita só as fichas que ele mesmo criou. */
export default function EditarFichaAluno() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const profile = useProfile();
  const q = useData(["plan-edit", planId], async () => ({ loaded: await loadPlan(planId), catalog: await loadCatalogFor(profile.id) }), { staleTime: 0 });
  if (q.isLoading) return <Loading />;
  const loaded = q.data?.loaded;
  if (!loaded || loaded.plan.is_template || loaded.plan.created_by !== profile.id || loaded.plan.student_id !== profile.id)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Dumbbell} title="Ficha não encontrada" />
      </Screen>
    );
  const { plan, items } = loaded;
  return (
    <Screen edges={[]}>
      <PageTitle>Editar ficha</PageTitle>
      <PlanEditor
        mode="aluno"
        catalog={q.data!.catalog}
        initial={{ planId, studentId: profile.id, name: plan.name, goal: plan.goal ?? "", notes: plan.notes ?? "", validUntil: "", items: toEditorItems(items) }}
      />
    </Screen>
  );
}
