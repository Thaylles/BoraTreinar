import { useState } from "react";
import { Linking, Pressable, TextInput, View } from "react-native";
import { Camera, FileUp, Trash2 } from "lucide-react-native";
import { formatDate } from "@/lib/format";
import { MULTI_FIELDS, needsClearance, PARQ, SINGLE_FIELDS, type HealthForm } from "@/lib/health";
import { callAction } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { queryClient } from "~/lib/query";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { pickDocument, pickPhoto, readBytes, uuid, type Picked } from "~/lib/upload";
import { useFormAction } from "~/lib/use-action";
import { Button, FormMessage, inputClass, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";

function Chip({ on, onPress, children }: { on: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable onPress={onPress} accessibilityState={{ checked: on }} className={cn("rounded-full border-2 px-3 py-1.5", on ? "border-bandeira-500 bg-bandeira-500" : "border-border")}>
      <Text className={cn("text-sm font-semibold", on && "text-white")}>{children}</Text>
    </Pressable>
  );
}
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View className="rounded-3xl border border-border bg-surface p-4">
      <Text className="font-display text-base font-bold">{title}</Text>
      {hint ? <Text className="mb-2 text-xs text-muted">{hint}</Text> : <View className="h-2" />}
      {children}
    </View>
  );
}

function HealthFormView({ initial }: { initial: HealthForm | null }) {
  const t = useTheme();
  const [parq, setParq] = useState<Record<string, "sim" | "nao" | undefined>>(() =>
    initial ? Object.fromEntries(PARQ.map((q) => [q.value, initial.parq_yes.includes(q.value) ? "sim" : "nao"])) : {},
  );
  const [multi, setMulti] = useState<Record<string, string[]>>(() => Object.fromEntries(MULTI_FIELDS.map((q) => [q.key, ((initial?.[q.key] as string[] | undefined) ?? []).slice()])));
  const [single, setSingle] = useState<Record<string, string>>(() => Object.fromEntries(SINGLE_FIELDS.map((q) => [q.key, (initial?.[q.key] as string | null) ?? ""])));
  const [smoker, setSmoker] = useState<boolean | null>(initial?.smoker ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const { state, pending, submit } = useFormAction("aluno/saude#saveHealthForm");
  return (
    <View className="gap-4">
      <Section title="PAR-Q (prontidão para atividade física)" hint="Responda com sinceridade: se alguma for “sim”, vamos pedir uma liberação médica.">
        <View className="gap-3">
          {PARQ.map((q, i) => (
            <View key={q.value}>
              <Text className="mb-1.5 text-sm">
                <Text className="text-sm font-bold">{i + 1}.</Text> {q.label}
              </Text>
              <View className="flex-row gap-2">
                {(["sim", "nao"] as const).map((v) => (
                  <Chip key={v} on={parq[q.value] === v} onPress={() => setParq((p) => ({ ...p, [q.value]: v }))}>
                    {v === "sim" ? "Sim" : "Não"}
                  </Chip>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Section>
      {MULTI_FIELDS.map((q) => (
        <Section key={q.key} title={q.title} hint={q.none ? `Marque todas que se aplicam. Se não tiver, deixe em branco (${q.none.toLowerCase()}).` : "Marque um ou mais."}>
          <View className="flex-row flex-wrap gap-2">
            {q.options.map((o) => {
              const on = multi[q.key].includes(o.value);
              return (
                <Chip key={o.value} on={on} onPress={() => setMulti((m) => ({ ...m, [q.key]: on ? m[q.key].filter((x) => x !== o.value) : [...m[q.key], o.value] }))}>
                  {o.label}
                </Chip>
              );
            })}
          </View>
        </Section>
      ))}
      {SINGLE_FIELDS.map((q) => (
        <Section key={q.key} title={q.title}>
          <View className="flex-row flex-wrap gap-2">
            {q.options.map((o) => (
              <Chip key={o.value} on={single[q.key] === o.value} onPress={() => setSingle((s) => ({ ...s, [q.key]: o.value }))}>
                {o.label}
              </Chip>
            ))}
          </View>
        </Section>
      ))}
      <Section title="Fuma?">
        <View className="flex-row gap-2">
          <Chip on={smoker === true} onPress={() => setSmoker(true)}>
            Sim
          </Chip>
          <Chip on={smoker === false} onPress={() => setSmoker(false)}>
            Não
          </Chip>
        </View>
      </Section>
      <Section title="Algo mais que seu Personal precisa saber?" hint="Opcional. Ex.: onde exatamente dói, em que movimento, recomendações do médico.">
        <TextInput value={notes} onChangeText={setNotes} multiline maxLength={1000} placeholderTextColor={t.muted} className={inputClass} style={{ fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" }} />
      </Section>
      <FormMessage state={state} />
      <Button
        loading={pending}
        onPress={() =>
          submit({
            ...Object.fromEntries(PARQ.map((q) => [`parq_${q.value}`, parq[q.value]])),
            ...multi,
            ...single,
            smoker: smoker === null ? undefined : smoker ? "sim" : "nao",
            notes,
          })
        }
      >
        Salvar anamnese
      </Button>
    </View>
  );
}

function ClearanceUpload({ userId, hasFile, url }: { userId: string; hasFile: boolean; url: string | null }) {
  const t = useTheme();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  async function upload(get: () => Promise<Picked | null>) {
    setState(null);
    try {
      const f = await get();
      if (!f) return;
      setPending(true);
      const bytes = await readBytes(f.uri);
      if (bytes.byteLength > 5 * 1024 * 1024) return setState({ error: "Arquivo muito grande (máx. 5 MB)." });
      const path = `${userId}/${uuid()}.${f.ext}`;
      const { error } = await supabase.storage.from("medical").upload(path, bytes, { contentType: f.mime });
      if (error) throw error;
      const r = await callAction<{ error?: string; ok?: string }>("aluno/saude#setClearance", path);
      setState(r.result ?? { error: r.error });
      void queryClient.invalidateQueries();
    } catch (e) {
      setState({ error: (e as Error).message?.includes("Permita") ? (e as Error).message : "Não foi possível enviar o arquivo. Tente uma foto ou um PDF." });
    } finally {
      setPending(false);
    }
  }
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        <Button icon={Camera} loading={pending} onPress={() => upload(() => pickPhoto("camera", 1800))}>
          Tirar foto
        </Button>
        <Button icon={FileUp} variant="secondary" disabled={pending} onPress={() => upload(pickDocument)}>
          {hasFile ? "Trocar arquivo" : "Enviar PDF/foto"}
        </Button>
        {hasFile && url ? (
          <Button variant="ghost" className="border border-border" onPress={() => void Linking.openURL(url)}>
            Ver arquivo enviado
          </Button>
        ) : null}
        {hasFile ? (
          <Button
            variant="ghost"
            icon={Trash2}
            disabled={pending}
            onPress={async () => {
              if (!(await confirmAsk("Remover a liberação médica enviada?", { ok: "Remover", destructive: true }))) return;
              const r = await callAction<{ error?: string; ok?: string }>("aluno/saude#setClearance", null);
              setState(r.result ?? { error: r.error });
              void queryClient.invalidateQueries();
            }}
          >
            Remover
          </Button>
        ) : null}
      </View>
      <Text className="text-xs text-muted">PDF ou foto do atestado/liberação. Só você e seus Personais conseguem ver.</Text>
      <FormMessage state={state} />
    </View>
  );
}

export default function Saude() {
  const profile = useProfile();
  const q = useData(["health", profile.id], async () => {
    const { data } = await supabase.from("health_forms").select("*").eq("student_id", profile.id).maybeSingle();
    const form = data as HealthForm | null;
    const signed = form?.clearance_path ? ((await supabase.storage.from("medical").createSignedUrl(form.clearance_path, 600)).data?.signedUrl ?? null) : null;
    return { form, signed };
  });
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  const { form, signed } = q.data;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Leva uns 2 minutos e ajuda seu Personal a montar treinos seguros para você.">Anamnese 🩺</PageTitle>
      {form?.updated_at ? <Text className="-mt-3 mb-4 text-xs text-muted">Última atualização: {formatDate(form.updated_at)}</Text> : null}
      {form && needsClearance(form) ? (
        <View className="mb-6 rounded-3xl border-2 border-pitanga-500/60 bg-pitanga-100/50 p-4 dark:bg-pitanga-500/10">
          <Text className="font-display text-lg font-bold">📄 Liberação médica</Text>
          <Text className="mb-3 text-sm">
            Você respondeu “sim” em alguma pergunta do PAR-Q. Antes de intensificar os treinos, converse com um médico e envie aqui a liberação para a prática de atividade física.
          </Text>
          <ClearanceUpload userId={profile.id} hasFile={!!form.clearance_path} url={signed} />
        </View>
      ) : null}
      <HealthFormView key={form?.updated_at ?? "novo"} initial={form} />
    </Screen>
  );
}
