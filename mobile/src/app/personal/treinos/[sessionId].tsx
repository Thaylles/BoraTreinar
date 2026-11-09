import { router, useLocalSearchParams } from "expo-router";
import { Dumbbell, Trash2 } from "lucide-react-native";
import { loadSession } from "@/lib/sessions-server";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { useCall } from "~/lib/use-action";
import { Button, EmptyState, Loading, Screen } from "~/ui";
import { SessionComments, SessionDetail } from "~/components/sessions";

export default function PersonalSessao() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const profile = useProfile();
  const q = useData(["session", sessionId], () => loadSession(sessionId));
  const refresh = useRefresh(q);
  const del = useCall("treino-actions#deleteSession");
  if (q.isLoading) return <Loading />;
  if (!q.data)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Dumbbell} title="Treino não encontrado" />
      </Screen>
    );
  const studentId = q.data.session.student_id;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <SessionDetail data={q.data} exerciseHref={(id) => `/personal/alunos/${studentId}/exercicios/${id}`} />
      <SessionComments sessionId={sessionId} meId={profile.id} placeholder="Dê um retorno sobre o treino: elogio, ajuste de carga, técnica…" />
      {q.data.session.logged_by === profile.id ? (
        <Button
          variant="ghost"
          icon={Trash2}
          className="mt-8 self-start"
          textClassName="text-pitanga-600"
          onPress={async () => {
            if (!(await confirmAsk("Excluir este registro de treino?", { ok: "Excluir", destructive: true }))) return;
            const r = await del.run(form({ id: sessionId }));
            if (r && !r.error) router.back();
          }}
        >
          Excluir registro
        </Button>
      ) : null}
    </Screen>
  );
}
