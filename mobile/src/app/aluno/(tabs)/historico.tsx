import { History } from "lucide-react-native";
import { listSessions } from "@/lib/sessions-server";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { EmptyState, LinkButton, Loading, PageTitle, Screen } from "~/ui";
import { SessionList } from "~/components/sessions";

export default function Historico() {
  const profile = useProfile();
  const q = useData(["sessions", profile.id], () => listSessions(profile.id, 60));
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Todos os treinos que você já registrou.">Histórico</PageTitle>
      <LinkButton href="/aluno/registrar-passado" variant="ghost" className="mb-4 self-start border-2 border-dashed border-bandeira-500/60" textClassName="text-sm text-bandeira-700 dark:text-bandeira-100">
        📅 Registrar treino esquecido (últimos 7 dias)
      </LinkButton>
      {!q.data.length ? (
        <EmptyState icon={History} title="Nenhum treino ainda">
          Escolha uma ficha no início e bora!
        </EmptyState>
      ) : (
        <SessionList sessions={q.data} href={(id) => `/aluno/historico/${id}`} />
      )}
    </Screen>
  );
}
