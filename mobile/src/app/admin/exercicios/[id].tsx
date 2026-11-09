import { useState } from "react";
import { TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { Dumbbell, ImagePlus, RotateCcw, Trash2 } from "lucide-react-native";
import { equipmentImageSrc, groupLabel, MUSCLE_GROUPS, type MuscleGroup } from "@/lib/catalog";
import { adminData } from "~/lib/admin-data";
import { confirmAsk } from "~/lib/confirm";
import { useData } from "~/lib/data";
import { readBase64, type Picked } from "~/lib/upload";
import { useFormAction } from "~/lib/use-action";
import { Alert, Badge, Button, Card, EmptyState, FormMessage, inputClass, Loading, Screen, Text, useTheme } from "~/ui";
import { Checkbox, Select, TextField } from "~/ui/forms";
import { PhotoButtons } from "~/components/equipment-form";

type Eq = NonNullable<Awaited<ReturnType<typeof import("@/app/admin/mobile-data").adminEquipmentData>>>;

function AdminEquipmentForm({ eq }: { eq: Eq["equipment"] }) {
  const t = useTheme();
  const [file, setFile] = useState<Picked | null>(null);
  const [remove, setRemove] = useState(false);
  const [name, setName] = useState(eq.name);
  const [group, setGroup] = useState<string>(eq.muscle_group);
  const [description, setDescription] = useState(eq.description ?? "");
  const [bodyweight, setBodyweight] = useState(eq.is_bodyweight);
  const [locked, setLocked] = useState(eq.locked);
  const [err, setErr] = useState<string | null>(null);
  const { state, pending, submit } = useFormAction("admin#adminSaveEquipment");
  const preview = file?.uri ?? (remove ? equipmentImageSrc({ image_path: null, image_url: eq.image_url }) : equipmentImageSrc(eq));
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm font-semibold">Foto</Text>
        {preview ? (
          <Image source={preview} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: "#fff" }} contentFit="contain" accessibilityLabel={eq.name} />
        ) : (
          <View className="items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-10">
            <ImagePlus color={t.muted} size={40} />
          </View>
        )}
        <PhotoButtons
          small
          onPick={(f) => {
            setFile(f);
            setRemove(false);
          }}
        />
        {file || (eq.image_path && !remove) ? (
          <Button variant="ghost" size="sm" icon={RotateCcw} className="self-start" onPress={() => (file ? setFile(null) : setRemove(true))}>
            {file ? "Desfazer troca" : eq.image_url ? "Voltar à ilustração do catálogo" : "Remover foto"}
          </Button>
        ) : null}
        {file || remove ? <Text className="text-xs text-muted">A foto muda quando você salvar.</Text> : null}
      </View>
      <TextField label="Nome" value={name} onChangeText={setName} maxLength={80} />
      <Select label="Grupo muscular" value={group} onChange={setGroup} options={MUSCLE_GROUPS.map((g) => ({ value: g.value as string, label: g.label }))} />
      <View className="gap-1.5">
        <Text className="text-sm font-semibold">Descrição / dicas de execução</Text>
        <TextInput value={description} onChangeText={setDescription} multiline maxLength={1000} className={inputClass} style={{ fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" }} />
      </View>
      <Checkbox checked={bodyweight} onChange={setBodyweight}>
        Exercício com peso corporal (aceita carga 0)
      </Checkbox>
      <Checkbox checked={locked} onChange={setLocked}>
        🔒 Travado: nenhum Personal edita, exclui ou troca a foto
      </Checkbox>
      {err ? <Alert>{err}</Alert> : <FormMessage state={state} />}
      <Button
        size="lg"
        loading={pending}
        onPress={async () => {
          setErr(null);
          try {
            const photo = file ? { __file: { name: file.name, type: file.mime, base64: await readBase64(file.uri) } } : undefined;
            const r = await submit({ id: eq.id, name, muscle_group: group, description, is_bodyweight: bodyweight, locked, photo, remove_photo: remove ? "1" : undefined });
            if ((r?.result as { ok?: string } | null)?.ok) {
              setFile(null);
              setRemove(false);
            }
          } catch {
            setErr("Não foi possível ler a foto.");
          }
        }}
      >
        {pending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </View>
  );
}

function DeleteEquipment({ equipment, usage, options }: { equipment: { id: string; name: string; muscle_group: MuscleGroup }; usage: { plans: number; sets: number }; options: { id: string; name: string; muscle_group: MuscleGroup }[] }) {
  const [replacement, setReplacement] = useState("");
  const { state, pending, submit } = useFormAction("admin#adminDeleteEquipment");
  const inUse = usage.plans + usage.sets > 0;
  const chosen = options.find((o) => o.id === replacement);
  return (
    <View className="gap-3">
      <Text className="text-sm text-muted">
        {inUse
          ? `Está em uso: ${usage.plans} ${usage.plans === 1 ? "item de ficha" : "itens de fichas"} e ${usage.sets} ${usage.sets === 1 ? "série registrada" : "séries registradas"}. Escolha o exercício que fica no lugar dele: fichas e histórico dos alunos passam para o substituto.`
          : "Não está em nenhuma ficha nem treino registrado: pode excluir direto. A foto e as execuções (GIF/vídeo) saem junto."}
      </Text>
      {inUse ? (
        <Select
          value={replacement}
          onChange={setReplacement}
          placeholder="Substituir por…"
          options={[
            ...options.filter((o) => o.muscle_group === equipment.muscle_group).map((o) => ({ value: o.id, label: o.name, group: groupLabel(equipment.muscle_group) })),
            ...options.filter((o) => o.muscle_group !== equipment.muscle_group).map((o) => ({ value: o.id, label: `${o.name} (${groupLabel(o.muscle_group)})`, group: "Outros grupos" })),
          ]}
        />
      ) : null}
      <FormMessage state={state} />
      <Button
        variant="danger"
        icon={Trash2}
        className="self-start"
        loading={pending}
        disabled={inUse && !replacement}
        onPress={async () => {
          const msg = inUse ? `Excluir "${equipment.name}"? As fichas e os treinos registrados passam para "${chosen?.name}". Não dá para desfazer.` : `Excluir "${equipment.name}" do catálogo? Não dá para desfazer.`;
          if (await confirmAsk(msg, { ok: "Excluir", destructive: true })) await submit({ id: equipment.id, name: equipment.name, replacement: replacement || undefined });
        }}
      >
        {inUse ? "Substituir e excluir" : "Excluir exercício"}
      </Button>
    </View>
  );
}

export default function AdminExercicio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useData(["admin-equipment-item", id], () => adminData("adminEquipmentData", id));
  if (q.isLoading) return <Loading />;
  if (!q.data)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Dumbbell} title="Exercício não encontrado" />
      </Screen>
    );
  const { equipment: eq, usage, options } = q.data;
  return (
    <Screen edges={[]}>
      <Card>
        <Text className="font-display text-2xl font-extrabold">Editar exercício</Text>
        <View className="mb-4 mt-2 flex-row flex-wrap gap-2">
          {eq.is_default ? <Badge tone="yellow">Catálogo BoraTreinar</Badge> : <Badge tone="blue">{`De ${eq.owner?.full_name ?? "Personal excluído"}`}</Badge>}
          {eq.image_credit ? <Badge>{`Imagem: ${eq.image_credit}`}</Badge> : null}
        </View>
        <AdminEquipmentForm eq={eq} />
      </Card>
      <Card className="mt-6 border-pitanga-500/40">
        <Text className="mb-2 font-display text-lg font-bold text-pitanga-600">Excluir exercício</Text>
        <DeleteEquipment equipment={eq} usage={usage} options={options} />
      </Card>
    </Screen>
  );
}
