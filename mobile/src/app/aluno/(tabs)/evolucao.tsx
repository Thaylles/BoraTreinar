import { useState } from "react";
import { loadDashboard } from "@/lib/dashboard-server";
import type { PeriodKind } from "@/lib/stats";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Loading, PageTitle, Screen, Text } from "~/ui";
import { ShortcutCard } from "~/ui/extras";
import { AchievementsCard } from "~/components/widgets";
import { DashboardView } from "~/components/dashboard-view";

export default function AlunoEvolucao() {
  const profile = useProfile();
  const [period, setPeriod] = useState<{ kind: PeriodKind; ref?: string }>({ kind: "semana" });
  const q = useData(["dashboard", profile.id, period.kind, period.ref ?? ""], () => loadDashboard(profile.id, period.kind, period.ref), { placeholderData: (prev) => prev });
  const ach = useData(["achievements", profile.id], async () => (await supabase.rpc("my_achievements", {})).data ?? []);
  const refresh = useRefresh(q, ach);
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Seu progresso na semana e no mês.">Evolução</PageTitle>
      <ShortcutCard
        href="/aluno/resumo"
        emoji="📊"
        title="Resumo do mês"
        sub="Treinos, recordes, frequência e cardio — para compartilhar no WhatsApp e Instagram."
        className="border-0 bg-bandeira-600"
        titleClassName="text-white"
        subClassName="text-white/85"
      />
      <AchievementsCard rows={ach.data ?? []} href="/aluno/conquistas" />
      {q.data ? (
        <DashboardView
          data={q.data}
          onPeriod={(kind, ref) => setPeriod({ kind, ref })}
          exerciseHref={(eid) => `/aluno/exercicios/${eid}`}
          weightHiddenText="Registre seu peso na aba Peso para acompanhar aqui."
        />
      ) : q.isError ? (
        <Text className="text-muted">Sem internet e sem dados salvos ainda.</Text>
      ) : (
        <Loading />
      )}
    </Screen>
  );
}
