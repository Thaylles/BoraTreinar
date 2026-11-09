import { useProfile } from "~/lib/session";
import { PageTitle, Screen } from "~/ui";
import { RequestsPanel } from "~/components/requests-panel";

export default function PedidosExercicio() {
  const profile = useProfile();
  return (
    <Screen edges={[]}>
      <PageTitle sub="Alunos não encontraram estes exercícios. Ao adicionar, ele entra no catálogo padrão para todos e quem pediu é avisado.">Exercícios pedidos</PageTitle>
      <RequestsPanel isAdmin={profile.role === "admin"} blocked={profile.catalog_blocked} back="/personal/exercicios/pedidos" />
    </Screen>
  );
}
