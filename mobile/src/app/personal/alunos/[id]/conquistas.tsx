import { useLocalSearchParams } from "expo-router";
import { Trophy } from "lucide-react-native";
import { useData, useRefresh } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { EmptyState, Loading, PageTitle, Screen } from "~/ui";
import { AchievementsView } from "~/components/achievements-view";

export default function ConquistasDoAluno() {
  const { id, filtro } = useLocalSearchParams<{ id: string; filtro?: string }>();
  const q = useData(["student-achievements", id], async () => {
    const [{ data: student }, { data, error }] = await Promise.all([supabase.from("profiles").select("full_name").eq("id", id).maybeSingle(), supabase.rpc("my_achievements", { p_student: id })]);
    return student && !error ? { name: student.full_name, rows: data ?? [] } : null;
  });
  const refresh = useRefresh(q);
  if (q.isLoading) return <Loading />;
  if (!q.data)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Trophy} title="Aluno não encontrado" />
      </Screen>
    );
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub={`${q.data.name} · as secretas só aparecem depois que o aluno libera.`}>Conquistas</PageTitle>
      <AchievementsView rows={q.data.rows} initialFilter={filtro} />
    </Screen>
  );
}
