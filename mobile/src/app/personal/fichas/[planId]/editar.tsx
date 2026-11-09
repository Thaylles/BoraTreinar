import { Redirect, useLocalSearchParams } from "expo-router";
import { ClipboardList } from "lucide-react-native";
import { loadCatalogFor, loadPlan } from "@/lib/plans-server";
import { loadCautions } from "@/lib/health-server";
import { toEditorItems } from "@/lib/plans";
import { useData } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { EmptyState, Loading, PageTitle, Screen } from "~/ui";
import { PlanEditor } from "~/components/plan-editor";

export default function EditarFichaPersonal() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const q = useData(["personal-plan-edit", planId], async () => {
    const loaded = await loadPlan(planId);
    if (!loaded) return null;
    const [{ data: canEdit }, catalog, cautions] = await Promise.all([supabase.rpc("can_edit_plan", { p_plan: planId }), loadCatalogFor(loaded.plan.student_id), loadCautions(loaded.plan.student_id)]);
    return { loaded, canEdit: !!canEdit, catalog, cautions };
  }, { staleTime: 0 });
  if (q.isLoading) return <Loading />;
  if (!q.data)
    return (
      <Screen edges={[]}>
        <EmptyState icon={ClipboardList} title="Ficha não encontrada" />
      </Screen>
    );
  if (!q.data.canEdit) return <Redirect href={`/personal/fichas/${planId}`} />;
  const { plan, items } = q.data.loaded;
  return (
    <Screen edges={[]}>
      <PageTitle sub={plan.is_template ? "Modelo" : `Ficha de ${plan.student?.full_name ?? "aluno"}`}>Editar ficha</PageTitle>
      <PlanEditor
        cautions={q.data.cautions}
        catalog={q.data.catalog}
        initial={{ planId, studentId: plan.student_id, name: plan.name, goal: plan.goal ?? "", notes: plan.notes ?? "", validUntil: plan.valid_until ?? "", items: toEditorItems(items) }}
      />
    </Screen>
  );
}
