import { useState } from "react";
import { View } from "react-native";
import { Search, UserPlus } from "lucide-react-native";
import { callAction, form } from "~/lib/api";
import { Alert, Button, FormMessage, Input, Text } from "~/ui";
import { Avatar } from "~/ui/extras";

type Found = { id: string; full_name: string; avatar_path: string | null; linked: boolean; pending: boolean };
type FindState = { error?: string; query?: string; results?: Found[] } | null;

/** O Personal adiciona um aluno que já tem conta (e-mail ou WhatsApp). */
export function AddExistingStudent() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<FindState>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Record<string, { error?: string; ok?: string }>>({});
  async function find() {
    setBusy(true);
    try {
      const r = await callAction<FindState>("personal/alunos/vinculo-actions#findStudent", null, form({ q }));
      setState(r.result ?? { error: r.error });
    } catch (e) {
      setState({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input value={q} onChangeText={setQ} placeholder="E-mail ou WhatsApp com DDD" autoCapitalize="none" autoCorrect={false} onSubmitEditing={find} />
        </View>
        <Button icon={Search} loading={busy} disabled={!q.trim()} onPress={find} accessibilityLabel="Buscar" />
      </View>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.results && !state.results.length ? <Alert kind="info">Nenhum aluno com esse e-mail ou WhatsApp. Se ele ainda não tem conta, mande um link de convite.</Alert> : null}
      {state?.results?.map((s) => {
        const res = sent[s.id];
        return (
          <View key={s.id} className="rounded-2xl border border-border bg-background p-3">
            <View className="flex-row items-center gap-3">
              <Avatar path={s.avatar_path} name={s.full_name} size={40} />
              <Text className="min-w-0 flex-1 font-semibold" numberOfLines={1}>{s.full_name}</Text>
              {s.linked ? (
                <Text className="text-sm text-muted">Já é seu aluno</Text>
              ) : s.pending || res?.ok ? (
                <Text className="text-sm text-muted">Pedido enviado</Text>
              ) : (
                <Button
                  size="sm"
                  icon={UserPlus}
                  onPress={async () => {
                    const r = await callAction<{ error?: string; ok?: string }>("personal/alunos/vinculo-actions#requestLink", s.id).catch((e) => ({ error: (e as Error).message }));
                    setSent((m) => ({ ...m, [s.id]: ("result" in r && r.result) || { error: r.error } }));
                  }}
                >
                  Adicionar
                </Button>
              )}
            </View>
            {res ? <FormMessage state={res} /> : null}
          </View>
        );
      })}
    </View>
  );
}
