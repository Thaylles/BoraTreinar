import { useState } from "react";
import { Pressable, View } from "react-native";
import { Trash2 } from "lucide-react-native";
import { MUSCLE_GROUPS } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { loadOpenRequests } from "@/lib/exercise-requests-server";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { useCall, useFormAction } from "~/lib/use-action";
import { Alert, Button, EmptyState, FormMessage, Input, Loading, Text, useTheme } from "~/ui";
import { Disclosure } from "~/ui/extras";
import { Checkbox, Select } from "~/ui/forms";
import { Lightbulb } from "lucide-react-native";

function AddRequestedForm({ requestKey, name, back }: { requestKey: string; name: string; back: string }) {
  const [n, setN] = useState(name);
  const [group, setGroup] = useState("");
  const [unit, setUnit] = useState("nivel");
  const [bw, setBw] = useState(false);
  const [desc, setDesc] = useState("");
  const { state, pending, submit } = useFormAction("exercise-request-actions#addRequestedExercise", { onRedirect: () => true });
  return (
    <View className="gap-2">
      <Input value={n} onChangeText={setN} maxLength={80} accessibilityLabel="Nome do exercício" />
      <Select value={group} onChange={setGroup} placeholder="Grupo muscular…" options={MUSCLE_GROUPS.map((g) => ({ value: g.value as string, label: g.label }))} />
      {group === "cardio" ? (
        <Select value={unit} onChange={setUnit} options={[{ value: "nivel", label: "Painel por nível" }, { value: "velocidade", label: "Velocidade e inclinação" }]} />
      ) : (
        <Checkbox checked={bw} onChange={setBw}>
          Peso do corpo
        </Checkbox>
      )}
      <Input value={desc} onChangeText={setDesc} maxLength={1000} placeholder="Descrição (opcional): como executar" />
      <FormMessage state={state} />
      <Button size="sm" className="self-start" loading={pending} disabled={!group} onPress={() => submit({ key: requestKey, back, name: n, muscle_group: group, intensity_unit: group === "cardio" ? unit : undefined, is_bodyweight: bw, description: desc })}>
        Adicionar ao catálogo
      </Button>
    </View>
  );
}

function LinkExistingForm({ requestKey, options, back }: { requestKey: string; options: { id: string; name: string }[]; back: string }) {
  const [id, setId] = useState("");
  const { state, pending, submit } = useFormAction("exercise-request-actions#linkRequestedExercise", { onRedirect: () => true });
  return (
    <View className="gap-2">
      <Select value={id} onChange={setId} placeholder="Escolha o exercício que já existe…" options={options.map((o) => ({ value: o.id, label: o.name }))} />
      <Button size="sm" variant="secondary" className="self-start" loading={pending} disabled={!id} onPress={() => submit({ key: requestKey, back, equipment_id: id })}>
        É este
      </Button>
      <FormMessage state={state} />
    </View>
  );
}

/** Pedidos de exercício abertos: adicionar ao catálogo, "já existe" e (admin) descartar. */
export function RequestsPanel({ isAdmin, blocked, back }: { isAdmin: boolean; blocked: boolean; back: string }) {
  const t = useTheme();
  const q = useData(["exercise-requests"], async () => {
    const requests = await loadOpenRequests();
    const { data: defaults } = requests.length ? await supabase.from("equipment").select("id, name").eq("is_default", true).order("name") : { data: [] };
    return { requests, defaults: defaults ?? [] };
  });
  const dismiss = useCall("exercise-request-actions#dismissExerciseRequest");
  if (!q.data) return <Loading />;
  if (!q.data.requests.length)
    return (
      <EmptyState icon={Lightbulb} title="Nenhum pedido em aberto">
        Quando um aluno não encontrar um exercício, o pedido aparece aqui até alguém adicionar.
      </EmptyState>
    );
  return (
    <View className="gap-3">
      {dismiss.error ? <Alert>{dismiss.error}</Alert> : null}
      {q.data.requests.map((r) => (
        <View key={r.key} className="rounded-3xl border border-border bg-surface p-4">
          <Text className="font-display text-lg font-bold leading-tight">{r.name}</Text>
          <Text className="text-xs text-muted">
            {r.count === 1 ? "1 aluno pediu" : `${r.count} alunos pediram`} · desde {formatDate(r.since)}
          </Text>
          {r.notes.map((n, i) => (
            <Text key={i} className="mt-1 text-sm italic text-muted">
              “{n}”
            </Text>
          ))}
          <View className="mt-3 gap-3 border-t border-border pt-3">
            {blocked ? (
              <Text className="text-sm text-muted">Seu acesso para adicionar exercícios está bloqueado pelo administrador.</Text>
            ) : (
              <Disclosure label="+ Adicionar ao catálogo">
                <View className="mt-2">
                  <AddRequestedForm requestKey={r.key} name={r.name} back={back} />
                </View>
              </Disclosure>
            )}
            <Disclosure label="Já existe no catálogo com outro nome">
              <View className="mt-2">
                <LinkExistingForm requestKey={r.key} options={q.data!.defaults} back={back} />
              </View>
            </Disclosure>
            {isAdmin ? (
              <Pressable
                className="flex-row items-center gap-1"
                onPress={async () => {
                  if (await confirmAsk(`Descartar o pedido "${r.name}"? Quem pediu é avisado.`, { destructive: true })) await dismiss.run(form({ key: r.key }));
                }}
              >
                <Trash2 color={t.pitanga600} size={14} />
                <Text className="text-xs font-semibold text-pitanga-600">Descartar pedido</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
