import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Users } from "lucide-react-native";
import { loadDashboard } from "@/lib/dashboard-server";
import { getStudentSettings } from "@/lib/weight-server";
import type { PeriodKind } from "@/lib/stats";
import { useData, useRefresh } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { EmptyState, Loading, PageTitle, Screen } from "~/ui";
import { DashboardView } from "~/components/dashboard-view";
import { CoachInsights } from "~/components/personal-overview";

export default function EvolucaoDoAluno() {
  const { id, periodo } = useLocalSearchParams<{ id: string; periodo?: string }>();
  const [period, setPeriod] = useState<{ kind: PeriodKind; ref?: string }>({ kind: periodo === "mes" ? "mes" : "semana" });
  const student = useData(["student-name", id], async () => (await supabase.from("profiles").select("full_name").eq("id", id).in("role", ["aluno", "admin"]).maybeSingle()).data);
  const q = useData(["student-dashboard", id, period.kind, period.ref ?? ""], async () => {
    const [data, settings] = await Promise.all([loadDashboard(id, period.kind, period.ref, { insights: true }), getStudentSettings(id)]);
    return { data, settings };
  }, { placeholderData: (p) => p });
  const refresh = useRefresh(q, student);
  if (student.isLoading || !q.data) return <Loading />;
  if (!student.data)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Users} title="Aluno não encontrado" />
      </Screen>
    );
  const { data, settings } = q.data;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Alertas, volume por grupo, força estimada e o resumo da semana ou do mês.">Evolução de {student.data.full_name}</PageTitle>
      {data.insights && data.hasAnySession ? <CoachInsights insights={data.insights} names={data.names} exerciseHref={(eid) => `/personal/alunos/${id}/exercicios/${eid}`} /> : null}
      <DashboardView
        data={data}
        onPeriod={(kind, ref) => setPeriod({ kind, ref })}
        exerciseHref={(eid) => `/personal/alunos/${id}/exercicios/${eid}`}
        weightHiddenText={settings.weightVisible ? "Nenhuma pesagem registrada ainda." : "🔒 O aluno não compartilha o peso com os Personais."}
      />
    </Screen>
  );
}
