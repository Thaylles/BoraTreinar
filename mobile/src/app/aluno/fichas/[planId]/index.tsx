import { View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Dumbbell, Pencil, Play, Trash2 } from "lucide-react-native";
import { formatDate } from "@/lib/format";
import { loadPlan } from "@/lib/plans-server";
import { useData, useRefresh } from "~/lib/data";
import { confirmAsk } from "~/lib/confirm";
import { useProfile } from "~/lib/session";
import { form } from "~/lib/api";
import { useCall } from "~/lib/use-action";
import { Alert, Button, Card, EmptyState, LinkButton, Loading, Screen, Text } from "~/ui";
import { PlanExportButtons, PlanItemsList } from "~/components/plan-view";

export default function AlunoFicha() {
  const { planId, salvo } = useLocalSearchParams<{ planId: string; salvo?: string }>();
  const profile = useProfile();
  const q = useData(["plan", planId], () => loadPlan(planId));
  const refresh = useRefresh(q);
  const del = useCall("aluno/fichas#deleteMyPlan");
  if (q.isLoading) return <Loading />;
  if (!q.data || q.data.plan.is_template)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Dumbbell} title="Ficha não encontrada" />
      </Screen>
    );
  const { plan, items } = q.data;
  const mine = plan.created_by === profile.id && plan.student_id === profile.id;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      {salvo === "1" ? <Alert kind="success" className="mb-4">Ficha salva! ✅</Alert> : null}
      <Text className="font-display text-3xl font-extrabold leading-tight">{plan.name}</Text>
      {plan.goal ? <Text className="text-muted">🎯 {plan.goal}</Text> : null}
      <Text className="mb-4 mt-1 text-xs text-muted">
        {mine ? "Criada por você" : `Montada por ${plan.creator?.full_name ?? "seu Personal"}`}
        {plan.valid_until ? ` · válida até ${formatDate(`${plan.valid_until}T12:00:00`)}` : ""}
      </Text>
      {plan.notes ? (
        <Card className="mb-4">
          <Text className="text-sm">{plan.notes}</Text>
        </Card>
      ) : null}
      <LinkButton href={`/aluno/treinar/${plan.id}`} size="lg" icon={Play} className="mb-6">
        Iniciar treino
      </LinkButton>
      <PlanItemsList items={items} />
      <View className="mt-6">
        <PlanExportButtons planId={plan.id} name={plan.name} />
      </View>
      {mine ? (
        <View className="mt-6 gap-2">
          <View className="flex-row flex-wrap gap-2">
            <Button variant="ghost" className="border border-border" icon={Pencil} onPress={() => router.push(`/aluno/fichas/${plan.id}/editar`)}>
              Editar ficha
            </Button>
            <Button
              variant="ghost"
              icon={Trash2}
              textClassName="text-pitanga-600"
              loading={del.pending}
              onPress={async () => {
                if (await confirmAsk(`Excluir a ficha "${plan.name}"? Os treinos já feitos continuam no histórico.`, { ok: "Excluir", destructive: true })) await del.run(form({ id: plan.id }));
              }}
            >
              Excluir
            </Button>
          </View>
          <Link href="/aluno/privacidade">
            <Text className="text-xs font-semibold text-muted">Quer que seu Personal possa ajustar suas fichas? Libere aqui.</Text>
          </Link>
        </View>
      ) : null}
    </Screen>
  );
}
