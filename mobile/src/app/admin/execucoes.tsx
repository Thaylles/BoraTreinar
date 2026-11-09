import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { CheckCheck, CheckCircle2, Sparkles, Trash2, Wand2, XCircle } from "lucide-react-native";
import { equipmentImageSrc, groupLabel } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { mediaUrl, PUBLIC_DB, publicDbMatch } from "@/lib/exercise-media";
import { callAction, form } from "~/lib/api";
import { adminData } from "~/lib/admin-data";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { queryClient } from "~/lib/query";
import { remoteToJpegBase64 } from "~/lib/upload";
import { useCall, useFormAction } from "~/lib/use-action";
import { Badge, Button, FormMessage, Input, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { Disclosure } from "~/ui/extras";
import { Chip } from "~/components/exercise-picker";
import { MediaPreview } from "~/components/workout-runner";

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "aguardando", label: "Aguardando aprovação" },
  { key: "sem", label: "Sem execução" },
  { key: "aprovados", label: "Aprovados" },
] as const;
const STATUS = {
  gerando: { label: "Gerando…", tone: "blue" },
  rascunho: { label: "Aguardando aprovação", tone: "yellow" },
  aprovado: { label: "Aprovado ✅", tone: "green" },
  rejeitado: { label: "Rejeitado", tone: "red" },
  erro: { label: "Erro", tone: "red" },
} as const;

function GifForm({ equipmentId, suggestion }: { equipmentId: string; suggestion: string | null }) {
  const [id, setId] = useState(suggestion ?? "");
  const { state, pending, submit } = useFormAction("admin/execucoes#generateGif");
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold text-muted">Exercício no banco público</Text>
      <Input value={id} onChangeText={setId} autoCapitalize="none" placeholder="Ex.: Barbell_Curl" />
      <Pressable onPress={() => void Linking.openURL(`${PUBLIC_DB.url}/tree/main/exercises`)}>
        <Text className="text-xs text-muted underline">ver lista</Text>
      </Pressable>
      <FormMessage state={state} />
      <Button size="sm" variant="secondary" icon={Wand2} className="self-start" loading={pending} disabled={!id.trim()} onPress={() => submit({ equipment_id: equipmentId, dataset_id: id })}>
        Gerar GIF
      </Button>
    </View>
  );
}

function AiVideoButton({ equipmentId, photo }: { equipmentId: string; photo: string | null }) {
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, setPending] = useState(false);
  if (!photo) return <Text className="text-xs text-muted">Sem foto: adicione uma foto ao exercício para gerar vídeo com IA.</Text>;
  return (
    <View className="gap-2">
      <Button
        size="sm"
        variant="secondary"
        icon={Sparkles}
        className="self-start"
        loading={pending}
        onPress={async () => {
          if (!(await confirmAsk("Gerar vídeo com IA? Cada vídeo é cobrado na conta do Google (Gemini) por segundo gerado."))) return;
          setPending(true);
          try {
            const r = await callAction<{ error?: string; ok?: string }>("admin/execucoes#startAiVideo", equipmentId, await remoteToJpegBase64(photo));
            setState(r.result ?? { error: r.error });
            void queryClient.invalidateQueries({ queryKey: ["admin-media"] });
          } catch {
            setState({ error: "Não foi possível ler a foto do exercício." });
          } finally {
            setPending(false);
          }
        }}
      >
        Gerar vídeo com IA
      </Button>
      <FormMessage state={state} />
    </View>
  );
}

