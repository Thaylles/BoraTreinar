import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Dumbbell, Trash2 } from "lucide-react-native";
import { loadSession } from "@/lib/sessions-server";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { useCall } from "~/lib/use-action";
import { Button, EmptyState, Loading, Screen } from "~/ui";
import { SessionComments, SessionDetail } from "~/components/sessions";
import { SessionRating } from "~/components/workout-runner";
import { router } from "expo-router";

export default function AlunoSessao() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const profile = useProfile();
  const q = useData(["session", sessionId], () => loadSession(sessionId));
  const refresh = useRefresh(q);
  const del = useCall("treino-actions#deleteSession");
  if (q.isLoading) return <Loading />;
  const data = q.data;
  if (!data || data.session.student_id !== profile.id)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Dumbbell} title="Treino não encontrado" />
      </Screen>
    );
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <SessionDetail data={data} exerciseHref={(id) => `/aluno/exercicios/${id}`} />
      {data.session.effort == null && Date.parse(data.session.finished_at) > Date.now() - 7 * 86_400_000 ? (
        <View className="mt-6">
          <SessionRating sessionId={sessionId} />
        </View>
      ) : null}
      <SessionComments sessionId={sessionId} meId={profile.id} placeholder="Conte como foi ou tire uma dúvida com seu Personal…" />
      <Button
        variant="ghost"
        icon={Trash2}
        className="mt-8 self-start"
        textClassName="text-pitanga-600"
        loading={del.pending}
        onPress={async () => {
          if (!(await confirmAsk("Excluir este treino do histórico?", { ok: "Excluir", destructive: true }))) return;
          const r = await del.run(form({ id: sessionId }));
          if (r && !r.error) router.back();
        }}
      >
        Excluir treino
      </Button>
    </Screen>
  );
}
