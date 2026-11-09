import { Link } from "expo-router";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Loading, PageTitle, Screen, Text } from "~/ui";
import { AchievementsView } from "~/components/achievements-view";

export default function ConquistasPersonal() {
  const profile = useProfile();
  const q = useData(["achievements-personal", profile.id], async () => (await supabase.rpc("my_achievements", { p_audience: "personal" })).data ?? []);
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Conquistas exclusivas de Personal: alunos, fichas, modelos, registros, agenda e financeiro.">Conquistas de Personal</PageTitle>
      <Text className="mb-4 text-sm text-muted">
        As conquistas do seu próprio treino ficam em{" "}
        <Link href="/aluno/conquistas">
          <Text className="text-sm font-semibold text-bandeira-600 dark:text-bandeira-100">Meu treino → Conquistas</Text>
        </Link>
        .
      </Text>
      <AchievementsView rows={q.data} />
    </Screen>
  );
}