export default function Execucoes() {
  const t = useTheme();
  const [filtro, setFiltro] = useState("");
  const [batchLog, setBatchLog] = useState<string | null>(null);
  const [batching, setBatching] = useState(false);
  const q = useData(["admin-media"], () => adminData("adminMediaData"));
  const refresh = useRefresh(q);
  const approve = useCall("admin/execucoes#approveMedia");
  const reject = useCall("admin/execucoes#rejectMedia");
  const del = useCall("admin/execucoes#deleteMedia");
  const approveAll = useCall("admin/execucoes#approveAllMedia");
  const generating = (q.data?.media ?? []).filter((m) => m.status === "gerando").length;
  // Vídeos de IA em produção: confere a cada 15 s.
  useEffect(() => {
    if (!generating) return;
    const id = setInterval(async () => {
      const r = await callAction<{ finished: number }>("admin/execucoes#refreshAiVideos").catch(() => null);
      if (r?.result?.finished) void q.refetch();
    }, 15_000);
    return () => clearInterval(id);
  }, [generating, q]);
  if (!q.data) return <Loading />;
  const { eqs, media, missingTable } = q.data;
  if (missingTable)
    return (
      <Screen edges={[]}>
        <PageTitle>Execuções dos exercícios</PageTitle>
        <Text className="text-sm text-muted">Falta aplicar a atualização do banco (SQL de execuções) no Supabase.</Text>
      </Screen>
    );
  const byEq = new Map<string, typeof media>();
  for (const m of media) byEq.set(m.equipment_id, [...(byEq.get(m.equipment_id) ?? []), m]);
  const live = (id: string) => (byEq.get(id) ?? []).filter((m) => m.status !== "rejeitado" && m.status !== "erro");
  const list = eqs.filter((e) => {
    const ms = byEq.get(e.id) ?? [];
    if (filtro === "aguardando") return ms.some((m) => m.status === "rascunho");
    if (filtro === "sem") return !live(e.id).length;
    if (filtro === "aprovados") return ms.some((m) => m.status === "aprovado");
    return true;
  });
  const approved = eqs.filter((e) => (byEq.get(e.id) ?? []).some((m) => m.status === "aprovado")).length;
  const waiting = media.filter((m) => m.status === "rascunho").length;
  const waitingEqs = new Set(media.filter((m) => m.status === "rascunho").map((m) => m.equipment_id)).size;
  const missingWithMatch = eqs.filter((e) => !live(e.id).length && publicDbMatch(e.name)).length;

  async function runBatch() {
    setBatching(true);
    let total = 0;
    const errors: string[] = [];
    try {
      for (let round = 0; round < 20; round++) {
        const r = (await callAction<{ done: number; left: number; errors: string[] }>("admin/execucoes#generateMissingGifs", 6)).result;
        if (!r) break;
        total += r.done;
        errors.push(...r.errors);
        setBatchLog(`${total} GIF(s) gerado(s)… faltam ${r.left}`);
        void q.refetch();
        if (!r.left || (!r.done && r.errors.length)) break;
      }
      setBatchLog(`Pronto: ${total} GIF(s) gerado(s).${errors.length ? ` Falharam: ${errors.join("; ")}` : ""}`);
    } catch {
      setBatchLog("Sem internet ou servidor indisponível.");
    } finally {
      setBatching(false);
    }
  }

  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="GIFs e vídeos curtos da execução de cada exercício do catálogo. Só o que você aprovar aparece para Personais e alunos.">Execuções dos exercícios</PageTitle>
      <View className="mb-4 flex-row gap-2">
        <View className="flex-1 items-center rounded-2xl bg-bandeira-50 p-3 dark:bg-bandeira-500/15">
          <Text className="font-display text-2xl font-extrabold">{approved}</Text>
          <Text className="text-center text-xs text-muted">aprovados de {eqs.length}</Text>
        </View>
        <View className="flex-1 items-center rounded-2xl bg-ipe-100 p-3 dark:bg-ipe-500/15">
          <Text className="font-display text-2xl font-extrabold">{waiting}</Text>
          <Text className="text-center text-xs text-muted">aguardando você</Text>
        </View>
        <View className="flex-1 items-center rounded-2xl bg-border/40 p-3">
          <Text className="font-display text-2xl font-extrabold">{eqs.filter((e) => !live(e.id).length).length}</Text>
          <Text className="text-center text-xs text-muted">sem execução</Text>
        </View>
      </View>
      <View className="mb-4 rounded-2xl bg-anil-700/5 p-4 dark:bg-white/5">
        <Disclosure label="De onde vêm os GIFs e vídeos">
          <Text className="mt-2 text-sm text-muted">
            • <Text className="text-sm font-bold">GIF (grátis):</Text> alterna as fotos de início e fim do movimento do {PUBLIC_DB.name}, que se declara domínio público (Unlicense). A origem das fotos não é documentada; na dúvida, prefira o vídeo de IA.
          </Text>
          <Text className="mt-1 text-sm text-muted">
            • <Text className="text-sm font-bold">Vídeo com IA (pago):</Text> o Google Veo anima a foto do exercício. É cobrado por segundo na conta do Gemini e às vezes erra a execução: assista inteiro antes de aprovar.
          </Text>
        </Disclosure>
      </View>
      {waitingEqs > 0 ? (
        <View className="mb-4">
          <Button
            icon={CheckCheck}
            loading={approveAll.pending}
            onPress={async () => {
              if (await confirmAsk(`Aprovar as execuções de ${waitingEqs} ${waitingEqs === 1 ? "exercício" : "exercícios"} de uma vez? Elas passam a aparecer para Personais e alunos.`)) await approveAll.run();
            }}
          >
            {`Aprovar todas (${waitingEqs} ${waitingEqs === 1 ? "exercício" : "exercícios"})`}
          </Button>
          {waiting > waitingEqs ? <Text className="mt-1 text-center text-xs text-muted">Onde houver mais de uma versão aguardando, a mais recente é aprovada.</Text> : null}
        </View>
      ) : null}
      {generating ? (
        <View className="mb-4 rounded-2xl bg-ipe-100 px-4 py-3 dark:bg-ipe-500/15">
          <Text className="text-sm">⏳ {generating} vídeo(s) de IA em produção. Esta tela atualiza sozinha.</Text>
        </View>
      ) : null}
      {missingWithMatch || batchLog ? (
        <View className="mb-4 gap-2 rounded-2xl border border-border bg-surface p-4">
          {missingWithMatch ? (
            <Button icon={Wand2} loading={batching} onPress={runBatch}>
              {`Gerar GIFs do banco público para os ${missingWithMatch} sem execução`}
            </Button>
          ) : null}
          {batchLog ? <Text className="text-sm text-muted">{batchLog}</Text> : null}
        </View>
      ) : null}
      <View className="mb-4 flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filtro === f.key} onPress={() => setFiltro(f.key)}>
            {f.label}
          </Chip>
        ))}
      </View>
      {!list.length ? <Text className="text-sm text-muted">Nenhum exercício neste filtro.</Text> : null}
      <View className="gap-4">
        {list.map((e) => {
          const photo = equipmentImageSrc(e);
          const items = (byEq.get(e.id) ?? []).slice(0, 4);
          return (
            <View key={e.id} className="rounded-3xl border border-border bg-surface p-4">
              <View className="mb-3 flex-row items-center gap-3">
                {photo ? <Image source={photo} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" /> : null}
                <View className="min-w-0 flex-1">
                  <Text className="font-display text-lg font-bold leading-tight">{e.name}</Text>
                  <Text className="text-xs text-muted">{groupLabel(e.muscle_group)}</Text>
                </View>
              </View>
              {items.length ? (
                <View className="mb-3 gap-3">
                  {items.map((m) => (
                    <View key={m.id} className="rounded-2xl border border-border p-2">
                      {m.path ? (
                        <MediaPreview url={mediaUrl(m.path)} kind={m.kind} label={`Execução de ${e.name}`} />
                      ) : (
                        <View className="aspect-video items-center justify-center rounded-xl bg-border/40">
                          <Text className="text-sm text-muted">{m.status === "gerando" ? "A IA está gerando…" : "Sem arquivo"}</Text>
                        </View>
                      )}
                      <View className="mt-2 flex-row flex-wrap items-center gap-2">
                        <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
                        <Text className="text-xs text-muted">
                          {m.kind === "gif" ? "GIF · banco público" : "Vídeo · IA"} · {formatDate(m.created_at)}
                        </Text>
                      </View>
                      {m.error ? <Text className="mt-1 text-xs text-pitanga-600">{m.error}</Text> : null}
                      <View className="mt-2 flex-row flex-wrap gap-2">
                        {m.status === "rascunho" || m.status === "rejeitado" ? (
                          <Button size="sm" icon={CheckCircle2} onPress={() => approve.run(form({ id: m.id }))}>
                            Aprovar
                          </Button>
                        ) : null}
                        {m.status === "rascunho" || m.status === "aprovado" ? (
                          <Button size="sm" variant="ghost" icon={XCircle} textClassName="text-pitanga-600" className="border border-border" onPress={() => reject.run(form({ id: m.id }))}>
                            {m.status === "aprovado" ? "Tirar do ar" : "Rejeitar"}
                          </Button>
                        ) : null}
                        {m.status === "rejeitado" || m.status === "erro" ? (
                          <Button size="sm" variant="ghost" icon={Trash2} onPress={async () => (await confirmAsk("Apagar este arquivo de vez?", { destructive: true })) && del.run(form({ id: m.id }))}>
                            Apagar
                          </Button>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              <View className="rounded-2xl bg-anil-700/5 p-3 dark:bg-white/5">
                <Disclosure label={items.length ? "Gerar outra versão" : "Gerar execução"}>
                  <View className="mt-3 gap-4">
                    <GifForm equipmentId={e.id} suggestion={publicDbMatch(e.name)} />
                    <AiVideoButton equipmentId={e.id} photo={photo} />
                  </View>
                </Disclosure>
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
