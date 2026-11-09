import { useProfile } from "~/lib/session";
import { Card, PageTitle, Screen, Text } from "~/ui";
import { EquipmentForm } from "~/components/equipment-form";

export default function NovoExercicio() {
  const profile = useProfile();
  return (
    <Screen edges={[]}>
      <PageTitle sub="Fica disponível para você e para os seus alunos.">Novo exercício</PageTitle>
      <Card>{profile.catalog_blocked ? <Text className="text-sm text-muted">🔒 Sua conta está sem permissão para criar exercícios. Fale com o administrador.</Text> : <EquipmentForm userId={profile.id} />}</Card>
    </Screen>
  );
}
