import { PageTitle, Screen } from "~/ui";
import { RequestsPanel } from "~/components/requests-panel";

export default function AdminPedidos() {
  return (
    <Screen edges={[]}>
      <PageTitle sub="Pedidos dos alunos. Adicione ao catálogo padrão, aponte um exercício que já existe ou descarte.">Exercícios pedidos</PageTitle>
      <RequestsPanel isAdmin blocked={false} back="/admin/pedidos" />
    </Screen>
  );
}
