import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Camera, ImagePlus, RotateCcw, Trash2 } from "lucide-react-native";
import { EQUIPMENT_BUCKET, equipmentImageSrc, MUSCLE_GROUPS, type Equipment } from "@/lib/catalog";
import { callAction } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { queryClient } from "~/lib/query";
import { supabase } from "~/lib/supabase";
import { pickPhoto, readBytes, uuid, type Picked } from "~/lib/upload";
import { useCall } from "~/lib/use-action";
import { Alert, Button, inputClass, Text, useTheme } from "~/ui";
import { Checkbox, Select, TextField } from "~/ui/forms";

/** Câmera ou galeria (o PhotoSourceButtons do site). */
export function PhotoButtons({ onPick, pending, small }: { onPick: (p: Picked) => void; pending?: boolean; small?: boolean }) {
  const [err, setErr] = useState<string | null>(null);
  const pick = async (s: "camera" | "galeria") => {
    setErr(null);
    try {
      const f = await pickPhoto(s);
      if (f) onPick(f);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        <Button size={small ? "sm" : "md"} icon={Camera} loading={pending} onPress={() => pick("camera")}>
          Tirar foto
        </Button>
        <Button size={small ? "sm" : "md"} icon={ImagePlus} variant="secondary" disabled={pending} onPress={() => pick("galeria")}>
          Galeria
        </Button>
      </View>
      {err ? <Alert>{err}</Alert> : null}
    </View>
  );
}

async function uploadEquipmentPhoto(userId: string, f: Picked) {
  const path = `${userId}/${uuid()}.${f.ext}`;
  const { error } = await supabase.storage.from(EQUIPMENT_BUCKET).upload(path, await readBytes(f.uri), { contentType: f.mime, cacheControl: "31536000" });
  if (error) throw error;
  return path;
}

/** Cadastrar/editar exercício do Personal (mesma ação do site). */
export function EquipmentForm({ userId, initial }: { userId: string; initial?: Equipment }) {
  const t = useTheme();
  const [file, setFile] = useState<Picked | null>(null);
  const [removed, setRemoved] = useState(false);
  const [warnNoImage, setWarnNoImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [group, setGroup] = useState<string>(initial?.muscle_group ?? "");
  const [unit, setUnit] = useState<string>(initial?.intensity_unit ?? "nivel");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [bodyweight, setBodyweight] = useState(!!initial?.is_bodyweight);
  const preview = file?.uri ?? (initial && !removed ? equipmentImageSrc(initial) : null);
  const hasImage = !!file || (!!initial?.image_path && !removed);
  const save = useCall("personal/exercicios#saveEquipment");

  async function submit(skipWarning = false) {
    if (name.trim().length < 2 || !group) return setError("Preencha o nome e o grupo muscular.");
    if (!hasImage && !skipWarning) return setWarnNoImage(true);
    setPending(true);
    setError(null);
    try {
      let image_path: string | null | undefined = undefined;
      if (file) image_path = await uploadEquipmentPhoto(userId, file);
      else if (removed) image_path = null;
      const r = await save.run<{ error?: string } | null>({ id: initial?.id, name, muscle_group: group, description, is_bodyweight: bodyweight, intensity_unit: unit, image_path });
      if (r?.result?.error) setError(r.result.error);
    } catch {
      setError("Não foi possível enviar a imagem. Tenta de novo?");
    } finally {
      setPending(false);
    }
  }
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm font-semibold">Foto do equipamento</Text>
        {preview ? (
          <View>
            <Image source={preview} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 16 }} contentFit="cover" />
            <Pressable
              onPress={() => {
                setFile(null);
                setRemoved(true);
              }}
              className="absolute right-2 top-2 rounded-full bg-surface/90 p-2"
              accessibilityLabel="Remover foto"
            >
              <Trash2 color={t.pitanga600} size={16} />
            </Pressable>
          </View>
        ) : (
          <View className="items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border py-8">
            <ImagePlus color={t.muted} size={40} />
            <Text className="text-sm font-semibold text-muted">Tire uma foto ou escolha da galeria</Text>
          </View>
        )}
        <PhotoButtons
          small
          onPick={(f) => {
            setFile(f);
            setRemoved(false);
            setWarnNoImage(false);
          }}
        />
      </View>
      <TextField label="Nome" value={name} onChangeText={setName} maxLength={80} placeholder="Ex.: Remada máquina articulada" />
      <Select label="Grupo muscular" value={group as never} onChange={setGroup} options={MUSCLE_GROUPS.map((g) => ({ value: g.value as string, label: g.label }))} />
      {group === "cardio" ? (
        <Select
          label="Intensidade no painel do aparelho"
          value={unit}
          onChange={setUnit}
          options={[
            { value: "velocidade", label: "Velocidade (km/h) e inclinação (%) — como na esteira" },
            { value: "nivel", label: "Nível de carga — como na bicicleta e no elíptico" },
          ]}
        />
      ) : null}
      <View className="gap-1.5">
        <Text className="text-sm font-semibold">Descrição / dicas de execução</Text>
        <TextInput value={description} onChangeText={setDescription} multiline maxLength={1000} className={inputClass} style={{ fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" }} />
      </View>
      <Checkbox checked={bodyweight} onChange={setBodyweight}>
        Exercício com peso corporal (aceita carga 0)
      </Checkbox>
      {warnNoImage ? (
        <Alert kind="info">
          <Text className="text-sm font-semibold text-anil-900 dark:text-ipe-400">Que tal adicionar uma foto? 📸</Text>
          <Text className="text-sm text-anil-900 dark:text-ipe-400">Com a foto, o aluno identifica o equipamento na academia muito mais rápido.</Text>
          <Button size="sm" variant="ghost" className="mt-2 self-start" onPress={() => submit(true)}>
            Salvar sem foto
          </Button>
        </Alert>
      ) : null}
      {error || save.error ? <Alert>{error ?? save.error ?? ""}</Alert> : null}
      <Button size="lg" loading={pending} onPress={() => submit()}>
        {pending ? "Salvando…" : initial ? "Salvar alterações" : "Cadastrar exercício"}
      </Button>
    </View>
  );
}

/** Troca a foto de um exercício do catálogo padrão (vale para todos). */
export function CatalogPhoto({ equipmentId, userId, hasPhoto }: { equipmentId: string; userId: string; hasPhoto: boolean }) {
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  async function apply(path: string | null, ok: string) {
    const r = await callAction<{ error?: string } | null>("personal/exercicios#setCatalogImage", equipmentId, path);
    if (r.result?.error || r.error) setState({ error: r.result?.error ?? r.error });
    else {
      setState({ ok });
      void queryClient.invalidateQueries();
    }
  }
  return (
    <View className="mt-6 gap-3 rounded-3xl border border-border bg-surface p-4">
      <Text className="font-display text-lg font-bold">Foto do aparelho</Text>
      <Text className="text-sm text-muted">Tire uma foto do aparelho (ou escolha uma da galeria) para os alunos reconhecerem na academia. A foto vale para todos que usam o BoraTreinar e mostra que foi você quem enviou.</Text>
      <PhotoButtons
        pending={pending}
        onPick={async (f) => {
          setPending(true);
          setState(null);
          try {
            await apply(await uploadEquipmentPhoto(userId, f), "Foto atualizada para todos! 📸");
          } catch {
            setState({ error: "Não foi possível enviar a foto. Tenta de novo?" });
          } finally {
            setPending(false);
          }
        }}
      />
      {hasPhoto ? (
        <Button
          variant="ghost"
          icon={RotateCcw}
          className="self-start"
          disabled={pending}
          onPress={async () => {
            if (await confirmAsk("Voltar para a ilustração original? A foto atual deixa de aparecer para todos.")) await apply(null, "Ilustração original restaurada.");
          }}
        >
          Voltar à ilustração
        </Button>
      ) : null}
      {state?.error ? <Alert>{state.error}</Alert> : state?.ok ? <Alert kind="success">{state.ok}</Alert> : null}
    </View>
  );
}
