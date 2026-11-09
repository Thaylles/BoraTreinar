import { useLocalSearchParams } from "expo-router";
import { Users } from "lucide-react-native";
import { loadCatalogFor } from "@/lib/plans-server";
import { loadCautions } from "@/lib/health-server";
import { useData } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { EmptyState, Loading, PageTitle, Screen } from "~/ui";
import { PlanEditor } from "~/components/plan-editor";

export default function NovaFichaParaAluno() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useData(["new-plan-for", id], async () => {
    const [{ data: student }, { count }, catalog, cautions] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", id).in("role", ["aluno", "admin"]).maybeSingle(),
      supabase.from("workout_plans").select("id", { count: "exact", head: true }).eq("student_id", id).is("archived_at", null),
      loadCatalogFor(id),
      loadCautions(id),
    ]);
    return { student, count: count ?? 0, catalog, cautions };
  }, { staleTime: 0 });
  if (q.isLoading) return <Loading />;
  if (!q.data?.student)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Users} title="Aluno não encontrado" />
      </Screen>
    );
  const letter = String.fromCharCode(65 + Math.min(q.data.count, 25));
  return (
    <Screen edges={[]}>
      <PageTitle sub={`Para ${q.data.student.full_name}`}>Nova ficha</PageTitle>
      <PlanEditor cautions={q.data.cautions} catalog={q.data.catalog} initial={{ planId: null, studentId: id, name: `Treino ${letter}`, goal: "", notes: "", validUntil: "", items: [] }} />
    </Screen>
  );
}
