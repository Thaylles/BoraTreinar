import { useLocalSearchParams } from "expo-router";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Loading, PageTitle, Screen } from "~/ui";
import { AchievementsView } from "~/components/achievements-view";

export default function Conquistas() {
  const profile = useProfile();
  const { filtro } = useLocalSearchParams<{ filtro?: string }>();
  const q = useData(["achievements", profile.id], async () => (await supabase.rpc("my_achievements", {})).data ?? []);
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Treine, bata metas e recordes para liberar troféus. Algumas são secretas! 🤫">Conquistas</PageTitle>
      <AchievementsView rows={q.data} initialFilter={filtro} />
    </Screen>
  );
}
