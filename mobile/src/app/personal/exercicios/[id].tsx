import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Dumbbell, Trash2 } from "lucide-react-native";
import { groupLabel } from "@/lib/catalog";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { useCall } from "~/lib/use-action";
import { Alert, Badge, Button, Card, EmptyState, Loading, Screen, Text } from "~/ui";
import { CatalogPhoto, EquipmentForm } from "~/components/equipment-form";
import { ExerciseDemo } from "~/components/exercise-history";
import { EquipmentImage } from "~/components/plan-view";

export default function ExercicioPersonal() {
  const { id, salvo, erro, editar } = useLocalSearchParams<{ id: string; salvo?: string; erro?: string; editar?: string }>();
  const profile = useProfile();
  const [editing, setEditing] = useState(editar === "1");
  const q = useData(["equipment", id], async () => (await supabase.from("equipment").select("*, creator:profiles!equipment_created_by_fkey(full_name)").eq("id", id).maybeSingle()).data);
  const refresh = useRefresh(q);
  const del = useCall("personal/exercicios#deleteEquipment");
  if (q.isLoading) return <Loading />;
  const eq = q.data;
  if (!eq)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Dumbbell} title="Exercício não encontrado" />
      </Screen>
    );
  const mine = eq.created_by === profile.id;
  const canEdit = !profile.catalog_blocked && !eq.locked;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      {salvo ? <Alert kind="success" className="mb-4">{`Exercício salvo! ${!eq.image_path ? "Quando puder, adicione uma foto para o aluno reconhecer o equipamento." : ""}`}</Alert> : null}
      {erro || del.error ? <Alert className="mb-4">{erro ?? del.error ?? ""}</Alert> : null}
      {mine && canEdit && editing ? (
        <Card>
          <Text className="mb-4 font-display text-2xl font-extrabold">Editar exercício</Text>
          <EquipmentForm userId={profile.id} initial={eq} />
        </Card>
      ) : (
        <>
          <View className="mb-4">
            <EquipmentImage equipment={eq} />
          </View>
          <ExerciseDemo equipmentId={eq.id} name={eq.name} />
          <Text className="mt-4 font-display text-3xl font-extrabold leading-tight">{eq.name}</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            <Badge tone="green">{groupLabel(eq.muscle_group)}</Badge>
            {eq.is_bodyweight ? <Badge>Peso corporal</Badge> : null}
            {eq.is_default ? <Badge tone="yellow">Catálogo BoraTreinar</Badge> : <Badge tone="blue">{`Criado por ${mine ? "você" : (eq.creator?.full_name ?? "um Personal")}`}</Badge>}
          </View>
          {eq.description ? <Text className="mt-4 leading-relaxed">{eq.description}</Text> : null}
          {eq.image_credit ? <Text className="mt-4 text-xs text-muted">Imagem: {eq.image_credit}</Text> : null}
          {eq.locked || profile.catalog_blocked ? (
            <View className="mt-4 rounded-2xl bg-border/40 px-3 py-2">
              <Text className="text-sm text-muted">🔒 {eq.locked ? "Exercício travado pelo administrador: não pode ser editado." : "Sua conta está sem permissão para editar exercícios. Fale com o administrador."}</Text>
            </View>
          ) : null}
          {eq.is_default && canEdit ? <CatalogPhoto equipmentId={eq.id} userId={profile.id} hasPhoto={!!eq.image_path} /> : null}
          {mine && canEdit ? (
            <View className="mt-8 flex-row flex-wrap gap-3">
              <Button onPress={() => setEditing(true)}>Editar</Button>
              <Button
                variant="ghost"
                icon={Trash2}
                textClassName="text-pitanga-600"
                loading={del.pending}
                onPress={async () => {
                  if (await confirmAsk("Excluir este exercício?", { ok: "Excluir", destructive: true })) await del.run(form({ id: eq.id }));
                }}
              >
                Excluir
              </Button>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
